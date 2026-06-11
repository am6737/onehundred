# 家庭共享 / 邀请加入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让爸爸建家、妈妈输邀请码加入后看到同一个孩子/回忆/小熊，引导页分「创建/加入」两条路径。

**Architecture:** 新增 `families` + `family_members` 两张表；内容表加 `family_id` 列、RLS 从「按 user_id」改为「按 family_id」；加入走 `redeem_invite` SECURITY DEFINER RPC；媒体桶路径从 `${userId}/…` 改为 `${familyId}/…`。角色源头在 `family_members`，镜像写 `profiles` 以减少现有 UI 改动。

**Tech Stack:** Expo SDK 56 / React Native 0.85（Fabric）/ TypeScript / 自托管 Supabase（docker，Postgres + PostgREST + Storage）。

**设计依据：** `docs/superpowers/specs/2026-06-11-family-sharing-join-design.md`

---

## 测试约定（本项目没有单测框架）

本仓库没有 jest/vitest 等单测框架，验证方式分三类，后面每个 Task 会指明用哪种：

- **类型检查**：`npx tsc --noEmit`（改 TS/TSX 后必跑，期望 0 error）。
- **DB 结构断言**：用 psql 连本地 db 容器查表/列/策略/函数是否存在。统一命令前缀（在 `supabase-docker/` 目录下）：

  ```bash
  PSQL='docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml exec -T db psql -U postgres -d postgres -tAc'
  ```

  > 注：psql 以 postgres 超级用户连接，**会绕过 RLS**，所以只能验证「结构存在」，不能验证「RLS 拦截行为」。RLS 的真实拦截行为放到 Task 9 用两个 App 账号端到端验证（PostgREST 带 JWT 才会触发 RLS）。
- **手动端到端**：用 `/run` 跑起 App，按 Task 9 的清单两账号联调。

**应用新 schema 到一个全新库**（Task 1 用得到）：本地数据可重置（spec 决策 4）。在 `supabase-docker/` 下：

```bash
# 1) 重置并拉起整套（用你现有的工作流；reset.sh 会清空 volume）
./reset.sh -y && ./run.sh
# 等 db 健康后，应用本项目 schema（init/schema.sql 不在 compose 自动挂载里，手动灌）
cat volumes/db/init/schema.sql | docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml exec -T db psql -U postgres -d postgres
cat volumes/db/init/seed.sql   | docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml exec -T db psql -U postgres -d postgres
```

> 如果你的项目里 schema.sql 是用别的方式灌的，按你已有的方式来；关键是「全新库 + 新版 schema.sql」。

---

## Task 1: 重建 schema（families / family_members / family_id / RLS / RPC / 媒体）

**Files:**
- Modify (整体重写): `supabase-docker/volumes/db/init/schema.sql`

把 `schema.sql` 全文替换为下面内容。改动点：新增 §3.5/§3.6/辅助函数/RPC；`kids/memories/mascots/custom_levels` 加 `family_id`、改主键、改 RLS；§9 存储策略改 familyId。`levels`/`wardrobe`/`profiles`/`handle_new_user`/`delete_own_account` 保持不变。

- [ ] **Step 1: 重写 `supabase-docker/volumes/db/init/schema.sql` 全文**

```sql
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
  seasonal    BOOLEAN NOT NULL DEFAULT false,
  kid         TEXT,
  sort_order  INT NOT NULL DEFAULT 0
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
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.families WHERE invite_code = code);
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
```

- [ ] **Step 2: 应用到全新库**

按本文件「测试约定 → 应用新 schema」的命令重置并灌入 schema.sql。
Expected: psql 输出一连串 `CREATE TABLE` / `CREATE POLICY` / `CREATE FUNCTION` / `GRANT`，无 ERROR。

- [ ] **Step 3: 结构断言（在 `supabase-docker/` 下）**

```bash
PSQL='docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml exec -T db psql -U postgres -d postgres -tAc'
$PSQL "SELECT count(*) FROM pg_proc WHERE proname IN ('my_family_id','is_family_creator','create_family','redeem_invite');"
$PSQL "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='kids' AND column_name='family_id';"
$PSQL "SELECT count(*) FROM information_schema.table_constraints WHERE table_name='mascots' AND constraint_type='PRIMARY KEY';"
$PSQL "SELECT policyname FROM pg_policies WHERE tablename='kids' ORDER BY policyname;"
$PSQL "SELECT policyname FROM pg_policies WHERE tablename='objects' AND schemaname='storage';"
```

Expected:
- 第 1 行：`4`
- 第 2 行：`family_id`
- 第 3 行：`1`
- 第 4 行：`kids_creator_delete` / `kids_family_insert` / `kids_family_read` / `kids_family_update`
- 第 5 行：包含 `memories_media_family`

- [ ] **Step 4: Commit**

```bash
git add supabase-docker/volumes/db/init/schema.sql
git commit -m "feat(db): family-shared schema — families/family_members, family_id RLS, invite RPCs"
```

---

## Task 2: 数据层 — family 辅助函数

**Files:**
- Modify: `src/data/index.ts`（在文件末尾「Derived helper functions」之前，紧跟 `updateProfile` 之后追加）

- [ ] **Step 1: 在 `src/data/index.ts` 追加 family 辅助函数**

紧接 `updateProfile`（约 line 266）之后插入：

```ts
// ── Family（家庭共享）──

// 当前用户的 family_id 缓存：避免每次写入都查一次。切账号/退出时调 clearFamilyCache()。
let _familyIdCache: string | null = null;
export function clearFamilyCache() { _familyIdCache = null; }

export async function getMyFamilyId(): Promise<string | null> {
  if (_familyIdCache) return _familyIdCache;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error || !data) return null;
  _familyIdCache = data.family_id;
  return _familyIdCache;
}

// 拉「我的家」+ 花名册。无家时返回 null。
export async function fetchMyFamily() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: mem } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (!mem) return null;
  const { data: fam } = await supabase
    .from('families')
    .select('id, invite_code, created_by')
    .eq('id', mem.family_id)
    .maybeSingle();
  const { data: members } = await supabase
    .from('family_members')
    .select('user_id, role, custom_role, joined_at')
    .eq('family_id', mem.family_id)
    .order('joined_at');
  return {
    id: mem.family_id,
    inviteCode: fam?.invite_code || '',
    isCreator: fam?.created_by === session.user.id,
    members: (members || []).map(m => ({
      userId: m.user_id, role: m.role, customRole: m.custom_role,
      isMe: m.user_id === session.user.id,
    })),
  };
}

// 建家：返回 { id, inviteCode }
export async function createFamily(role: string, custom = '') {
  const { data, error } = await supabase.rpc('create_family', { p_role: role, p_custom_role: custom });
  if (error) throw error;
  _familyIdCache = null;
  const row = Array.isArray(data) ? data[0] : data;
  return { id: row.family_id, inviteCode: row.invite_code };
}

// 加入：返回 family_id；错误码 invalid_code / already_in_family
export async function joinFamily(code: string, role: string, custom = '') {
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: code, p_role: role, p_custom_role: custom });
  if (error) throw error;
  _familyIdCache = null;
  return data as string;
}

// 创建者移除成员
export async function removeFamilyMember(userId: string) {
  const fid = await getMyFamilyId();
  if (!fid) throw new Error('no_family');
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('family_id', fid)
    .eq('user_id', userId);
  if (error) throw error;
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: PASS（0 error）

- [ ] **Step 3: Commit**

```bash
git add src/data/index.ts
git commit -m "feat(data): family helpers — getMyFamilyId/fetchMyFamily/create/join/removeMember"
```

---

## Task 3: 写入带 family_id（kids / memories / custom_levels）

**Files:**
- Modify: `src/data/index.ts`（`insertKid` ~234、`insertMemory` ~189、`insertCustomLevel` ~174、`deleteMemory` 清理目录 ~220）

- [ ] **Step 1: `insertKid` 带 family_id**

把 `insertKid` 整体替换为：

```ts
export async function insertKid({ name, y, m, tone = 'orange' }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const familyId = await getMyFamilyId();
  if (!familyId) throw new Error('no_family');
  const id = 'k' + Date.now();
  const { data, error } = await supabase.from('kids').insert({
    id,
    family_id: familyId,
    user_id: session.user.id,
    name,
    birth_year: y,
    birth_month: m,
    tone,
    bear: '',
    since: '',
    accessories: ['scarf'],
  }).select().single();
  if (error) throw error;
  return mapKid(data);
}
```

- [ ] **Step 2: `insertMemory` 带 family_id**

在 `insertMemory` 里 `const id = givenId || ...` 之后、`.insert({` 之前，加一行取 familyId，并在 insert 对象里加 `family_id`：

```ts
export async function insertMemory({ id: givenId, kid, levelNum, perspective, type, dur, shots, date, place, title, caption, transcript, tone }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const familyId = await getMyFamilyId();
  if (!familyId) throw new Error('no_family');
  const id = givenId || `m${Date.now()}`;
  const { data, error } = await supabase.from('memories').insert({
    id,
    family_id: familyId,
    user_id: session.user.id,
    kid_id: kid,
    level_num: levelNum,
    perspective,
    type,
    duration: dur || null,
    shots: shots || null,
    date,
    place: place || null,
    title,
    caption: caption || '',
    transcript: transcript || null,
    tone: tone || 'orange',
  }).select().single();
  if (error) throw error;
  return mapMemory(data);
}
```

- [ ] **Step 3: `insertCustomLevel` 带 family_id，且 ★ 序号按家庭算**

把 `insertCustomLevel` 整体替换为（注意 `.eq('user_id', …)` 改成 `.eq('family_id', …)`）：

```ts
export async function insertCustomLevel({ title, why = '', perspective = 'together', tone = 'pink', suggest = 'photo' }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const familyId = await getMyFamilyId();
  if (!familyId) throw new Error('no_family');
  const { data: existing } = await supabase.from('custom_levels').select('id').eq('family_id', familyId);
  const num = '★' + ((existing?.length || 0) + 1);
  const { data, error } = await supabase.from('custom_levels').insert({
    family_id: familyId,
    user_id: session.user.id,
    num, title, perspective, tone, suggest,
    why: why || '这是你们家自己的事，记下来就不会忘。',
    how: '', record_hint: '',
  }).select().single();
  if (error) throw error;
  return mapCustomLevel(data);
}
```

- [ ] **Step 4: `deleteMemory` 媒体清理目录改 familyId**

把 `deleteMemory` 里 `const dir = \`${session.user.id}/${id}\`;` 一行改为：

```ts
    const familyId = await getMyFamilyId();
    const dir = `${familyId}/${id}`;
```

（位置：line ~220，try 块内、`supabase.storage.from('memories').list(dir)` 之前。）

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/data/index.ts
git commit -m "feat(data): stamp family_id on kid/memory/custom-level inserts; family-scoped star numbering"
```

---

## Task 4: DataProvider 暴露 family 状态与动作

**Files:**
- Modify: `src/data/DataProvider.tsx`

- [ ] **Step 1: 引入新函数 + 加 family 状态**

在顶部 import（`from './index'`）里追加 `fetchMyFamily, createFamily as apiCreateFamily, joinFamily as apiJoinFamily, removeFamilyMember, clearFamilyCache`。

在 `const [profile, setProfile] = useState(null);` 下面加：

```tsx
  const [family, setFamily] = useState(null);
```

- [ ] **Step 2: loadAll 拉 family，并清缓存**

把 `loadAll` 里的 `if (!userId) { setLoading(false); return; }` 之后、`setLoading(true)` 之前加 `clearFamilyCache();`，并把 `Promise.all` 列表追加 `fetchMyFamily()`，解构与 set 对应加上 family。改成：

```tsx
  const loadAll = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    clearFamilyCache();
    setLoading(true);
    try {
      const [lv, ki, me, ma, wa, cl, pr, fam] = await Promise.all([
        fetchLevels(), fetchKids(), fetchMemories(), fetchMascots(),
        fetchWardrobe(), fetchCustomLevels(), fetchProfile(), fetchMyFamily(),
      ]);
      setLevels(lv);
      setKids(ki);
      setMemories(me);
      setMascots(ma);
      setWardrobe(wa);
      setCustomLevels(cl);
      setProfile(pr);
      setFamily(fam);
    } catch (e) {
      console.error('DataProvider loadAll error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);
```

- [ ] **Step 3: 加 createFamily / joinFamily / removeMember 动作**

在 `addKid` 的 useCallback 之后加：

```tsx
  const createFamily = useCallback(async (role, custom = '') => {
    const fam = await apiCreateFamily(role, custom);
    setFamily(await fetchMyFamily());
    return fam;
  }, []);

  const joinFamily = useCallback(async (code, role, custom = '') => {
    await apiJoinFamily(code, role, custom);
    await loadAll();           // 加入后整库重拉（拿到家庭的孩子/回忆/小熊）
  }, [loadAll]);

  const removeMember = useCallback(async (memberUserId) => {
    await removeFamilyMember(memberUserId);
    setFamily(await fetchMyFamily());
  }, []);
```

- [ ] **Step 4: 把 family 与动作放进 context value**

在 `const value = { ... }` 里，把 `profile, loading,` 改为 `profile, family, loading,`，并在 `addMemory, removeMemory, addKid, addCustomLevel, updateMe,` 一行后追加 `createFamily, joinFamily, removeMember,`。

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/data/DataProvider.tsx
git commit -m "feat(data): DataProvider exposes family state + createFamily/joinFamily/removeMember"
```

---

## Task 5: 媒体路径切到 familyId（上传 / 读取）

**Files:**
- Modify: `src/screens/RecordFlow.tsx`（`uploadToStorage` ~102、调用处 ~495）
- Modify: `src/lib/media.ts`（`fetchMemoryMedia` ~28）

> `deleteMemory` 的清理目录已在 Task 3 Step 4 改过，这里不重复。

- [ ] **Step 1: RecordFlow 上传改用 familyId**

把 `uploadToStorage(uri, userId, memoryId, filename)` 的形参名 `userId` 改为 `familyId`，函数体内 `const path = \`${userId}/${memoryId}/${filename}.${ext}\`;` 改为 `const path = \`${familyId}/${memoryId}/${filename}.${ext}\`;`。

调用处（约 line 494-506）把取 userId 改为取 familyId：

```tsx
      // Upload media files (fire-and-forget, don't block save)
      const familyId = await getMyFamilyId();

      if (type === 'photo' && photos.length > 0) {
        photos.forEach((uri, i) => {
          uploadToStorage(uri, familyId, memoryId, `photo_${i}`);
        });
      } else if (type === 'video' && videoUri) {
        uploadToStorage(videoUri, familyId, memoryId, 'video_0');
      } else if (type === 'voice' && recordingUriRef.current) {
        uploadToStorage(recordingUriRef.current, familyId, memoryId, 'audio_0');
      }
```

在 RecordFlow.tsx 顶部 import 里，从 `'../data'` 追加 `getMyFamilyId`（确认 `import { ... } from '../data';` 那行加上它；现有是 `import { PERSPECTIVES, meName, NOW_YM } from '../data';` → 改为 `import { PERSPECTIVES, meName, NOW_YM, getMyFamilyId } from '../data';`）。

> 注：`src/data/index.ts` 的导出会被 `src/data/index.ts` 重新 export；若 RecordFlow 现在从 `'../data'`（即 `src/data/index.ts`）导入则直接可用。确认 import 路径与现有一致。

- [ ] **Step 2: media.ts 读取改用 familyId**

把 `fetchMemoryMedia` 里：

```ts
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const dir = `${session.user.id}/${memoryId}`;
```

改为：

```ts
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const familyId = await getMyFamilyId();
  if (!familyId) return [];
  const dir = `${familyId}/${memoryId}`;
```

并在 media.ts 顶部加 `import { getMyFamilyId } from '../data';`。

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/screens/RecordFlow.tsx src/lib/media.ts
git commit -m "feat(media): store & read memory media under \${familyId} for family sharing"
```

---

## Task 6: 引导分叉（创建建家 / 加入家庭），删死的 JoinFlow

**Files:**
- Modify: `src/screens/Onboarding.tsx`
- Modify: `src/screens/InviteFlow.tsx`（删除 `export function JoinFlow`）
- Modify: `App.tsx`（删 `JoinFlow` import 与 `Join` 路由）

- [ ] **Step 1: Onboarding 顶部引入 createFamily/joinFamily**

把 `const { addKid, updateMe } = useData();` 改为：

```tsx
  const { addKid, createFamily, joinFamily } = useData();
```

- [ ] **Step 2: WelcomeStep 增加「加入」次要入口**

把 `WelcomeStep` 的签名改为 `function WelcomeStep({ onNext, onJoin })`，并在 `<CTA label="好，开始吧" ... />` 之后、组件 `</>` 之前加一段次要入口（放在 CTA 内的 hint 下方不好塞，单独加在 CTA 外层 View 里——直接在 `<CTA .../>` 后追加）：

```tsx
      <TouchableOpacity onPress={onJoin} activeOpacity={0.7} style={{ paddingBottom: 24, alignItems: 'center' }}>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.inkSoft }}>
          已经有家人在用了？<Text style={{ color: theme.accent }}>输入邀请码加入</Text>
        </Text>
      </TouchableOpacity>
```

（`theme` 已在 `WelcomeStep` 里通过 `useTheme()` 拿到。）

- [ ] **Step 3: 新增「加入」两步组件**

在 `DoneStep` 之后、`OnboardingScreen` 之前插入两个组件：

```tsx
/* ── Join step A: 邀请码 ── */
function JoinCodeStep({ code, onChange, onNext }) {
  const { theme } = useTheme();
  const ok = code.trim().length > 0;
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 6 }}>
        <Text style={{ fontFamily: theme.fonts.hand, fontSize: 17, color: theme.accent, marginBottom: 8 }}>加入家人的家</Text>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 27, lineHeight: 38, color: theme.ink }}>输入邀请码</Text>
        <Text style={{ marginTop: 12, fontSize: 15, lineHeight: 28, color: theme.inkSoft }}>
          家人在「邀请家人」里能看到这串口令。
        </Text>
        <TextInput
          value={code}
          onChangeText={(t) => onChange(t.toUpperCase())}
          placeholder="邀请码"
          placeholderTextColor={theme.inkSoft}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          style={{
            marginTop: 22, width: '100%',
            borderWidth: 1.5, borderColor: theme.line, borderRadius: 18,
            paddingVertical: 16, paddingHorizontal: 17,
            backgroundColor: theme.paper, color: theme.ink,
            fontFamily: theme.fonts.head, fontSize: 20, letterSpacing: 3, textAlign: 'center',
          }}
        />
      </ScrollView>
      <CTA label="下一步" onPress={onNext} disabled={!ok} />
    </>
  );
}

/* ── Join step B: 选自己的角色（孩子叫你什么）── */
function JoinRoleStep({ value, onChange, onEnter, loading }) {
  const { theme } = useTheme();
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 6 }}>
        <Text style={{ fontFamily: theme.fonts.head, fontSize: 27, lineHeight: 38, color: theme.ink }}>孩子叫你什么？</Text>
        <Text style={{ marginTop: 12, fontSize: 15, lineHeight: 28, color: theme.inkSoft }}>
          这个是你自己的角色，选一次就好。
        </Text>
        <View style={{ marginTop: 26, flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
          {ROLES.map(r => {
            const on = value === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => onChange(r)}
                activeOpacity={0.7}
                style={{
                  width: (SCREEN_W - 48 - 11) / 2,
                  paddingVertical: 20, borderRadius: 20, alignItems: 'center',
                  backgroundColor: on ? theme.accent : theme.paper,
                  borderWidth: 1.5, borderColor: on ? theme.accent : theme.line,
                }}
              >
                <Text style={{ fontFamily: theme.fonts.head, fontSize: 19, color: on ? '#FFFDF7' : theme.ink }}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <CTA label={loading ? '加入中...' : (value ? `我是${value}，加入` : '选一个')} onPress={onEnter} disabled={!value || loading} />
    </>
  );
}
```

- [ ] **Step 4: OnboardingScreen 支持两种模式**

把 `OnboardingScreen` 整体替换为：

```tsx
export default function OnboardingScreen({ navigation }) {
  const { addKid, createFamily, joinFamily } = useData();
  const { theme } = useTheme();

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [page, setPage] = useState<typeof FLOW[number]>('welcome');
  const [joinStep, setJoinStep] = useState<'code' | 'role'>('code');
  const [me, setMe] = useState('');
  const [code, setCode] = useState('');
  const [child, setChild] = useState({ name: '', y: 2021, m: 3 });
  const [saving, setSaving] = useState(false);

  const idx = FLOW.indexOf(page);
  const next = () => setPage(FLOW[Math.min(FLOW.length - 1, idx + 1)]);

  // 创建路径：建家 → 镜像角色 → 加孩子 → 进首页
  const enter = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await createFamily(me, '');
      await persistMe({ role: me, custom: '' });
      await addKid({ name: child.name.trim(), y: child.y, m: child.m, tone: 'orange' });
      navigation.replace('Home');
    } catch (e: any) {
      console.error('Onboarding create error:', e);
      Alert.alert('保存失败', '请检查网络后重试');
      setSaving(false);
    }
  };

  // 加入路径：redeem → 镜像角色 → 进首页
  const doJoin = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await joinFamily(code.trim(), me, '');
      await persistMe({ role: me, custom: '' });
      navigation.replace('Home');
    } catch (e: any) {
      const msg = e?.message || '';
      const hint = msg.includes('invalid_code') ? '邀请码不对，请再确认一下'
        : msg.includes('already_in_family') ? '你已经在一个家里了'
        : '请检查网络后重试';
      Alert.alert('加入失败', hint);
      setSaving(false);
    }
  };

  const startJoin = () => { setMode('join'); setJoinStep('code'); };
  const back = () => {
    if (mode === 'join') {
      if (joinStep === 'role') { setJoinStep('code'); return; }
      setMode('create'); setPage('welcome'); return;
    }
    if (idx > 0) setPage(FLOW[idx - 1]);
  };
  const showBack = mode === 'join' || idx > 0;

  const body = (() => {
    if (mode === 'join') {
      if (joinStep === 'code') return <JoinCodeStep code={code} onChange={setCode} onNext={() => setJoinStep('role')} />;
      return <JoinRoleStep value={me} onChange={setMe} onEnter={doJoin} loading={saving} />;
    }
    switch (page) {
      case 'welcome': return <WelcomeStep onNext={next} onJoin={startJoin} />;
      case 'me': return <MeStep value={me} onChange={setMe} onNext={next} />;
      case 'child': return <ChildStep child={child} onChange={setChild} onNext={next} />;
      case 'done': return <DoneStep me={me} child={child} onEnter={enter} loading={saving} />;
      default: return null;
    }
  })();

  // 进度点只在创建路径显示；加入路径不显示
  const barPage = mode === 'join' ? 'welcome' : page;

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <TopBar onBack={showBack ? back : null} page={barPage} />
      <View style={{ flex: 1 }}>
        {body}
      </View>
    </View>
  );
}
```

> 说明：加入路径用 `barPage='welcome'`（不在 STEP_PAGES 里）→ TopBar 不显示进度点，符合「加入不是建家那套步骤」。

- [ ] **Step 5: 删除死的 JoinFlow + Join 路由**

在 `src/screens/InviteFlow.tsx` 删除整段 `export function JoinFlow(...) { ... }`（line ~207 到文件末尾的该函数）。

在 `App.tsx`：
- 把 `import InviteFlow, { JoinFlow } from './src/screens/InviteFlow';` 改为 `import InviteFlow from './src/screens/InviteFlow';`
- 删除 `<Stack.Screen name="Join" component={JoinFlow} />` 一行。

- [ ] **Step 6: 类型检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/screens/Onboarding.tsx src/screens/InviteFlow.tsx App.tsx
git commit -m "feat(onboarding): split create-family vs join-by-code; remove dead JoinFlow"
```

---

## Task 7: InviteFlow 用真实邀请码 + 真实花名册 + 创建者移除成员

**Files:**
- Modify: `src/screens/InviteFlow.tsx`

- [ ] **Step 1: 顶部取 family**

在 `export default function InviteFlow(...)` 里，把
`const familyMembers = ['爸爸'];` 和 `const inviteCode = 'YIBAI-2026-A3K7';` 删掉，改成从 useData 读：

```tsx
  const { family, removeMember } = useData();
  const inviteCode = family?.inviteCode || '——';
  const members = family?.members || [];
  const isCreator = family?.isCreator;
```

（`useData` 已在文件顶部 import。）

- [ ] **Step 2: 主屏「已加入」列表用真实成员**

把主屏（最后那个 return）里渲染 `familyMembers.map(...)` 的那段：

```tsx
          {familyMembers.map(role => (
            <InvMemberRow key={role} role={role} theme={theme} />
          ))}
```

替换为：

```tsx
          {members.map(m => (
            <InvMemberRow
              key={m.userId}
              role={m.role === '其他' ? (m.customRole || '家人') : m.role}
              theme={theme}
              canRemove={isCreator && !m.isMe}
              onRemove={() => removeMember(m.userId)}
            />
          ))}
```

- [ ] **Step 3: InvMemberRow 支持移除按钮**

把 `InvMemberRow` 组件替换为：

```tsx
function InvMemberRow({ role, canRemove = false, onRemove = null, theme }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: theme.line,
    }}>
      <InvAvatar label={role} tone="orange" size={40} theme={theme} />
      <Text style={{ flex: 1, fontFamily: theme.fonts.head, fontSize: 16, color: theme.ink }}>{role}</Text>
      {canRemove ? (
        <TouchableOpacity
          onPress={() => Alert.alert('移除成员', `把 ${role} 移出这个家？`, [
            { text: '取消', style: 'cancel' },
            { text: '移除', style: 'destructive', onPress: onRemove },
          ])}
          activeOpacity={0.7}
        >
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.danger || '#C2553D' }}>移除</Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.inkSoft }}>已加入</Text>
      )}
    </View>
  );
}
```

- [ ] **Step 4: 分享屏「邀请家人加入」直接到 share，去掉预选角色的 who 步骤；复制码即可**

把主屏 `PrimaryButton` 的 `onPress={() => setStep('who')}` 改为 `onPress={() => setStep('share')}`。

`share` 屏里：标题 `邀请{selectedRole || '家人'}加入` 改为 `邀请家人加入`；邀请码区域已用 `{inviteCode}`（Step 1 已是真实值，无需再改）。三个分享项的 `onPress`（目前都弹「马上就好」）保留；其中第一项 `link` 的文案 `复制邀请链接` 可留，但点了仍弹提示——**v1 不接真实剪贴板**（避免引入原生 expo-clipboard 触发 dev-client 重建，违反 no-restart 约定）。邀请码本身已大字显示供口头/手输。

> `who` 这一步（预选受邀者角色）整段可保留不调用，或删除以减面；删除时把 `if (step === 'who') { ... }` 整块删掉、`availableRoles` 相关删掉。建议删除。

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/screens/InviteFlow.tsx
git commit -m "feat(invite): real invite code + member roster + creator-only remove"
```

---

## Task 8: Settings 口令区显示真实邀请码 + 真实花名册

**Files:**
- Modify: `src/screens/Settings.tsx`（`InviteSheet` ~691）

- [ ] **Step 1: InviteSheet 读真实 family**

在 `function InviteSheet({ kids, me, onClose })` 体内开头，把 `const code = 'JIA · 7K2P';` 改为从 useData 读：

```tsx
  const { family } = useData();
  const code = family?.inviteCode || '——';
```

（确认 `Settings.tsx` 顶部已 `import { useData } from '../data/DataProvider';`；若无则加。）

- [ ] **Step 2: 花名册用真实成员**

把 `InviteSheet` 里从 `let adults;`（line ~700）一直到 `const peopleCount = adults.length + kids.length;`（line ~714）**整段**替换为来自 family（务必把原来的 `const peopleCount` 那一行也一起替换掉，否则会重复声明 `peopleCount` 导致 tsc 报错）。原本它上面的 `myName` / `myChar` / `isParent`（~697-699）保留不动：

```tsx
  const adults = (family?.members || []).map(m => {
    const nm = m.role === '其他' ? (m.customRole || '家人') : m.role;
    return {
      ch: nm[nm.length - 1],
      name: nm,
      role: m.isMe ? '你' + (family?.isCreator ? ' · 管理员' : '') : '家长',
    };
  });
  const peopleCount = adults.length + kids.length;
```

> 若 family 为空（理论上进到这页时一定有家），`adults` 为 `[]`，不报错。

- [ ] **Step 3: 复制按钮文案对齐（仍不接真实剪贴板）**

把复制按钮文案 `复制邀请链接` / `链接已复制` 改为 `记下邀请码` / `已记下`（因为 v1 不接剪贴板，避免「复制了但没真复制」的误导）：

在该 `TouchableOpacity` 内 `{copied ? '链接已复制' : '复制邀请链接'}` 改为 `{copied ? '已记下' : '记下邀请码'}`。

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/Settings.tsx
git commit -m "feat(settings): show real family invite code + roster in invite sheet"
```

---

## Task 9: 两账号端到端联调（真实 RLS / 媒体共享验证）

> 这是验证「真共享」的关键。psql 绕过 RLS，只有 App 走 PostgREST 带 JWT 才会触发 RLS。需要两个账号（爸爸、妈妈），用 `/run` 跑起 App（或在两个模拟器/设备上）。

**Files:** 无（纯验证）

- [ ] **Step 1: 爸爸建家**

用 `/run` 启动 App。账号 A（游客或邮箱注册）→ 引导走「创建」：选角色（爸爸）→ 填孩子（如「小满」2021-03）→ 进首页。记一条**带照片**的回忆。
进入「家庭成员」（Drawer → 邀请 / 或 Settings 邀请区）记下**真实邀请码**。
Expected: 首页有孩子，回忆里照片能正常显示；邀请码是 8 位、非 `YIBAI-2026-A3K7` 那种硬编码。

- [ ] **Step 2: 妈妈加入**

账号 B（另一个游客/邮箱）→ 引导点「输入邀请码加入」→ 输入 Step 1 的邀请码 → 选角色（妈妈）→ 进首页。
Expected:
- 看到**同一个孩子**「小满」。
- 看到爸爸记的那条回忆，且**照片能签名显示**（验证媒体 familyId 共享 RLS）。
- 花名册显示 爸爸 + 妈妈。

- [ ] **Step 3: 反向共享 + 小熊**

妈妈记一条带照片的回忆 → 切回爸爸账号刷新，能看到。
任一方喂养小熊（记录使其成长）→ 另一方看到的是**同一只**（stage/grown 一致）。

- [ ] **Step 4: 权限边界**

- 妈妈侧：尝试删孩子 → 应被拒/无入口（`kids_creator_delete` 只允许创建者）。
- 爸爸侧（创建者）：在「家庭成员」可移除妈妈；移除后妈妈刷新应看不到该家数据（回到零孩子→被弹回引导）。
- 错误码：用错误邀请码加入 → 提示「邀请码不对」；已在家的账号再加入 → 提示「你已经在一个家里了」。

- [ ] **Step 5: 记录验证结果**

把上述每条的实际结果记到 PR 描述或这份 plan 的勾选框。任何一条失败 → 用 superpowers:systematic-debugging 排查，常见坑：
- 照片看不到 = 媒体 storage 策略或上传/读取路径没统一用 familyId（Task 1 §9 / Task 5）。
- 妈妈看不到孩子 = 内容表 RLS 没用 `my_family_id()`，或 `getMyFamilyId()` 缓存没在切账号时清（Task 4 Step 2 的 `clearFamilyCache()`）。

---

## Self-Review（已对照 spec）

- **§3 数据模型** → Task 1 全覆盖（families/family_members/family_id/主键/profiles 不变）。
- **§4 安全/RLS/邀请/媒体** → Task 1（my_family_id、is_family_creator、create_family、redeem_invite、各表 RLS、storage 策略）。
- **§5 App 流程** → Task 6（引导分叉、删 JoinFlow）、Task 7（InviteFlow）、Task 8（Settings）。
- **§6 数据层** → Task 2（helpers）、Task 3（insert 带 family_id + ★ 按家庭）、Task 4（DataProvider）、Task 5（媒体路径）。角色镜像 = Task 6 的 `persistMe` 在建家/加入后调用。
- **§7 范围** → 二维码/微信、剪贴板、多家庭、退出家庭 均未纳入（Task 7 Step 4 / Task 8 Step 3 明确说明剪贴板不做）。
- **类型一致性**：`family` 形状 `{ id, inviteCode, isCreator, members:[{userId, role, customRole, isMe}] }` 在 Task 2 定义，Task 4/7/8 一致引用；`getMyFamilyId` / `createFamily` / `joinFamily` / `removeFamilyMember`（data 层）↔ `createFamily` / `joinFamily` / `removeMember`（DataProvider 动作名）命名差异已在 Task 4 用 `apiCreateFamily` 别名区分，无冲突。
- **已知 caveat**（spec §8 已记）：创建者删账号会 CASCADE 掉整个家的数据 —— Task 1 §10 注释标注。
