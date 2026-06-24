-- ════════════════════════════════════════════════════════════
-- notification_preferences.notify_family — 家人动态通知的独立开关
--
-- 应用方式：Studio SQL Editor 粘贴执行；或 psql -f。幂等。
--
-- 说明：
--   家人记录了新内容（family_activity 场景）由别人触发、可能更频繁，
--   是唯一值得单独静音的分类，故单拎一个开关。其余报喜类通知
--   （里程碑/连续打卡/时间胶囊）跟随总开关 enabled，不再细分。
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_family BOOLEAN NOT NULL DEFAULT true;
