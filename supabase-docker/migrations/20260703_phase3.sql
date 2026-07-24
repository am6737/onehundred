-- Phase 3: 功能开关 + 统计物化视图

-- 功能开关表
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 统计物化视图（按日聚合）
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_stats AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*) AS new_memories,
  COUNT(DISTINCT family_id) AS active_families
FROM memories
GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_stats_day ON mv_daily_stats (day);

-- 用户注册每日统计视图
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_users AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*) AS new_users
FROM profiles
GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_users_day ON mv_daily_users (day);
