-- 成员管理页要按账户区分同角色成员（比如两人都误设成「爸爸」），并让创建者知道自己在移除谁。
-- family_members 只存 user_id/role，手机号在 auth.users（他人经普通 RLS 不可见），故用
-- SECURITY DEFINER 函数按「我的家」返回名册 + 脱敏手机号：先剥离 +86 前缀，再取前 3 后 4。
-- 只暴露脱敏号，真实号码不出库；无手机号（Apple/匿名登录）返回空串，前端回退 user_id 短号。
CREATE OR REPLACE FUNCTION public.family_roster()
RETURNS TABLE (user_id uuid, role text, custom_role text, joined_at timestamptz, phone_masked text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    fm.user_id, fm.role, fm.custom_role, fm.joined_at,
    CASE
      WHEN length(d.digits) >= 7 THEN left(d.digits, 3) || ' **** ' || right(d.digits, 4)
      ELSE ''
    END AS phone_masked
  FROM public.family_members fm
  JOIN auth.users u ON u.id = fm.user_id
  CROSS JOIN LATERAL (
    SELECT regexp_replace(regexp_replace(coalesce(u.phone, ''), '^\+86', ''), '\D', '', 'g') AS digits
  ) d
  WHERE fm.family_id = public.my_family_id()
  ORDER BY fm.joined_at;
$$;
REVOKE ALL ON FUNCTION public.family_roster() FROM public;
REVOKE EXECUTE ON FUNCTION public.family_roster() FROM anon;
GRANT EXECUTE ON FUNCTION public.family_roster() TO authenticated;
