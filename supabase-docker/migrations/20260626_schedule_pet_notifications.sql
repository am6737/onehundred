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

-- 每小时 :23 分触发（非整点，模拟真人感；设计文档 §4.2）。
-- URL 用 compose 网络内的 Kong 网关地址
-- （与 functions 服务的 SUPABASE_URL=http://kong:8000 一致）；
-- functions-v1 路由无 key-auth 且 FUNCTIONS_VERIFY_JWT=false，故无需鉴权头。
-- timeout 放宽到 180s：含随机 jitter（最长 ~120s）+ 顺序发多台设备的 DooPush。
SELECT cron.schedule(
  'check-notification-triggers',
  '23 * * * *',
  $cmd$
    SELECT net.http_post(
      url     := 'http://kong:8000/functions/v1/send-pet-notifications',
      body    := '{}'::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 180000
    );
  $cmd$
);
