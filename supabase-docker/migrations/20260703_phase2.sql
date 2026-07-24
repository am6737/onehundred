-- ════════════════════════════════════════════════════════════
-- Phase 2 — 内容审核字段 + 审计日志表
-- 应用方式：psql -f（幂等）。
-- ════════════════════════════════════════════════════════════

-- 内容审核状态
ALTER TABLE memories ADD COLUMN IF NOT EXISTS moderation_status TEXT
  NOT NULL DEFAULT 'approved'
  CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'removed'));
ALTER TABLE memories ADD COLUMN IF NOT EXISTS moderation_note TEXT DEFAULT '';

-- 审计日志表
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON admin_audit_log (admin_user_id);
