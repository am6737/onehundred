-- ════════════════════════════════════════════════════════════
-- 通知投递持久化（Transactional Outbox + 即时分发）
--
-- 目标：memory 一旦入库，通知任务就一定存在且被可靠投递；正常 ~1-3s 即时送达，
--       Edge Function 重启/瞬时故障也不丢（每分钟兜底重试）。
--
-- 组成：
--   • notification_outbox   —— 队列 + 投递台账
--   • 触发器 enqueue_memory_notification —— memories AFTER INSERT：同事务入队 + 即时 kick
--   • claim_notification_jobs / complete_notification_job —— drain worker 的领取/收尾
--   • cron drain-notification-outbox —— 每分钟兜底，唤醒 send-pet-notifications 的 drain 分支
--
-- 应用方式：psql -U supabase_admin -f（幂等，可重复执行）。
-- 前置：app_config.notify_secret 已写入（send-pet-notifications 的共享密钥门）。
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 1. 发件箱表（队列 + 台账）──
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id              BIGSERIAL PRIMARY KEY,
  event           TEXT NOT NULL DEFAULT 'memory_created',
  family_id       UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  kid_id          TEXT,
  actor_user_id   UUID,           -- 需排除的记录者（手动路径填；邀记路径为 NULL＝不排除任何人）
  who             TEXT,           -- 邀记路径直接带角色；手动为 NULL，drain 反查 profiles
  dedupe_key      TEXT UNIQUE,    -- 'mem:'||memory.id，幂等防重复入队
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','done','dead')),
  attempts        INT  NOT NULL DEFAULT 0,
  max_attempts    INT  NOT NULL DEFAULT 6,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_count      INT,            -- 实发设备数（0＝被关通知/免打扰/无收件人跳过）
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_claim
  ON public.notification_outbox (status, next_attempt_at);

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
-- 不建任何策略：客户端一律拒绝；SECURITY DEFINER 触发器/函数 与 service_role(BYPASSRLS) 可写。
REVOKE ALL ON public.notification_outbox FROM anon, authenticated;

-- ── 2. 入队触发器：memories AFTER INSERT（同事务入队 + 即时 kick）──
CREATE OR REPLACE FUNCTION public.enqueue_memory_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 与 INSERT 同事务：memory 回滚则入队也回滚，保证不丢、不误发。
  INSERT INTO public.notification_outbox (event, family_id, kid_id, actor_user_id, who, dedupe_key)
  VALUES (
    'memory_created',
    NEW.family_id,
    NEW.kid_id,
    CASE WHEN NEW.invite_token_id IS NULL THEN NEW.user_id ELSE NULL END,        -- 手动排除本人；邀记不排除
    CASE WHEN NEW.invite_token_id IS NOT NULL THEN NULLIF(NEW.invited_role,'') ELSE NULL END,
    'mem:' || NEW.id
  )
  ON CONFLICT (dedupe_key) DO NOTHING;   -- 同一 memory 重试插入不会重复入队

  -- 即时 kick（best-effort）：立刻唤醒 drain。pg_net 的请求入队与本事务同生共死；
  -- 失败无所谓——每分钟 cron 兜底。带共享密钥头（值从 app_config 读）。
  PERFORM net.http_post(
    url     := 'http://kong:8000/functions/v1/send-pet-notifications',
    body    := '{"event":"drain"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Notify-Secret', (SELECT value FROM public.app_config WHERE key = 'notify_secret')
    ),
    timeout_milliseconds := 60000
  );
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_memory_notify ON public.memories;
CREATE TRIGGER trg_memory_notify
  AFTER INSERT ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_memory_notification();

-- ── 3. 领取一批任务（原子 + SKIP LOCKED + 卡死重领）──
CREATE OR REPLACE FUNCTION public.claim_notification_jobs(p_limit INT DEFAULT 20)
RETURNS SETOF public.notification_outbox
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notification_outbox o
  SET status = 'processing', attempts = attempts + 1, processed_at = now()
  FROM (
    SELECT id FROM public.notification_outbox
    WHERE (status = 'pending'    AND next_attempt_at <= now())
       OR (status = 'processing' AND processed_at < now() - interval '5 minutes')  -- worker 崩溃回收
    ORDER BY id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ) c
  WHERE o.id = c.id
  RETURNING o.*;
$$;

-- ── 4. 收尾：成功→done；失败→未耗尽则退避回 pending，耗尽则 dead ──
CREATE OR REPLACE FUNCTION public.complete_notification_job(
  p_id BIGINT, p_ok BOOLEAN, p_sent INT, p_error TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_ok THEN
    UPDATE public.notification_outbox
      SET status = 'done', sent_count = p_sent, last_error = NULL, processed_at = now()
      WHERE id = p_id;
  ELSE
    UPDATE public.notification_outbox
      SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'pending' END,
          last_error = left(p_error, 500),
          next_attempt_at = now() + least(interval '30 seconds' * power(2, attempts), interval '30 minutes'),
          processed_at = now()
      WHERE id = p_id;
  END IF;
END $$;

-- drain worker 走 service_role（Edge Function 的 admin 客户端）经 PostgREST 调用这两个函数。
REVOKE ALL ON FUNCTION public.claim_notification_jobs(int)                       FROM public;
REVOKE ALL ON FUNCTION public.complete_notification_job(bigint,boolean,int,text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_notification_jobs(int)                       TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_notification_job(bigint,boolean,int,text) TO service_role;

-- ── 5. 兜底 drain（每分钟）——即时 kick 失败时的保险 ──
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'drain-notification-outbox';
SELECT cron.schedule(
  'drain-notification-outbox',
  '* * * * *',
  $cmd$
    SELECT net.http_post(
      url     := 'http://kong:8000/functions/v1/send-pet-notifications',
      body    := '{"event":"drain"}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Notify-Secret', (SELECT value FROM public.app_config WHERE key = 'notify_secret')
      ),
      timeout_milliseconds := 60000
    );
  $cmd$
);
