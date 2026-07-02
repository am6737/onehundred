-- ════════════════════════════════════════════════════════════
-- 宠物通知定时调度 — 真正启用 send-pet-notifications 的每小时扫描
--
-- 应用方式：Studio SQL Editor 粘贴执行；或 psql -f。幂等（可重复执行）。
--
-- 前置条件：
--   • Edge Function send-pet-notifications 已部署/挂载（volumes/functions/）。
--   • supabase/postgres 镜像已在 shared_preload_libraries 预加载 pg_cron + pg_net，
--     且 cron.database_name = postgres（与本栈 POSTGRES_DB=postgres 一致）。
--
-- 说明：
--   该函数一次扫描全部家庭、按场景优先级各发一条（loss_hint / growth_nudge /
--   gentle_remind / milestone / capsule / streak / family_activity），
--   故只需一个每小时 job。family_activity 另有「记完即时触发」直接调用，
--   两条路径靠 notification_log 去重，不会重复打扰。
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 幂等：先清掉同名旧 job（不存在则为空集、不报错），再重新登记。
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'check-notification-triggers';

-- 每小时触发一次，但落点分钟每小时都不同（模拟真人感；设计文档 §4.2）。
-- 做法：cron 每分钟跑一次，仅当「当前分钟 == 本小时用 hash 派生的分钟(1..59)」才真正触发。
--   • hash 输入是「距 1970 的小时序号」→ 每小时不同 → 触发分钟每小时都变、不可预测；
--     不再像固定 :23 那样一眼看出规律。
--   • 值域 1..59 → 永不落在整点（沿用「推送不能整点发送」的规则）。
--   • hash 在同一小时内恒定 → 该小时 60 个 tick 恰好命中 1 个 → 每小时精确触发一次、不重复，
--     无需额外状态表。
-- URL 用 compose 网络内的 Kong 网关地址（与 functions 的 SUPABASE_URL=http://kong:8000 一致）；
-- functions-v1 路由无 key-auth 且 FUNCTIONS_VERIFY_JWT=false，故无需鉴权头。
-- timeout 放宽到 180s：Edge Function 内含随机 jitter（最长 ~120s）+ 顺序发多台设备的 DooPush。
SELECT cron.schedule(
  'check-notification-triggers',
  '* * * * *',
  $cmd$
    DO $inner$
    BEGIN
      IF extract(minute FROM now())::int
         = (mod(abs(hashtextextended((floor(extract(epoch FROM now()) / 3600))::bigint::text, 0)), 59) + 1)
      THEN
        PERFORM net.http_post(
          url     := 'http://kong:8000/functions/v1/send-pet-notifications',
          body    := '{}'::jsonb,
          -- 共享密钥头：值从 app_config 读取（不写死在迁移文件里，避免进 git）。
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Notify-Secret', (SELECT value FROM public.app_config WHERE key = 'notify_secret')
          ),
          timeout_milliseconds := 180000
        );
      END IF;
    END
    $inner$;
  $cmd$
);
