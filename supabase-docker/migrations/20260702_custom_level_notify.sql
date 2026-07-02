-- ════════════════════════════════════════════════════════════
-- 新增「家庭自己的事」（custom_levels）也推送家人
--
-- 复用 notification_outbox 投递链路：custom_levels AFTER INSERT → 同事务入队
-- (event='custom_level_added', payload 带 title) + 即时 kick；drain 按 event 分派，
-- 用 custom_level_added 场景文案（含 {{who}} {{title}}）。记录者本人不通知。
--
-- 应用：psql -U supabase_admin -f（幂等）。前置：20260702_notification_outbox.sql 已应用。
-- ════════════════════════════════════════════════════════════

-- 1. outbox 增加 payload（携带 title 等事件数据）
ALTER TABLE public.notification_outbox ADD COLUMN IF NOT EXISTS payload jsonb;

-- 2. 重建领取函数以纳入新列（SETOF 反映最新表结构；幂等）
CREATE OR REPLACE FUNCTION public.claim_notification_jobs(p_limit INT DEFAULT 20)
RETURNS SETOF public.notification_outbox
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.notification_outbox o
  SET status='processing', attempts=attempts+1, processed_at=now()
  FROM (
    SELECT id FROM public.notification_outbox
    WHERE (status='pending'    AND next_attempt_at <= now())
       OR (status='processing' AND processed_at < now() - interval '5 minutes')
    ORDER BY id FOR UPDATE SKIP LOCKED LIMIT p_limit
  ) c WHERE o.id=c.id RETURNING o.*;
$$;

-- 3. custom_level_added 场景文案（果果 / Pip，zh/en）
INSERT INTO public.notification_templates (scene, species, lang, title, body) VALUES
('custom_level_added', 'squirrel', 'zh', '果果', '{{who}}想记一件新的事，一起去看看呀'),
('custom_level_added', 'squirrel', 'en', 'Pip',  '{{who}} wants to remember something new — let''s go see')
ON CONFLICT (scene, species, lang, sort_order) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

-- 4. 入队触发器：custom_levels AFTER INSERT（同事务入队 + 即时 kick）
CREATE OR REPLACE FUNCTION public.enqueue_custom_level_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notification_outbox (event, family_id, kid_id, actor_user_id, who, payload, dedupe_key)
  VALUES (
    'custom_level_added',
    NEW.family_id,
    NULL,                 -- levels 无 kid：drain 时解析家庭首个 kid（仅为 notification_log FK）
    NEW.user_id,          -- 创建者，排除本人
    NULL,                 -- who 由 drain 反查创建者 profile
    jsonb_build_object('title', NEW.title),
    'lvl:' || NEW.id::text
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

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

DROP TRIGGER IF EXISTS trg_custom_level_notify ON public.custom_levels;
CREATE TRIGGER trg_custom_level_notify
  AFTER INSERT ON public.custom_levels
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_custom_level_notification();
