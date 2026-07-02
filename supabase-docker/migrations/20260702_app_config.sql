-- ════════════════════════════════════════════════════════════
-- app_config — 服务端共享配置（key/value），仅 service_role / 超级用户可读写。
--
-- 用途：存放 notify_secret —— send-pet-notifications 的共享密钥头（X-Notify-Secret）。
--   该端点 functions-v1 路由无 key-auth 且 FUNCTIONS_VERIFY_JWT=false、且公网可达，
--   故用共享密钥挡住未授权调用：cron / yaoji / 客户端 携带该头，Edge Function 顶层校验。
--   放数据库而非容器 env：函数代码热加载即可，无需重建 edge 容器（遵循"不重启进程"）。
--
-- ⚠ 密钥真实值不写进本文件（避免进 git）：建表后用 psql 手动 UPSERT 写入。
-- 应用方式：psql -f（幂等）。
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- 不建任何策略：anon / authenticated 一律拒绝；service_role(BYPASSRLS) 与超级用户可读写。
REVOKE ALL ON public.app_config FROM anon, authenticated;
