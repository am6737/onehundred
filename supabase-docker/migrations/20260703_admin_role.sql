-- ════════════════════════════════════════════════════════════
-- admin_role — 管理后台权限等级
-- 四级：super_admin / admin / operator / support
-- NULL 表示普通用户（无后台权限）。
-- 应用方式：psql -f（幂等）。
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_role TEXT
  CHECK (admin_role IN ('super_admin', 'admin', 'operator', 'support'));
