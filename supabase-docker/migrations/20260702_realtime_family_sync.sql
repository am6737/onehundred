-- 家庭内容实时同步：让家人在别的设备上的改动实时推到其他在线成员。
-- 1) 把家庭共享表加入 supabase_realtime 发布（默认发布是空的，不加就收不到 postgres_changes）。
-- 2) REPLICA IDENTITY FULL：memories/kids/custom_levels 的主键是 id、family_id 不在主键里，
--    默认 DELETE 事件只带主键，客户端按 family_id 过滤会漏掉删除；改成 FULL 让旧行带上 family_id。
--    这几张表都是低频写，FULL 的 WAL 开销可忽略。
-- 幂等：已在发布里的表跳过；发布不存在（极早期 init）时整体跳过。
ALTER TABLE public.memories      REPLICA IDENTITY FULL;
ALTER TABLE public.kids          REPLICA IDENTITY FULL;
ALTER TABLE public.custom_levels REPLICA IDENTITY FULL;
ALTER TABLE public.family_members REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['memories','kids','custom_levels','family_members'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
