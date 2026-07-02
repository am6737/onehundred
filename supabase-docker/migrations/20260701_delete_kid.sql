-- 删除孩子：比移除大人重得多，会清空这个孩子的全部记录。memories/mascots/invite_tokens 的
-- kid_id 都没有外键（无法靠 ON DELETE CASCADE 兜底），直接删 kids 只会留下孤儿数据，
-- 还会污染年度回顾等按 kid 聚合的查询。故用 SECURITY DEFINER 在一个事务里原子清理：
-- memories + mascots + invite_tokens 手动删，notification_log 有 CASCADE 随 kids 自动删。仅创建者。
CREATE OR REPLACE FUNCTION public.delete_kid(p_kid_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  fid uuid := public.my_family_id();
BEGIN
  IF fid IS NULL THEN RAISE EXCEPTION 'no_family'; END IF;
  IF NOT public.is_family_creator(fid) THEN RAISE EXCEPTION 'not_creator'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kids WHERE id = p_kid_id AND family_id = fid) THEN
    RAISE EXCEPTION 'kid_not_found';
  END IF;
  -- 每个家至少保留一个孩子：App 的路由假设「有家 ⟹ 有孩子」，删空会把用户弹回创建引导页并卡死。
  IF (SELECT count(*) FROM public.kids WHERE family_id = fid) <= 1 THEN
    RAISE EXCEPTION 'last_kid';
  END IF;
  DELETE FROM public.memories      WHERE kid_id = p_kid_id AND family_id = fid;
  DELETE FROM public.mascots       WHERE kid_id = p_kid_id AND family_id = fid;
  DELETE FROM public.invite_tokens WHERE kid_id = p_kid_id AND family_id = fid;
  DELETE FROM public.kids          WHERE id     = p_kid_id AND family_id = fid;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_kid(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.delete_kid(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_kid(text) TO authenticated;
