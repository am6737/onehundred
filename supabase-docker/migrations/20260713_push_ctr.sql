-- ════════════════════════════════════════════════════════════
-- 智能推送 v2 — 点击回写 + CTR 闭环
--
-- 现状缺口：notification_log.clicked/clicked_at 字段早就存在，但客户端从不回写，
-- 所以系统没有任何「哪条文案/哪个时段更有效」的反馈信号 —— 无法做数据驱动优选。
--
-- 本迁移打通闭环的「写」与「读」两端：
--   • mark_notification_clicked(bigint)：客户端点击推送时回写该条日志为 clicked。
--   • notification_ctr 视图：每模板近 45 天的 sent / clicks 汇总，供 Edge Function
--     的 pickTemplate() 做 CTR 加权选取（RDSA-lite：高点击率文案更常被选，仍保留探索）。
--   • 两个索引：加速轮播查询（family_id+scene 最近发送）与 CTR 聚合。
--
-- 发送侧：send-pet-notifications 现在「先落日志拿 id → 写进 push payload → 客户端点击带回」。
--
-- 幂等：可重复执行。
-- ════════════════════════════════════════════════════════════

-- ── 1. 点击回写 RPC ──
-- log_id 是服务端下发、仅推给该家庭设备的 opaque 值。SECURITY DEFINER + 授权 anon/authenticated：
-- 冷启动（用户 session 尚未就绪）从通知点开 App 时也能回写。仅首次置位（clicked=false 才更新），幂等。
-- 越权风险：至多把别家的一条日志标记为已点击 → 仅轻微污染统计，无数据泄露，可接受。
CREATE OR REPLACE FUNCTION public.mark_notification_clicked(p_log_id BIGINT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notification_log
     SET clicked = true, clicked_at = now()
   WHERE id = p_log_id AND clicked = false;
$$;

REVOKE ALL ON FUNCTION public.mark_notification_clicked(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notification_clicked(BIGINT) TO anon, authenticated;

-- ── 2. 每模板 CTR 汇总视图（近 45 天）──
-- sent = 该模板发送次数（notification_log 每行一次发送），clicks = 被点击次数。
-- Edge Function 以 service role 读取（绕过 RLS）；不对客户端暴露。
CREATE OR REPLACE VIEW public.notification_ctr AS
  SELECT template_id,
         count(*)::bigint                          AS sent,
         count(*) FILTER (WHERE clicked)::bigint    AS clicks
    FROM public.notification_log
   WHERE template_id IS NOT NULL
     AND sent_at > now() - interval '45 days'
   GROUP BY template_id;

GRANT SELECT ON public.notification_ctr TO service_role;

-- ── 3. 索引 ──
-- 轮播选取按 (family_id, scene) 取最近发送记录；CTR 视图按 template_id 聚合。
CREATE INDEX IF NOT EXISTS idx_notif_log_family_scene
  ON public.notification_log (family_id, scene, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_template
  ON public.notification_log (template_id);
