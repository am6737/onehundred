-- 一百件事 — Database Schema (family-shared)

-- 1. levels (public, read-only)
CREATE TABLE IF NOT EXISTS public.levels (
  num         TEXT PRIMARY KEY,
  perspective TEXT NOT NULL CHECK (perspective IN ('parent','child','together')),
  tone        TEXT NOT NULL,
  title       TEXT NOT NULL,
  why         TEXT NOT NULL DEFAULT '',
  how         TEXT NOT NULL DEFAULT '',
  record      TEXT NOT NULL DEFAULT '',
  suggest     TEXT NOT NULL DEFAULT 'photo' CHECK (suggest IN ('voice','photo','text','video')),
  sealed      BOOLEAN NOT NULL DEFAULT false,
  seal_until  TEXT,
  sealed_on   TEXT,
  seal_kind   TEXT NOT NULL DEFAULT 'date' CHECK (seal_kind IN ('age18','date')),  -- 可封存活动到期日怎么取
  seasonal    BOOLEAN NOT NULL DEFAULT false,
  kid         TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  illustration_path TEXT  -- illustrations 桶里的图路径；为空则回退到 Motifs 的 SVG
);
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "levels_public_read" ON public.levels FOR SELECT USING (true);

-- 2. wardrobe (public, read-only)
CREATE TABLE IF NOT EXISTS public.wardrobe (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slot TEXT NOT NULL,
  at   INT NOT NULL,
  line TEXT NOT NULL
);
ALTER TABLE public.wardrobe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wardrobe_public_read" ON public.wardrobe FOR SELECT USING (true);

-- 3. profiles (1:1 with auth.users)
--    role/custom_role 现在是 family_members 的「冗余镜像」，供现有 UI 直接读「我」。
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT '爸爸',
  custom_role   TEXT NOT NULL DEFAULT '',
  appearance    JSONB,
  family_extras JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3.5 families：一个家 = 一份共享数据
CREATE TABLE IF NOT EXISTS public.families (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- 3.6 family_members：成员名册 + 每人自己的角色（MVP 一人一家）
CREATE TABLE IF NOT EXISTS public.family_members (
  family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT '爸爸',
  custom_role TEXT NOT NULL DEFAULT '',
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- 3.7 family 上下文辅助函数（SECURITY DEFINER：避免 family_members 策略自引用递归）
CREATE OR REPLACE FUNCTION public.my_family_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT family_id FROM public.family_members WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_family_creator(fid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.families WHERE id = fid AND created_by = auth.uid());
$$;

-- 3.8 families / family_members RLS
CREATE POLICY "families_read" ON public.families
  FOR SELECT USING (id = public.my_family_id());
CREATE POLICY "families_creator_update" ON public.families
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "families_creator_delete" ON public.families
  FOR DELETE USING (created_by = auth.uid());
-- families 的 INSERT 只走 create_family RPC，不开放 client INSERT 策略

CREATE POLICY "family_members_read" ON public.family_members
  FOR SELECT USING (family_id = public.my_family_id());
CREATE POLICY "family_members_creator_remove" ON public.family_members
  FOR DELETE USING (public.is_family_creator(family_id));
-- family_members 的 INSERT 只走 create_family / redeem_invite RPC

-- 3.9 建家 RPC：原子建 families + 创建者 membership，生成唯一 invite_code
CREATE OR REPLACE FUNCTION public.create_family(p_role text, p_custom_role text DEFAULT '')
RETURNS TABLE (family_id uuid, invite_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid  uuid := auth.uid();
  fid  uuid;
  code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING errcode = '28000'; END IF;
  IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = uid) THEN
    RAISE EXCEPTION 'already_in_family';
  END IF;
  LOOP
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.families f WHERE f.invite_code = code);
  END LOOP;
  INSERT INTO public.families (created_by, invite_code) VALUES (uid, code) RETURNING id INTO fid;
  INSERT INTO public.family_members (family_id, user_id, role, custom_role)
    VALUES (fid, uid, p_role, p_custom_role);
  RETURN QUERY SELECT fid, code;
END;
$$;
REVOKE ALL ON FUNCTION public.create_family(text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.create_family(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_family(text, text) TO authenticated;

-- 3.10 加入 RPC：按邀请码把自己加进某个家
CREATE OR REPLACE FUNCTION public.redeem_invite(p_code text, p_role text, p_custom_role text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := auth.uid();
  fid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING errcode = '28000'; END IF;
  IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = uid) THEN
    RAISE EXCEPTION 'already_in_family';
  END IF;
  SELECT id INTO fid FROM public.families WHERE invite_code = upper(trim(p_code));
  IF fid IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  INSERT INTO public.family_members (family_id, user_id, role, custom_role)
    VALUES (fid, uid, p_role, p_custom_role);
  RETURN fid;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_invite(text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.redeem_invite(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text, text, text) TO authenticated;

-- 4. kids（family 共享；只有创建者能删）
CREATE TABLE IF NOT EXISTS public.kids (
  id          TEXT PRIMARY KEY,
  family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- 是谁记的
  name        TEXT NOT NULL,
  birth_year  INT NOT NULL,
  birth_month INT NOT NULL,
  tone        TEXT NOT NULL DEFAULT 'orange',
  bear        TEXT NOT NULL DEFAULT '',
  since       TEXT NOT NULL DEFAULT '',
  accessories TEXT[] NOT NULL DEFAULT '{}'
);
ALTER TABLE public.kids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_family_read"   ON public.kids FOR SELECT USING (family_id = public.my_family_id());
CREATE POLICY "kids_family_insert" ON public.kids FOR INSERT WITH CHECK (family_id = public.my_family_id());
CREATE POLICY "kids_family_update" ON public.kids FOR UPDATE
  USING (family_id = public.my_family_id()) WITH CHECK (family_id = public.my_family_id());
CREATE POLICY "kids_creator_delete" ON public.kids FOR DELETE USING (public.is_family_creator(family_id));

-- 5. memories（family 共享；成员平等，都能记/删）
CREATE TABLE IF NOT EXISTS public.memories (
  id          TEXT PRIMARY KEY,
  family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- 是谁记的
  kid_id      TEXT NOT NULL,
  level_num   TEXT NOT NULL,
  perspective TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('voice','photo','text','video')),
  duration    TEXT,
  shots       INT,
  date        TEXT NOT NULL,
  place       TEXT,
  title       TEXT NOT NULL,
  caption     TEXT NOT NULL DEFAULT '',
  transcript  TEXT,
  tone        TEXT NOT NULL DEFAULT 'orange',
  sealed      BOOLEAN NOT NULL DEFAULT false,        -- 这条记录是否封存
  seal_until  TIMESTAMPTZ,                           -- 真实到期日；解封靠它比时间
  seal_label  TEXT,                                  -- 展示文案，如「朵朵 18 岁生日」
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memories_family" ON public.memories
  FOR ALL USING (family_id = public.my_family_id())
  WITH CHECK (family_id = public.my_family_id());

-- 6. mascots（一个孩子一只小熊，跟孩子走，全家同一只）
CREATE TABLE IF NOT EXISTS public.mascots (
  kid_id    TEXT PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  tone      TEXT NOT NULL DEFAULT 'orange',
  since     TEXT NOT NULL DEFAULT '',
  stage     INT NOT NULL DEFAULT 1,
  grown     INT NOT NULL DEFAULT 0,
  items     JSONB NOT NULL DEFAULT '[]',
  log       JSONB NOT NULL DEFAULT '[]'
);
ALTER TABLE public.mascots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mascots_family" ON public.mascots
  FOR ALL USING (family_id = public.my_family_id())
  WITH CHECK (family_id = public.my_family_id());

-- 7. custom_levels（family 共享）
CREATE TABLE IF NOT EXISTS public.custom_levels (
  id          SERIAL PRIMARY KEY,
  family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- 是谁建的
  num         TEXT NOT NULL,
  title       TEXT NOT NULL,
  why         TEXT NOT NULL DEFAULT '',
  how         TEXT NOT NULL DEFAULT '',
  record_hint TEXT NOT NULL DEFAULT '',
  perspective TEXT NOT NULL DEFAULT 'together',
  tone        TEXT NOT NULL DEFAULT 'pink',
  suggest     TEXT NOT NULL DEFAULT 'photo',
  illustration_path TEXT,  -- 同 levels.illustration_path
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.custom_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_levels_family" ON public.custom_levels
  FOR ALL USING (family_id = public.my_family_id())
  WITH CHECK (family_id = public.my_family_id());

-- 8. Trigger: auto-create profile on user sign-up（不建家）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Storage: 私有桶 memories，文件按 `${familyId}/${memoryId}/<name>` 存，按家庭可见
INSERT INTO storage.buckets (id, name, public) VALUES ('memories', 'memories', false)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "memories_media_family" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'memories' AND (storage.foldername(name))[1] = public.my_family_id()::text)
  WITH CHECK (bucket_id = 'memories' AND (storage.foldername(name))[1] = public.my_family_id()::text);

-- 公开桶 illustrations：事情的插画，所有人可读（public 桶读取走 /object/public/ 不过 RLS）
INSERT INTO storage.buckets (id, name, public) VALUES ('illustrations', 'illustrations', true)
ON CONFLICT (id) DO UPDATE SET public = true;
-- 自定义事的封面：写入限定到自己家的目录（路径首段是 family_id），读保持全公开。
CREATE POLICY "illustrations_family_write" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'illustrations' AND (storage.foldername(name))[1] = public.my_family_id()::text)
  WITH CHECK (bucket_id = 'illustrations' AND (storage.foldername(name))[1] = public.my_family_id()::text);

-- 10. Account deletion: 用户删自己账号。
--     注意：若删的是家庭创建者，families.created_by ON DELETE CASCADE 会连带删掉整个家的数据。
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
  DELETE FROM auth.users WHERE id = uid;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM public;
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
