-- 账号注销时保住整个家（此前 delete_own_account 只 DELETE auth.users，会引发连锁清空）：
--
-- 隐患链：families.created_by → auth.users ON DELETE CASCADE。创建者一注销，整个 families
-- 行被删，挂在 family_id 上的 family_members / kids / memories / custom_levels / invite_tokens
-- 全部级联消失——其他成员账号还在却成了「无家孤儿」，全家共享记录被清空。
--
-- 本迁移做两件事：
--   1) 注销前把「我创建、但还有其他成员」的家移交给最早加入的另一位成员；只有我是唯一成员
--      的家才随 CASCADE 删掉（空家，无需保留）。
--   2) 回忆属于家庭而非个人：把 kids/memories/custom_levels 的 user_id（「谁记的」署名）从
--      ON DELETE CASCADE 改为 ON DELETE SET NULL。成员注销后，他记过的内容仍留给家人，只是
--      署名失去归属（前端对空作者回退成「家人」）。RLS 均按 family_id 判定，不依赖 user_id。

-- ── 1. user_id 允许为空 + 级联改为 SET NULL ──
ALTER TABLE public.kids ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.kids DROP CONSTRAINT IF EXISTS kids_user_id_fkey;
ALTER TABLE public.kids
  ADD CONSTRAINT kids_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.memories ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.memories DROP CONSTRAINT IF EXISTS memories_user_id_fkey;
ALTER TABLE public.memories
  ADD CONSTRAINT memories_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.custom_levels ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.custom_levels DROP CONSTRAINT IF EXISTS custom_levels_user_id_fkey;
ALTER TABLE public.custom_levels
  ADD CONSTRAINT custom_levels_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2. 注销前移交管理员，避免连带删家 ──
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;

  -- 把「我创建、但还有其他成员」的家移交给最早加入的另一位成员；
  -- 我是唯一成员的家不动，随下面的 DELETE 一并 CASCADE 删掉空家。
  UPDATE public.families f
  SET created_by = (
    SELECT fm.user_id
    FROM public.family_members fm
    WHERE fm.family_id = f.id AND fm.user_id <> uid
    ORDER BY fm.joined_at ASC
    LIMIT 1
  )
  WHERE f.created_by = uid
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = f.id AND fm.user_id <> uid
    );

  DELETE FROM auth.users WHERE id = uid;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM public;
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
