# Supabase Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded mock data with a self-hosted Supabase backend and add email/password authentication.

**Architecture:** Self-hosted Supabase (Docker Compose) provides Postgres, PostgREST API, and GoTrue auth. A React Context (`DataProvider`) fetches all data on auth and exposes it plus bound helper functions via a `useData()` hook, minimizing screen-level changes. Email/password login is added to the existing "其他方式登录" bottom sheet.

**Tech Stack:** Supabase (self-hosted via Docker), `@supabase/supabase-js`, React Context, Expo 56 / React Native

**Spec:** `docs/superpowers/specs/2026-06-09-supabase-integration-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase-docker/` | Cloned from official `supabase/supabase` repo's `docker/` directory |
| `supabase-docker/volumes/db/init/schema.sql` | Table creation + RLS + triggers |
| `supabase-docker/volumes/db/init/seed.sql` | Seed data for `levels` and `wardrobe` tables |
| `scripts/seed-demo-user.sh` | Creates a demo user via GoTrue API and inserts user-specific seed data |
| `src/lib/supabase.ts` | Supabase client initialization |
| `src/lib/auth.ts` | Auth helper functions (signIn, signUp, signOut, onAuthChange) |
| `src/data/DataProvider.tsx` | React Context provider + `useData()` hook |
| `src/screens/EmailLogin.tsx` | Email/password login & registration screen |

### Modified Files

| File | Change |
|------|--------|
| `package.json` | Add `@supabase/supabase-js` |
| `.gitignore` | Add `supabase-docker/.env`, `supabase-docker/volumes/db/data` |
| `src/data/index.ts` | Remove hardcoded arrays, add async fetch functions with DB→JS mapping, keep pure utilities |
| `src/utils/storage.ts` | Replace AsyncStorage with Supabase profile operations |
| `src/screens/Login.tsx` | Add "邮箱" icon to social login bottom sheet |
| `App.tsx` | Auth session check, DataProvider wrapper, EmailLogin route, loading state |
| All screen files | Replace `import { X } from '../data'` with `const { X } = useData()` for data-dependent imports |

### Import Migration Strategy

Imports from `src/data/index.ts` split into two categories after migration:

**Stay as direct imports** (pure constants/functions with no data dependency):
`PERSPECTIVES`, `FAMILY`, `ROLES`, `DEFAULT_ME`, `NOW_YM`, `PET_BODY`, `meName()`, `meChar()`, `durationSince()`, `nowCtx()`, `suitsNow()`, `kidAge()`

**Move to `useData()` hook** (depend on Supabase data):
`levels`, `kids`, `memories`, `mascots`, `wardrobe`, `customLevels`, `profile`, `getKid()`, `kidLabel()`, `kidDone()`, `memoriesForKid()`, `allLevels()`, `getMascot()`, `wardrobeState()`, `nextUnlock()`, `throwback()`, `yearReview()`, `frameLabel()`, `levelWeight()`, `weightedShuffle()`, `addCustomLevel()`

---

## Task 1: Deploy Self-Hosted Supabase

**Files:**
- Create: `supabase-docker/` (cloned from official repo)
- Modify: `.gitignore`

- [ ] **Step 1: Clone Supabase docker setup**

```bash
cd /home/coder/workspaces/yibai
git clone --depth 1 https://github.com/supabase/supabase /tmp/supabase-repo
cp -r /tmp/supabase-repo/docker ./supabase-docker
rm -rf /tmp/supabase-repo
```

- [ ] **Step 2: Generate secrets and configure .env**

```bash
cd /home/coder/workspaces/yibai/supabase-docker
cp .env.example .env
```

Generate a JWT secret and the two JWT keys (anon + service_role). Use Node.js to generate:

```bash
# Generate a random JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "Generated JWT_SECRET: $JWT_SECRET"

# Generate ANON_KEY (role: anon)
ANON_KEY=$(node -e "
const crypto = require('crypto');
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  role:'anon',
  iss:'supabase',
  iat:Math.floor(Date.now()/1000),
  exp:Math.floor(Date.now()/1000)+10*365*24*3600
})).toString('base64url');
const sig = crypto.createHmac('sha256','$JWT_SECRET').update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
")
echo "Generated ANON_KEY: $ANON_KEY"

# Generate SERVICE_ROLE_KEY (role: service_role)
SERVICE_KEY=$(node -e "
const crypto = require('crypto');
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  role:'service_role',
  iss:'supabase',
  iat:Math.floor(Date.now()/1000),
  exp:Math.floor(Date.now()/1000)+10*365*24*3600
})).toString('base64url');
const sig = crypto.createHmac('sha256','$JWT_SECRET').update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
")
echo "Generated SERVICE_KEY: $SERVICE_KEY"

# Generate a random Postgres password
POSTGRES_PASSWORD=$(openssl rand -base64 24)
```

Now update the `.env` file with these values. The key variables to set:

```
POSTGRES_PASSWORD=<generated>
JWT_SECRET=<generated>
ANON_KEY=<generated ANON_KEY>
SERVICE_ROLE_KEY=<generated SERVICE_KEY>
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=supabase
SITE_URL=http://localhost:8081
API_EXTERNAL_URL=http://localhost:8000
```

Use `sed` to replace each value in the `.env` file, or edit directly.

- [ ] **Step 3: Start Supabase**

```bash
cd /home/coder/workspaces/yibai/supabase-docker
docker compose pull
docker compose up -d
```

Wait for all services to be healthy:

```bash
docker compose ps
```

Expected: all services show "Up" or "healthy".

- [ ] **Step 4: Verify Studio is accessible**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000
```

Expected: `200` or `401` (Kong is responding).

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

Expected: `200` (Studio is accessible).

- [ ] **Step 5: Update .gitignore**

Add to `.gitignore`:

```
supabase-docker/.env
supabase-docker/volumes/db/data/
supabase-docker/volumes/storage/
```

- [ ] **Step 6: Commit**

```bash
git add .gitignore
git commit -m "chore: add supabase-docker gitignore entries"
```

Note: Do NOT commit the `supabase-docker/` directory itself — it's cloned infrastructure, not app code.

---

## Task 2: Create Database Schema and Seed Data

**Files:**
- Create: `supabase-docker/volumes/db/init/schema.sql`
- Create: `supabase-docker/volumes/db/init/seed.sql`
- Create: `scripts/seed-demo-user.sh`

- [ ] **Step 1: Write schema.sql**

Create `supabase-docker/volumes/db/init/schema.sql`:

```sql
-- ════════════════════════════════════════════════
-- 一百件事 — Database Schema
-- ════════════════════════════════════════════════

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

-- 4. kids
CREATE TABLE IF NOT EXISTS public.kids (
  id          TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  birth_year  INT NOT NULL,
  birth_month INT NOT NULL,
  tone        TEXT NOT NULL DEFAULT 'orange',
  bear        TEXT NOT NULL DEFAULT '',
  since       TEXT NOT NULL DEFAULT '',
  accessories TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, user_id)
);

ALTER TABLE public.kids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_own" ON public.kids
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. memories
CREATE TABLE IF NOT EXISTS public.memories (
  id          TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memories_own" ON public.memories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. mascots
CREATE TABLE IF NOT EXISTS public.mascots (
  kid_id  TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  tone    TEXT NOT NULL DEFAULT 'orange',
  since   TEXT NOT NULL DEFAULT '',
  stage   INT NOT NULL DEFAULT 1,
  grown   INT NOT NULL DEFAULT 0,
  items   JSONB NOT NULL DEFAULT '[]',
  log     JSONB NOT NULL DEFAULT '[]',
  PRIMARY KEY (kid_id, user_id)
);

ALTER TABLE public.mascots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mascots_own" ON public.mascots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. custom_levels
CREATE TABLE IF NOT EXISTS public.custom_levels (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE POLICY "custom_levels_own" ON public.custom_levels
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Trigger: auto-create profile on user sign-up
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
```

- [ ] **Step 2: Write seed.sql for public data**

Create `supabase-docker/volumes/db/init/seed.sql`:

```sql
-- ════════════════════════════════════════════════
-- Seed: levels (20 activities from LEVELS array)
-- ════════════════════════════════════════════════

INSERT INTO public.levels (num, perspective, tone, title, why, how, record, suggest, sealed, seal_until, sealed_on, seasonal, kid, sort_order) VALUES
('03','parent','orange','讲一个你小时候做过的最蠢的事','他会用一种新的眼光看你，那是他第一次意识到——爸爸妈妈也曾经是个孩子。','找一个轻松的晚上，吃完饭赖在沙发上的时候，自然地讲起。不用铺垫，越具体越好。','录下孩子听完之后的反应。那一段笑声，未来值很多钱。','voice',false,NULL,NULL,false,NULL,1),
('07','together','green','一起做一顿「完全失败也没关系」的饭','让孩子看到你对失败的态度，比任何说教都有用。','选一道你也没做过的菜，故意不查太多攻略，全程让孩子参与，包括打翻的那部分。','拍下成品，不管多丑。再录一段你们当时手忙脚乱的对话。','photo',false,NULL,NULL,false,NULL,2),
('12','parent','pink','给 18 岁的他/她写一封信','你今天写下的话，会在他成年那天被印出来，寄到家里。','找一个安静的夜晚，手写或打字都行。写你现在最想让那时的他知道的事。','信封会被封存，等待开启的那天。在那之前，谁也看不到。','text',true,'朵朵 18 岁生日那天','2026 年 5 月 12 日',false,'duo',3),
('21','child','green','让孩子教你一件他擅长、你不会的事','被需要、被请教，是孩子第一次尝到「我也能照顾你」的滋味。','认真当一回学生。游戏、折纸、某个 App 怎么用都行，让他当一次老师。','让孩子说一句「今天你学得怎么样」，录下来。','voice',false,NULL,NULL,false,NULL,4),
('05','together','orange','在同一个地方，每年拍一张一模一样的合照','同一个角度、同一个姿势，时间会替你们说话。','选一个对你们有意义的地方，记下机位。明年的今天，再来一次。','今年这张，会和往年的并排放在一起。','photo',false,NULL,NULL,false,NULL,5),
('09','child','pink','让孩子带你逛一次他眼中「好玩的地方」','你会发现，他眼里的世界和你以为的完全不一样。','把决定权完全交给他。路线、停留多久、看什么，都听他的。','记下一件他带你看、而你从没注意过的小东西。','text',false,NULL,NULL,false,NULL,6),
('18','together','orange','把手机关掉，一起看完一次完整的日落','什么都不做地待在一起，本身就是一件值得做的事。','提前查好日落时间，提早十分钟到。然后，只是看着。','天黑之后再拍一张你们的剪影就好。','photo',false,NULL,NULL,false,NULL,7),
('15','together','green','一起种一棵会比他长得慢的树','很多年后，树和孩子都长大了，他会记得是谁陪他埋下第一铲土。','挑一棵当地能活很久的树苗。让孩子负责浇第一次水。','给小树苗拍张照，旁边放上孩子的手作对比。','photo',false,NULL,NULL,true,NULL,8),
('02','parent','green','把他出生那天的故事，完整讲一遍','每个孩子都想知道自己来到世上的那一天，到底发生了什么。','从天气、你的心情、当时的兵荒马乱讲起。哪怕细节记不全，情绪是真的。','录成一段语音，留到他长大那天再听。','voice',false,NULL,NULL,false,NULL,9),
('08','parent','orange','带他回你长大的那条街走一走','让他踩一踩你小时候踩过的路，故事就有了落脚的地方。','指给他看你上学的路、第一次摔跤的拐角、买零食的小店还在不在。','在你小时候常待的地方，拍一张你们俩的合照。','photo',false,NULL,NULL,false,NULL,10),
('14','parent','pink','认真回答他问过、你当时敷衍掉的一个问题','孩子记得你哪次没好好听。补上一次，胜过十次说教。','想想他最近问过什么被你「等一下」掉的问题，主动找他，好好说一次。','写下你重新回答的那句话，和他听完的表情。','text',false,NULL,NULL,false,NULL,11),
('23','parent','green','把你的一个小本领，正式「传」给他','吹口哨、打一个绳结、煎一个蛋——被郑重交付的东西，孩子会记一辈子。','挑一件你会、他还不会的小事。慢一点，让他自己试到成功为止。','录下他第一次成功时那声欢呼。','voice',false,NULL,NULL,false,NULL,12),
('29','parent','orange','为他做一顿「你小时候最爱吃的饭」','味道是会遗传的记忆。你爱的那一口，也许会变成他想家的味道。','复刻一道你童年的家常菜，边做边讲它的来历。','拍下那盘菜，写一句它对你意味着什么。','photo',false,NULL,NULL,false,NULL,13),
('11','child','orange','让孩子给你画一张「你的样子」','在孩子的笔下，你才能看到自己在他心里到底什么样。','什么都别提示，让他自由画。画歪了、画丑了，都不要纠正。','把这张画拍下来，写上日期收好。','photo',false,NULL,NULL,false,NULL,14),
('17','child','green','让孩子安排一次「他说了算」的周末','把方向盘交给他一次，他会忽然长大一点点。','预算和安全你把关，其余全听他的：去哪、吃什么、几点睡。','录一句他当「小队长」时下的命令。','voice',false,NULL,NULL,false,NULL,15),
('25','child','pink','让孩子照顾你一次（你假装生病也行）','被照顾惯了的孩子，需要一次「我来保护你」的机会。','让他给你倒杯水、盖个毯子。认真接受他的照顾，别笑场。','写下他照顾你时说的那句最暖的话。','text',false,NULL,NULL,false,NULL,16),
('31','child','orange','请孩子给你推荐一首「他最近最爱的歌」','走进他的世界，从认真听他喜欢的东西开始。','让他放给你听，听完认真说说你的感受，别评判。','把歌名记下来，写一句你听完的想法。','text',false,NULL,NULL,false,NULL,17),
('04','together','pink','一起给未来的自己埋一个「时间胶囊」','约定一个开启的日子，从此你们之间就有了一个共同的秘密。','各自写一张纸条、放一件小东西，封进盒子，定好几年后再开。','拍下封箱那一刻，记下约定开启的日期。','photo',true,'2031 年的春天','2026 年 4 月 6 日',false,'all',18),
('13','together','green','一起在雨天，故意出门踩一次水坑','允许一次「弄湿弄脏」，是给孩子最痛快的爱。','穿上不怕脏的鞋，挑最大的那个水坑，一起踩下去。','拍一张溅起水花的瞬间。','photo',false,NULL,NULL,true,NULL,19),
('19','together','orange','一起完成一件需要等很久才有结果的事','等待本身就是一种陪伴：发豆芽、等月亮、看面团发起来。','挑一件需要耐心的小事，每天一起去看它一点点变化。','把第一天和最后一天的样子拍下来对比。','photo',false,NULL,NULL,false,NULL,20),
('27','together','pink','一起发明一个只属于你们的「暗号」','一个外人看不懂的小手势，会成为你们一生的默契。','一起设计一个动作或一句怪话，约定它代表「我爱你」。','录下你们第一次对暗号时的傻笑。','voice',false,NULL,NULL,false,NULL,21);

-- ════════════════════════════════════════════════
-- Seed: wardrobe (5 items)
-- ════════════════════════════════════════════════

INSERT INTO public.wardrobe (id, name, slot, at, line) VALUES
('scarf','小围巾','脖子',1,'围上了奶奶织的那条小围巾。'),
('star','星空小窝','场景',5,'它的小世界里，亮起了一整片星空。'),
('hat','小毛帽','头顶',12,'戴上了一顶它最爱的小毛帽。'),
('boat','小纸船','脚边',25,'脚边多了一只随时想出航的小纸船。'),
('kite','一只风筝','手里',45,'手里牵起了一只飞得很高的风筝。');
```

- [ ] **Step 3: Apply schema and seed to the running database**

If the schema and seed files were placed in `volumes/db/init/` BEFORE the first `docker compose up`, Postgres runs them automatically. If Supabase is already running, apply manually:

```bash
cd /home/coder/workspaces/yibai/supabase-docker

# Apply schema
docker compose exec db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/schema.sql

# Apply seed
docker compose exec db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/seed.sql
```

Verify:

```bash
docker compose exec db psql -U postgres -d postgres -c "SELECT count(*) FROM public.levels;"
```

Expected: `21`

```bash
docker compose exec db psql -U postgres -d postgres -c "SELECT count(*) FROM public.wardrobe;"
```

Expected: `5`

- [ ] **Step 4: Write demo user seed script**

Create `scripts/seed-demo-user.sh`. This script creates a demo user and populates their data. Read the `ANON_KEY` and `SERVICE_ROLE_KEY` from `supabase-docker/.env`.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../supabase-docker/.env"

# Read keys from .env
SERVICE_ROLE_KEY=$(grep '^SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d= -f2-)
API_URL="http://localhost:8000"

echo "Creating demo user..."
RESPONSE=$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@yibai.app","password":"demo123456","email_confirm":true}')

USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo "Failed to create user. Response: $RESPONSE"
  echo "User may already exist. Trying to fetch..."
  RESPONSE=$(curl -s "$API_URL/auth/v1/admin/users" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $SERVICE_ROLE_KEY")
  USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

echo "User ID: $USER_ID"

echo "Seeding user data..."
docker compose -f "$SCRIPT_DIR/../supabase-docker/docker-compose.yml" exec -T db \
  psql -U postgres -d postgres <<SQL

-- Kids
INSERT INTO public.kids (id, user_id, name, birth_year, birth_month, tone, bear, since, accessories) VALUES
('duo', '$USER_ID', '朵朵', 2019, 5, 'orange', '团子', '2026 年 3 月', '{scarf,star}'),
('man', '$USER_ID', '小满', 2022, 9, 'green', '糯米', '2026 年 4 月', '{hat}')
ON CONFLICT DO NOTHING;

-- Memories
INSERT INTO public.memories (id, user_id, kid_id, level_num, perspective, type, duration, shots, date, place, title, caption, transcript, tone) VALUES
('m1','$USER_ID','duo','03','parent','voice','0:48',NULL,'5 月 28 日','客厅沙发','爸爸偷穿奶奶高跟鞋的那年','朵朵听到一半笑到打嗝，说「爸爸你好蠢哦」——说这句话的时候，她眼睛是亮的。','那年我大概六岁吧，趁你太奶奶不在家，偷偷穿上她那双红色高跟鞋，在客厅里走来走去，结果一脚踩空摔了个屁股墩……（朵朵笑）哈哈哈爸爸你好蠢哦！……对啊，爸爸小时候也干过很多蠢事呢。','orange'),
('m2','$USER_ID','all','07','together','photo',NULL,4,'5 月 21 日','自家厨房','史上最咸番茄炒蛋','咸得离谱的一盘。朵朵皱着眉，小满却抢着吃了三口——这是我们家最热闹的一顿。',NULL,'green'),
('m8','$USER_ID','duo','14','together','video','0:31',NULL,'5 月 20 日','小区楼下空地','朵朵第一次甩掉辅助轮','镜头晃得厉害，因为我跟在后面跑。她回头喊「爸爸你松手啦」的那一秒，刚好被录下来了。',NULL,'orange'),
('m6','$USER_ID','man','11','child','photo',NULL,NULL,'5 月 18 日','茶几上','小满画的「妈妈」','三条腿，一头乱发，笑得很大。他说这就是最爱他的那个人。',NULL,'pink'),
('m3','$USER_ID','duo','09','child','text',NULL,NULL,'5 月 11 日','小区后面的土坡','她带我去看的「秘密基地」','原来那堵旧墙后面，藏着她和小伙伴攒了一整个春天的弹珠和瓶盖。',NULL,'pink'),
('m7','$USER_ID','man','02','parent','voice','0:53',NULL,'4 月 20 日','小满的小床边','讲小满出生那天的兵荒马乱','他听不太懂，只是一直盯着我笑。等他长大，这段录音会替我再讲一遍。','小满啊，你出生那天是个大雨天，凌晨三点妈妈说要生了，爸爸慌得鞋都穿反了……到医院又等了好久好久。等护士把你抱出来，那么小一团，我手都不敢碰。那一刻我才真的明白，从今往后我多了一个要保护一辈子的人。','green'),
('m4','$USER_ID','all','05','together','photo',NULL,3,'4 月 6 日','植物园门口那棵树下','第三年的同一张全家福','朵朵又长高了大半个头，小满第一次自己站着入镜。这棵树记得我们每一年的样子。',NULL,'orange'),
('m5','$USER_ID','duo','21','child','voice','1:12',NULL,'3 月 30 日','书桌前','她教我折一只会跳的青蛙','我折坏了四只。她特别耐心地说「没关系，再来一次嘛」——那是我常对她说的话。','爸爸你看，要这样对折，再往回翻……不对啦，你翻反了！（笑）没关系没关系，再来一次嘛。对，就是这样，按一下它的屁股它就会跳……你看你看它跳起来了！','green')
ON CONFLICT DO NOTHING;

-- Mascots
INSERT INTO public.mascots (kid_id, user_id, name, tone, since, stage, grown, items, log) VALUES
('duo','$USER_ID','团子','orange','2026 年 3 月',2,6,
 '[{"id":"scarf","name":"小围巾","from":"第 1 件事","got":true,"tone":"orange"},{"id":"star","name":"星空背景","from":"第 3 件事","got":true,"tone":"green"},{"id":"hat","name":"小毛帽","from":"第 5 件事","got":true,"tone":"pink"},{"id":"kite","name":"一只风筝","from":"第 8 件事","got":false,"tone":"orange"},{"id":"boat","name":"小纸船","from":"第 12 件事","got":false,"tone":"green"}]',
 '[{"text":"团子学会了第一次挥手","from":"你们一起看完日落那天"},{"text":"团子戴上了奶奶织的小围巾","from":"朵朵教你折青蛙那天"},{"text":"团子的世界里多了一片星空","from":"你讲童年糗事那天"}]'),
('man','$USER_ID','糯米','green','2024 年 10 月',1,3,
 '[{"id":"hat","name":"小毛帽","from":"第 1 件事","got":true,"tone":"green"},{"id":"scarf","name":"小围巾","from":"第 3 件事","got":true,"tone":"orange"},{"id":"star","name":"星空背景","from":"第 5 件事","got":false,"tone":"pink"},{"id":"kite","name":"一只风筝","from":"第 8 件事","got":false,"tone":"orange"}]',
 '[{"text":"糯米第一次睁开了眼睛","from":"你讲他出生那天的故事时"},{"text":"糯米收到了哥哥姐姐的小毛帽","from":"小满给你画画那天"}]')
ON CONFLICT DO NOTHING;

-- Custom levels
INSERT INTO public.custom_levels (user_id, num, title, why, how, record_hint, perspective, tone, suggest) VALUES
('$USER_ID','★1','每年除夕，全家包一次「奇形怪状」的饺子','这是只属于你们家的传统。写下来，它就不会被忘记。','','拍下那只最丑的饺子。','together','pink','photo')
ON CONFLICT DO NOTHING;

SQL

echo "Done! Demo user seeded."
echo "Login: demo@yibai.app / demo123456"
```

- [ ] **Step 5: Make script executable and run it**

```bash
chmod +x scripts/seed-demo-user.sh
./scripts/seed-demo-user.sh
```

Verify:

```bash
cd /home/coder/workspaces/yibai/supabase-docker
docker compose exec db psql -U postgres -d postgres -c "SELECT id, name FROM public.kids;"
```

Expected: 2 rows (朵朵, 小满).

- [ ] **Step 6: Commit**

```bash
git add supabase-docker/volumes/db/init/schema.sql supabase-docker/volumes/db/init/seed.sql scripts/seed-demo-user.sh
git commit -m "feat: add database schema, seed data, and demo user script"
```

---

## Task 3: Install Supabase Client and Create Library

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Install @supabase/supabase-js**

```bash
cd /home/coder/workspaces/yibai
npx expo install @supabase/supabase-js
```

- [ ] **Step 2: Create src/lib/supabase.ts**

Read the `ANON_KEY` from `supabase-docker/.env` first:

```bash
grep '^ANON_KEY=' supabase-docker/.env
```

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'http://localhost:8000';
const SUPABASE_ANON_KEY = '<paste the ANON_KEY value here>';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

Note: For physical device testing, replace `localhost` with the machine's LAN IP. For Expo web or emulator, `localhost` works.

- [ ] **Step 3: Verify the client initializes**

```bash
cd /home/coder/workspaces/yibai
npx tsc --noEmit src/lib/supabase.ts 2>&1 || true
```

No type errors related to the supabase client setup.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/supabase.ts
git commit -m "feat: add Supabase client library"
```

---

## Task 4: Create Auth Helpers

**Files:**
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Create src/lib/auth.ts**

```typescript
import { supabase } from './supabase';

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: add auth helper functions"
```

---

## Task 5: Refactor Data Layer

**Files:**
- Modify: `src/data/index.ts`

This is the largest refactor. The file keeps pure constants and functions, removes hardcoded data arrays, and adds async fetch functions with DB→JS column mapping.

- [ ] **Step 1: Rewrite src/data/index.ts**

Replace the entire file with:

```typescript
/* ════════════════════════════════════════════════════════════
   一百件事 — data layer (Supabase-backed)
   ════════════════════════════════════════════════════════════ */

import { supabase } from '../lib/supabase';

// ── Pure constants (no DB dependency) ──

export const PERSPECTIVES = {
  parent:   { key: 'parent',   label: '为你', long: '家长 → 孩子', hint: '我想为孩子做的事' },
  child:    { key: 'child',    label: '为我', long: '孩子 → 家长', hint: '孩子想为我做的事' },
  together: { key: 'together', label: '一起', long: '一起做',      hint: '我们一起完成的事' },
};

export const FAMILY = { id: 'all', name: '全家', tone: 'pink' };

export const ROLES = ['爸爸', '妈妈', '爷爷', '奶奶', '外公', '外婆'];
export const DEFAULT_ME = { role: '爸爸', custom: '' };

export const NOW_YM = { y: 2026, m: 6 };

export const PET_BODY = 3;

// ── Pure functions (no DB dependency) ──

export function meName(me) {
  if (!me) return '家长';
  return me.role === '其他' ? (me.custom || '我') : me.role;
}

export function meChar(me) {
  const n = meName(me);
  return (me && me.role !== '其他') ? n[n.length - 1] : n[0];
}

export function durationSince(sinceStr) {
  const match = sinceStr && sinceStr.match(/(\d+)\s*年\s*(\d+)\s*月/);
  if (!match) return '';
  const startY = parseInt(match[1], 10);
  const startM = parseInt(match[2], 10);
  const now = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1;
  const nowD = now.getDate();
  let years = nowY - startY;
  let months = nowM - startM;
  let days = nowD - 1;
  if (days < 0) {
    months--;
    days += new Date(nowY, nowM - 1, 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  const parts = [];
  if (years > 0) parts.push(`${years} 年`);
  if (months > 0) parts.push(`${months} 个月`);
  if (days > 0) parts.push(`${days} 天`);
  return parts.join(' ') || '刚刚开始';
}

export function kidAge(k) {
  if (!k || k.id === 'all') return null;
  return Math.max(0, NOW_YM.y - k.y - (NOW_YM.m < k.m ? 1 : 0));
}

export function nowCtx() {
  const d = new Date();
  const h = d.getHours(), wd = d.getDay(), m = d.getMonth() + 1;
  return {
    hour: h, weekend: wd === 0 || wd === 6, month: m,
    season: m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter',
    slot: h < 11 ? 'morning' : h < 14 ? 'noon' : h < 18 ? 'afternoon' : h < 21 ? 'evening' : 'night',
  };
}

export function suitsNow(l) {
  const ctx = nowCtx();
  if (l.custom) return '你们家自己的事';
  if (l.seasonal && (ctx.season === 'spring' || ctx.season === 'summer')) return '这个季节正合适';
  if ((ctx.slot === 'evening' || ctx.slot === 'night') && (l.suggest === 'voice' || l.suggest === 'text')) return '安静的晚上，适合慢慢说';
  if (ctx.weekend && l.suggest === 'photo') return '周末，适合出门做';
  if (ctx.slot === 'afternoon' && l.suggest === 'photo') return '光线正好，适合拍';
  return null;
}

// ── DB → JS column mappers ──

function mapLevel(row) {
  return {
    num: row.num, perspective: row.perspective, tone: row.tone,
    title: row.title, why: row.why, how: row.how, record: row.record,
    suggest: row.suggest, sealed: row.sealed, sealUntil: row.seal_until,
    sealedOn: row.sealed_on, seasonal: row.seasonal, kid: row.kid,
  };
}

function mapMemory(row) {
  return {
    id: row.id, kid: row.kid_id, levelNum: row.level_num,
    perspective: row.perspective, type: row.type, dur: row.duration,
    shots: row.shots, date: row.date, place: row.place, title: row.title,
    caption: row.caption, transcript: row.transcript, tone: row.tone,
  };
}

function mapKid(row) {
  return {
    id: row.id, name: row.name, y: row.birth_year, m: row.birth_month,
    tone: row.tone, bear: row.bear, since: row.since, acc: row.accessories,
  };
}

function mapMascot(row) {
  return {
    kid: row.kid_id, name: row.name, tone: row.tone, since: row.since,
    stage: row.stage, grown: row.grown, items: row.items, log: row.log,
  };
}

function mapCustomLevel(row) {
  return {
    num: row.num, perspective: row.perspective, tone: row.tone, custom: true,
    title: row.title, why: row.why, how: row.how, record: row.record_hint,
    suggest: row.suggest,
  };
}

function mapWardrobe(row) {
  return { id: row.id, name: row.name, slot: row.slot, at: row.at, line: row.line };
}

// ── Async fetch functions ──

export async function fetchLevels() {
  const { data, error } = await supabase.from('levels').select('*').order('sort_order');
  if (error) throw error;
  return (data || []).map(mapLevel);
}

export async function fetchKids() {
  const { data, error } = await supabase.from('kids').select('*');
  if (error) throw error;
  return (data || []).map(mapKid);
}

export async function fetchMemories() {
  const { data, error } = await supabase.from('memories').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapMemory);
}

export async function fetchMascots() {
  const { data, error } = await supabase.from('mascots').select('*');
  if (error) throw error;
  const obj = {};
  (data || []).forEach(row => { obj[row.kid_id] = mapMascot(row); });
  return obj;
}

export async function fetchWardrobe() {
  const { data, error } = await supabase.from('wardrobe').select('*').order('at');
  if (error) throw error;
  return (data || []).map(mapWardrobe);
}

export async function fetchCustomLevels() {
  const { data, error } = await supabase.from('custom_levels').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapCustomLevel);
}

export async function insertCustomLevel({ title, why = '', perspective = 'together', tone = 'pink', suggest = 'photo' }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { data: existing } = await supabase.from('custom_levels').select('id').eq('user_id', session.user.id);
  const num = '★' + ((existing?.length || 0) + 1);
  const { data, error } = await supabase.from('custom_levels').insert({
    user_id: session.user.id,
    num, title, perspective, tone, suggest,
    why: why || '这是你们家自己的事，记下来就不会忘。',
    how: '', record_hint: '',
  }).select().single();
  if (error) throw error;
  return mapCustomLevel(data);
}

export async function fetchProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(fields) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase.from('profiles').update(fields).eq('id', session.user.id);
  if (error) throw error;
}

// ── Derived helper functions (accept data as params) ──
// These are used by DataProvider to create bound versions.

export function getKidFrom(kids, id) {
  return kids.find(k => k.id === id) || FAMILY;
}

export function kidLabelFrom(kids, id) {
  return id === 'all' ? FAMILY.name : getKidFrom(kids, id).name;
}

export function kidDoneFrom(memories, id) {
  if (id === 'all') return memories.length;
  return memories.filter(m => m.kid === id || m.kid === 'all').length;
}

export function memoriesForKidFrom(memories, id) {
  if (id === 'all') return memories;
  return memories.filter(m => m.kid === id || m.kid === 'all');
}

export function allLevelsFrom(customLevels, levels) {
  return [...customLevels, ...levels];
}

export function getMascotFrom(mascots, id) {
  return mascots[id] || mascots[Object.keys(mascots)[0]] || { kid: id, name: '', tone: 'orange', since: '', stage: 1, grown: 0, items: [], log: [] };
}

export function wardrobeStateFrom(wardrobe, done) {
  return wardrobe.map(w => ({ ...w, got: done >= w.at }));
}

export function nextUnlockFrom(wardrobe, done) {
  const next = wardrobe.find(w => done < w.at) || null;
  const unlocked = wardrobe.filter(w => done >= w.at).length;
  if (!next) return { next: null, remain: 0, ratio: 1, unlocked, total: wardrobe.length };
  const prevAt = [...wardrobe].reverse().find(w => done >= w.at)?.at || 0;
  const span = next.at - prevAt || 1;
  return { next, remain: next.at - done, ratio: Math.min(1, (done - prevAt) / span), unlocked, total: wardrobe.length };
}

export function throwbackFrom(memories, kidId = 'all') {
  const list = kidId === 'all' ? memories : memories.filter(m => m.kid === kidId || m.kid === 'all');
  if (list.length < 2) return null;
  const m = list[list.length - 1];
  return { m, label: '去年的这个时候', sub: '你们一起做的第 1 件事' };
}

const LEVEL_AGE = { '12': 6, '04': 4, '17': 5, '31': 5, '23': 4 };

export function levelWeightFrom(kids, l, kid) {
  let w = 1;
  const ctx = nowCtx();
  if (l.custom) w *= 2.4;
  if (l.seasonal) w *= 2.0;
  const minA = LEVEL_AGE[l.num];
  const age = kid && kid !== 'all' ? kidAge(getKidFrom(kids, kid)) : null;
  if (minA != null && age != null && age < minA) w *= 0.3;
  if ((ctx.slot === 'evening' || ctx.slot === 'night') && (l.suggest === 'voice' || l.suggest === 'text')) w *= 1.5;
  if ((ctx.weekend || ctx.slot === 'afternoon') && l.suggest === 'photo') w *= 1.4;
  return w;
}

export function weightedShuffleFrom(kids, arr, kid) {
  return arr
    .map(l => ({ l, k: Math.pow(Math.random(), 1 / Math.max(0.0001, levelWeightFrom(kids, l, kid))) }))
    .sort((a, b) => b.k - a.k)
    .map(x => x.l);
}

export function frameLabelFrom(kids, perspective, kidId, meLabel = '家长') {
  if (perspective === 'together' || kidId === 'all') return PERSPECTIVES[perspective].long;
  const name = getKidFrom(kids, kidId).name;
  if (perspective === 'parent') return `${meLabel} → ${name}`;
  if (perspective === 'child') return `${name} → ${meLabel}`;
  return PERSPECTIVES[perspective].long;
}

export function yearReviewFrom(memories, mascots, wardrobe, kidId = 'all') {
  const list = kidId === 'all' ? memories : memories.filter(m => m.kid === kidId || m.kid === 'all');
  const byP = { parent: 0, child: 0, together: 0 };
  const byType = { voice: 0, photo: 0, text: 0 };
  const places = {};
  list.forEach(m => {
    byP[m.perspective] = (byP[m.perspective] || 0) + 1;
    byType[m.type] = (byType[m.type] || 0) + 1;
    if (m.place) places[m.place] = (places[m.place] || 0) + 1;
  });
  const top = Object.entries(places).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  const doneCount = kidId === 'all' ? memories.length : list.length;
  const mascot = kidId === 'all' ? mascots[Object.keys(mascots)[0]] : (mascots[kidId] || { grown: 0 });
  return {
    total: list.length, byP, byType,
    voiceCount: byType.voice,
    topPlace: top ? top[0] : null,
    grown: mascot?.grown || 0,
    unlocked: nextUnlockFrom(wardrobe, mascot?.grown || 0).unlocked,
    firstTitle: list.length ? list[list.length - 1].title : null,
    lastTitle: list.length ? list[0].title : null,
  };
}
```

- [ ] **Step 2: Verify no syntax errors**

```bash
cd /home/coder/workspaces/yibai
npx tsc --noEmit 2>&1 | head -20
```

There will be errors from screen files that still import old exports — that's expected and will be fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/data/index.ts
git commit -m "refactor: rewrite data layer with Supabase fetch functions"
```

---

## Task 6: Create DataProvider

**Files:**
- Create: `src/data/DataProvider.tsx`

- [ ] **Step 1: Create src/data/DataProvider.tsx**

```tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchLevels, fetchKids, fetchMemories, fetchMascots,
  fetchWardrobe, fetchCustomLevels, fetchProfile, insertCustomLevel,
  updateProfile,
  getKidFrom, kidLabelFrom, kidDoneFrom, memoriesForKidFrom,
  allLevelsFrom, getMascotFrom, wardrobeStateFrom, nextUnlockFrom,
  throwbackFrom, yearReviewFrom, levelWeightFrom, weightedShuffleFrom,
  frameLabelFrom,
  FAMILY,
} from './index';

const DataContext = createContext(null);

export function DataProvider({ children, userId }) {
  const [levels, setLevels] = useState([]);
  const [kids, setKids] = useState([]);
  const [memories, setMemories] = useState([]);
  const [mascots, setMascots] = useState({});
  const [wardrobe, setWardrobe] = useState([]);
  const [customLevels, setCustomLevels] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [lv, ki, me, ma, wa, cl, pr] = await Promise.all([
        fetchLevels(), fetchKids(), fetchMemories(), fetchMascots(),
        fetchWardrobe(), fetchCustomLevels(), fetchProfile(),
      ]);
      setLevels(lv);
      setKids(ki);
      setMemories(me);
      setMascots(ma);
      setWardrobe(wa);
      setCustomLevels(cl);
      setProfile(pr);
    } catch (e) {
      console.error('DataProvider loadAll error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Bound helper functions that close over current state
  const getKid = useCallback((id) => getKidFrom(kids, id), [kids]);
  const kidLabel = useCallback((id) => kidLabelFrom(kids, id), [kids]);
  const kidDone = useCallback((id) => kidDoneFrom(memories, id), [memories]);
  const memoriesForKid = useCallback((id) => memoriesForKidFrom(memories, id), [memories]);
  const allLevels = useCallback(() => allLevelsFrom(customLevels, levels), [customLevels, levels]);
  const getMascot = useCallback((id) => getMascotFrom(mascots, id), [mascots]);
  const wardrobeState = useCallback((done) => wardrobeStateFrom(wardrobe, done), [wardrobe]);
  const nextUnlock = useCallback((done) => nextUnlockFrom(wardrobe, done), [wardrobe]);
  const throwback = useCallback((kidId?) => throwbackFrom(memories, kidId), [memories]);
  const yearReview = useCallback((kidId?) => yearReviewFrom(memories, mascots, wardrobe, kidId), [memories, mascots, wardrobe]);
  const frameLabel = useCallback((perspective, kidId, meLabel?) => frameLabelFrom(kids, perspective, kidId, meLabel), [kids]);
  const levelWeight = useCallback((l, kid) => levelWeightFrom(kids, l, kid), [kids]);
  const weightedShuffle = useCallback((arr, kid) => weightedShuffleFrom(kids, arr, kid), [kids]);

  const addCustomLevel = useCallback(async (input) => {
    const lv = await insertCustomLevel(input);
    setCustomLevels(prev => [lv, ...prev]);
    return lv;
  }, []);

  const updateMe = useCallback(async (fields) => {
    await updateProfile(fields);
    setProfile(prev => prev ? { ...prev, ...fields } : prev);
  }, []);

  const value = {
    levels, kids, memories, mascots, wardrobe, customLevels, profile, loading,
    refresh: loadAll,
    getKid, kidLabel, kidDone, memoriesForKid, allLevels,
    getMascot, wardrobeState, nextUnlock, throwback, yearReview,
    frameLabel, levelWeight, weightedShuffle,
    addCustomLevel, updateMe,
    FAMILY,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/DataProvider.tsx
git commit -m "feat: add DataProvider context with useData hook"
```

---

## Task 7: Refactor Storage Layer

**Files:**
- Modify: `src/utils/storage.ts`

- [ ] **Step 1: Rewrite src/utils/storage.ts**

Replace the entire file:

```typescript
import { supabase } from '../lib/supabase';

export async function getMe() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('role, custom_role')
    .eq('id', session.user.id)
    .single();
  if (error || !data) return null;
  return { role: data.role, custom: data.custom_role };
}

export async function setMe(m) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from('profiles')
    .update({ role: m.role, custom_role: m.custom || '' })
    .eq('id', session.user.id);
}

export async function getAppearance() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('appearance')
    .eq('id', session.user.id)
    .single();
  if (error || !data) return null;
  return data.appearance;
}

export async function setAppearance(v) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from('profiles')
    .update({ appearance: v })
    .eq('id', session.user.id);
}

export async function getFamilyExtras() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('family_extras')
    .eq('id', session.user.id)
    .single();
  if (error || !data) return [];
  return data.family_extras || [];
}

export async function setFamilyExtras(list) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from('profiles')
    .update({ family_extras: list })
    .eq('id', session.user.id);
}

export function familyCount(kids, extras) {
  const kidCount = Array.isArray(kids) ? kids.length : 0;
  const extraCount = Array.isArray(extras) ? extras.length : 0;
  return kidCount + extraCount + 1;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/storage.ts
git commit -m "refactor: replace AsyncStorage with Supabase profile operations"
```

---

## Task 8: Create EmailLogin Screen

**Files:**
- Create: `src/screens/EmailLogin.tsx`

- [ ] **Step 1: Create src/screens/EmailLogin.tsx**

This screen reuses the visual style from `Login.tsx` (same spacing, fonts, colors). It has two modes: login and register.

```tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/tokens';
import { Icon } from '../components/Icons';
import { signIn, signUp } from '../lib/auth';

function BackButton({ onPress }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: theme.paper,
        borderWidth: 1, borderColor: theme.line,
        justifyContent: 'center', alignItems: 'center',
      }}
    >
      {Icon.chevL(theme.ink, 20)}
    </TouchableOpacity>
  );
}

export default function EmailLogin({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = email.includes('@') && password.length >= 6
    && (mode === 'login' || password === confirmPassword);

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'register') {
        await signUp(email, password);
      }
      await signIn(email, password);
      navigation.replace('Home');
    } catch (e: any) {
      setError(e.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.ink,
    padding: 0,
  };

  const inputBox = {
    backgroundColor: theme.paper,
    borderRadius: 16,
    paddingHorizontal: 18,
    height: 56,
    justifyContent: 'center' as const,
  };

  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.cream,
      paddingTop: insets.top,
    }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <Text style={{
          fontFamily: theme.fonts.head,
          fontSize: 22,
          color: theme.ink,
        }}>{mode === 'login' ? '邮箱登录' : '注册账号'}</Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, marginTop: 28, gap: 14 }}>
        <View style={inputBox}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="请输入邮箱"
            placeholderTextColor={theme.inkSoft}
            keyboardType="email-address"
            autoCapitalize="none"
            style={inputStyle}
          />
        </View>

        <View style={inputBox}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="请输入密码（至少 6 位）"
            placeholderTextColor={theme.inkSoft}
            secureTextEntry
            style={inputStyle}
          />
        </View>

        {mode === 'register' && (
          <View style={inputBox}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="确认密码"
              placeholderTextColor={theme.inkSoft}
              secureTextEntry
              style={inputStyle}
            />
          </View>
        )}

        {error ? (
          <Text style={{
            fontFamily: theme.fonts.body,
            fontSize: 14,
            color: '#E25C5C',
            paddingHorizontal: 4,
          }}>{error}</Text>
        ) : null}

        <TouchableOpacity
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
          activeOpacity={0.7}
          style={{ paddingHorizontal: 4 }}
        >
          <Text style={{
            fontFamily: theme.fonts.body,
            fontSize: 14,
            color: theme.accent,
          }}>{mode === 'login' ? '没有账号？注册' : '已有账号？登录'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 16,
      }}>
        <TouchableOpacity
          onPress={handleSubmit}
          activeOpacity={0.8}
          style={{
            paddingVertical: 17,
            borderRadius: 999,
            backgroundColor: canSubmit && !loading ? theme.accent : theme.sand,
            alignItems: 'center',
          }}
        >
          <Text style={{
            fontFamily: theme.fonts.head,
            fontSize: 17,
            color: canSubmit && !loading ? '#FFFDF7' : theme.inkSoft,
          }}>{loading ? '请稍候...' : (mode === 'login' ? '登录' : '注册')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/EmailLogin.tsx
git commit -m "feat: add EmailLogin screen for email/password auth"
```

---

## Task 9: Update Login.tsx — Add Email Option

**Files:**
- Modify: `src/screens/Login.tsx`

- [ ] **Step 1: Add email icon and navigation to social login sheet**

In `src/screens/Login.tsx`, find the social login modal content (the `<View>` with `flexDirection: 'row'` containing WeChat and Apple buttons, around line 515-544). Add a third button for email between Apple and the existing buttons:

Find this block inside the `PhoneLogin` component's social modal (the `<View>` with `gap: 40`):

```tsx
              <View style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 40,
                paddingVertical: 12,
              }}>
```

After the Apple `TouchableOpacity` (and before the closing `</View>` of that row), add:

```tsx
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={{ alignItems: 'center', gap: 10 }}
                  onPress={() => { setShowSocial(false); navigation.navigate('EmailLogin'); }}
                >
                  <View style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: theme.cream,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    {Icon.mail(theme.ink, 24)}
                  </View>
                  <Text style={{
                    fontFamily: theme.fonts.body, fontSize: 13, color: theme.inkSoft,
                  }}>邮箱</Text>
                </TouchableOpacity>
```

Note: If `Icon.mail` doesn't exist in `Icons.tsx`, add it. Check `src/components/Icons.tsx` for available icons. If there's no `mail` icon, use a simple `@` text or add a mail icon SVG.

- [ ] **Step 2: Verify the Icon.mail exists or add it**

Check `src/components/Icons.tsx` for a `mail` function on the `Icon` object. If it doesn't exist, add one:

```tsx
mail: (c, s = 20) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={c} strokeWidth={1.8} fill="none"/>
    <Path d="M22 6l-10 7L2 6" stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
),
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/Login.tsx src/components/Icons.tsx
git commit -m "feat: add email login option to social login sheet"
```

---

## Task 10: Update App.tsx — Auth, DataProvider, Routes

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Rewrite App.tsx**

Replace the entire file:

```tsx
import React, { useState, useCallback, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider, useTheme } from './src/theme/tokens';
import { DataProvider, useData } from './src/data/DataProvider';
import { DEFAULT_ME, meName } from './src/data';
import { getMe, setMe as persistMe } from './src/utils/storage';
import { getSession, onAuthStateChange } from './src/lib/auth';

import HomeFeed from './src/screens/HomeFeed';
import Drawer from './src/screens/Drawer';
import LevelDetail from './src/screens/LevelDetail';
import RecordFlow from './src/screens/RecordFlow';
import { MemoryPage, MemoryBook } from './src/screens/Memory';
import MascotPage, { UnlockMoment } from './src/screens/Mascot';
import SealedPage from './src/screens/SealedPage';
import RecordsCalendar from './src/screens/RecordsCalendar';
import YearReview from './src/screens/YearReview';
import InviteFlow, { JoinFlow } from './src/screens/InviteFlow';
import PhotobookSheet, { BookFlip } from './src/screens/BookPreview';
import { LoginWelcome, PhoneLogin, ForgotPassword } from './src/screens/Login';
import EmailLogin from './src/screens/EmailLogin';
import SettingsScreen from './src/screens/Settings';

const Stack = createNativeStackNavigator();

function HomeWithDrawer({ navigation }) {
  const { theme, setTheme } = useTheme();
  const { kidDone, profile } = useData();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [perspective, setPerspective] = useState('parent');
  const [kidId, setKidId] = useState('duo');
  const [me, setMeState] = useState(DEFAULT_ME);

  useEffect(() => {
    if (profile) {
      setMeState({ role: profile.role, custom: profile.custom_role });
    }
  }, [profile]);

  const updateMe = useCallback(async (m) => {
    setMeState(m);
    await persistMe(m);
  }, []);

  const handleDrawerNavigate = useCallback((route) => {
    setDrawerVisible(false);
    const params = { kidId, me };
    switch (route) {
      case 'mascot':
        navigation.navigate('Mascot', params);
        break;
      case 'records':
        navigation.navigate('RecordsCalendar', params);
        break;
      case 'sealed':
        navigation.navigate('Sealed', params);
        break;
      case 'book':
        navigation.navigate('MemoryBook', params);
        break;
      case 'yearreview':
        navigation.navigate('YearReview', params);
        break;
      case 'settings':
        navigation.navigate('Settings', { me, setMe: updateMe });
        break;
      case 'invite':
        navigation.navigate('Invite', params);
        break;
      default:
        break;
    }
  }, [navigation, kidId, me, updateMe]);

  const selectKid = useCallback((id) => {
    setKidId(id);
    if (id === 'all') setPerspective('together');
  }, []);

  const empty = kidDone(kidId) === 0;

  return (
    <View style={{ flex: 1 }}>
      <HomeFeed
        navigation={navigation}
        onOpenDrawer={() => setDrawerVisible(true)}
        perspective={perspective}
        setPerspective={setPerspective}
        kidId={kidId}
        setKidId={selectKid}
        me={me}
      />
      <Drawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onNavigate={handleDrawerNavigate}
        kidId={kidId}
        me={me}
      />
    </View>
  );
}

function AppNavigator() {
  const { theme } = useTheme();
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    getSession().then(session => {
      setInitialRoute(session ? 'Home' : 'LoginWelcome');
    }).catch(() => {
      setInitialRoute('LoginWelcome');
    });
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF3E6', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#DE8C57" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        id="root"
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.cream },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="LoginWelcome" component={LoginWelcome} />
        <Stack.Screen name="PhoneLogin" component={PhoneLogin} />
        <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
        <Stack.Screen name="EmailLogin" component={EmailLogin} />
        <Stack.Screen name="Home" component={HomeWithDrawer} />
        <Stack.Screen name="LevelDetail" component={LevelDetail} />
        <Stack.Screen
          name="Record"
          component={RecordFlow}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="Memory" component={MemoryPage} />
        <Stack.Screen name="MemoryBook" component={MemoryBook} />
        <Stack.Screen name="Mascot" component={MascotPage} />
        <Stack.Screen name="Sealed" component={SealedPage} />
        <Stack.Screen name="RecordsCalendar" component={RecordsCalendar} />
        <Stack.Screen
          name="YearReview"
          component={YearReview}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen name="Invite" component={InviteFlow} />
        <Stack.Screen name="Join" component={JoinFlow} />
        <Stack.Screen name="Photobook" component={PhotobookSheet} />
        <Stack.Screen name="BookFlip" component={BookFlip} />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AuthGate() {
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getSession().then(session => {
      setUserId(session?.user?.id || null);
      setChecking(false);
    }).catch(() => setChecking(false));

    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF3E6', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#DE8C57" />
      </View>
    );
  }

  return (
    <DataProvider userId={userId}>
      <AppNavigator />
    </DataProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    ZCOOLKuaiLe: require('./assets/fonts/ZCOOLKuaiLe-Regular.ttf'),
    NotoSerifSC: require('./assets/fonts/NotoSerifSC-Regular.ttf'),
    MaShanZheng: require('./assets/fonts/MaShanZheng-Regular.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF3E6', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#DE8C57" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider initialPreset="融合·暖" initialAccent="orange">
          <AuthGate />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add App.tsx
git commit -m "feat: add auth session check, DataProvider, and EmailLogin route"
```

---

## Task 11: Update Screen Files to Use useData()

Each screen needs its imports updated: data-dependent imports move from `import { X } from '../data'` to `const { X } = useData()`, while pure imports stay.

**Files:**
- Modify: `src/screens/HomeFeed.tsx`
- Modify: `src/screens/Drawer.tsx`
- Modify: `src/screens/Memory.tsx`
- Modify: `src/screens/Settings.tsx`
- Modify: `src/screens/Mascot.tsx`
- Modify: `src/screens/YearReview.tsx`
- Modify: `src/screens/RecordFlow.tsx`
- Modify: `src/screens/RecordsCalendar.tsx`
- Modify: `src/screens/LevelDetail.tsx`
- Modify: `src/screens/BookPreview.tsx`
- Modify: `src/screens/SealedPage.tsx`
- Modify: `src/screens/InviteFlow.tsx`

### 11a: HomeFeed.tsx

- [ ] **Step 1: Update imports**

Replace the data import (line 18-22):

```tsx
import {
  PERSPECTIVES, LEVELS, KIDS, FAMILY, getKid, kidLabel, kidDone,
  weightedShuffle, allLevels, addCustomLevel, memoriesForKid, meName,
  kidAge, suitsNow, frameLabel,
} from '../data';
```

With:

```tsx
import { PERSPECTIVES, meName, kidAge, suitsNow } from '../data';
import { useData } from '../data/DataProvider';
```

Then at the top of the `HomeFeed` component function (or whichever component uses these), add:

```tsx
const {
  levels, kids, FAMILY, getKid, kidLabel, kidDone,
  weightedShuffle, allLevels, addCustomLevel, memoriesForKid, frameLabel,
} = useData();
```

For sub-components that use these values (like `KidFace`), they either need `useData()` themselves or receive values as props. Since `KidFace` uses `getKid` and `KIDS`, it needs either:
- Its own `useData()` call, or
- Props passed from the parent

The simplest approach: add `useData()` at the top of each sub-component that needs data. For `KidFace`:

```tsx
function KidFace({ id, size = 30 }) {
  const { kids, getKid, FAMILY } = useData();
  if (id === 'all') {
    const a = getKid(kids[0]?.id || 'duo');
    const b = getKid((kids[1] || kids[0])?.id || 'duo');
    // ... rest unchanged
  }
  // ...
}
```

Replace any reference to the `KIDS` constant with `kids` from `useData()`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/HomeFeed.tsx
git commit -m "refactor: HomeFeed uses useData hook"
```

### 11b: Drawer.tsx

- [ ] **Step 1: Update imports**

Replace the data import (lines 15-32):

```tsx
import {
  KIDS, FAMILY, getKid, kidLabel, kidDone, memoriesForKid,
  MEMORIES, LEVELS, meName, meChar, MASCOTS, getMascot,
  PET_BODY, wardrobeState, WARDROBE, durationSince,
} from '../data';
```

With:

```tsx
import { meName, meChar, PET_BODY, durationSince } from '../data';
import { useData } from '../data/DataProvider';
```

At the top of the Drawer component:

```tsx
const {
  kids, FAMILY, levels, memories, wardrobe, getKid, kidLabel,
  kidDone, memoriesForKid, getMascot, wardrobeState,
} = useData();
```

Replace references to `KIDS` → `kids`, `LEVELS` → `levels`, `MEMORIES` → `memories`, `WARDROBE` → `wardrobe`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/Drawer.tsx
git commit -m "refactor: Drawer uses useData hook"
```

### 11c: Memory.tsx

- [ ] **Step 1: Update imports**

Replace:

```tsx
import {
  MEMORIES, KIDS, FAMILY, getKid, kidLabel, memoriesForKid, PERSPECTIVES,
} from '../data';
```

With:

```tsx
import { PERSPECTIVES } from '../data';
import { useData } from '../data/DataProvider';
```

At the top of each component that needs data:

```tsx
const { memories, kids, FAMILY, getKid, kidLabel, memoriesForKid } = useData();
```

Replace `MEMORIES` → `memories`, `KIDS` → `kids`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/Memory.tsx
git commit -m "refactor: Memory uses useData hook"
```

### 11d: Settings.tsx

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { KIDS, FAMILY, ROLES, DEFAULT_ME, getKid, kidLabel, meName, meChar, LEVELS, MEMORIES, NOW_YM } from '../data';
```

With:

```tsx
import { ROLES, DEFAULT_ME, meName, meChar, NOW_YM } from '../data';
import { useData } from '../data/DataProvider';
```

At the top of the Settings component:

```tsx
const { kids, FAMILY, levels, memories, getKid, kidLabel } = useData();
```

Replace `KIDS` → `kids`, `LEVELS` → `levels`, `MEMORIES` → `memories`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/Settings.tsx
git commit -m "refactor: Settings uses useData hook"
```

### 11e: Mascot.tsx

- [ ] **Step 1: Update imports**

Replace:

```tsx
import {
  KIDS, getKid, kidLabel, kidDone, getMascot, MASCOTS,
  PET_BODY, wardrobeState, nextUnlock, WARDROBE, memoriesForKid,
} from '../data';
```

With:

```tsx
import { PET_BODY } from '../data';
import { useData } from '../data/DataProvider';
```

At the top of each component that needs data:

```tsx
const {
  kids, getKid, kidLabel, kidDone, getMascot,
  wardrobeState, nextUnlock, wardrobe, memoriesForKid,
} = useData();
```

Replace `KIDS` → `kids`, `WARDROBE` → `wardrobe`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/Mascot.tsx
git commit -m "refactor: Mascot uses useData hook"
```

### 11f: YearReview.tsx

- [ ] **Step 1: Update imports**

Replace:

```tsx
import {
  MEMORIES, getKid, MASCOTS, getMascot, PET_BODY,
  wardrobeState, memoriesForKid, yearReview,
} from '../data';
```

With:

```tsx
import { PET_BODY } from '../data';
import { useData } from '../data/DataProvider';
```

At the top of the component:

```tsx
const { memories, getKid, getMascot, wardrobeState, memoriesForKid, yearReview } = useData();
```

Replace `MEMORIES` → `memories`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/YearReview.tsx
git commit -m "refactor: YearReview uses useData hook"
```

### 11g: RecordFlow.tsx

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { PERSPECTIVES, getKid, kidLabel, meName, KIDS } from '../data';
```

With:

```tsx
import { PERSPECTIVES, meName } from '../data';
import { useData } from '../data/DataProvider';
```

At the top of the component:

```tsx
const { kids, getKid, kidLabel } = useData();
```

Replace `KIDS` → `kids`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/RecordFlow.tsx
git commit -m "refactor: RecordFlow uses useData hook"
```

### 11h: RecordsCalendar.tsx

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { MEMORIES, KIDS, getKid } from '../data';
```

With:

```tsx
import { useData } from '../data/DataProvider';
```

At the top of the component:

```tsx
const { memories, kids, getKid } = useData();
```

Replace `MEMORIES` → `memories`, `KIDS` → `kids`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/RecordsCalendar.tsx
git commit -m "refactor: RecordsCalendar uses useData hook"
```

### 11i: LevelDetail.tsx

- [ ] **Step 1: Update imports**

Replace:

```tsx
import {
  PERSPECTIVES, LEVELS, getKid, kidLabel, meName, frameLabel,
} from '../data';
```

With:

```tsx
import { PERSPECTIVES, meName } from '../data';
import { useData } from '../data/DataProvider';
```

At the top of the component:

```tsx
const { levels, getKid, kidLabel, frameLabel } = useData();
```

Replace `LEVELS` → `levels`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/LevelDetail.tsx
git commit -m "refactor: LevelDetail uses useData hook"
```

### 11j: BookPreview.tsx

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { MEMORIES, KIDS, getKid, memoriesForKid } from '../data';
```

With:

```tsx
import { useData } from '../data/DataProvider';
```

At the top of each component that needs data:

```tsx
const { memories, kids, getKid, memoriesForKid } = useData();
```

Replace `MEMORIES` → `memories`, `KIDS` → `kids`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/BookPreview.tsx
git commit -m "refactor: BookPreview uses useData hook"
```

### 11k: SealedPage.tsx

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { LEVELS, PERSPECTIVES, getKid } from '../data';
```

With:

```tsx
import { PERSPECTIVES } from '../data';
import { useData } from '../data/DataProvider';
```

At the top of the component:

```tsx
const { levels, getKid } = useData();
```

Replace `LEVELS` → `levels`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/SealedPage.tsx
git commit -m "refactor: SealedPage uses useData hook"
```

### 11l: InviteFlow.tsx

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { KIDS, FAMILY, ROLES, getKid } from '../data';
```

With:

```tsx
import { ROLES } from '../data';
import { useData } from '../data/DataProvider';
```

At the top of each component:

```tsx
const { kids, FAMILY, getKid } = useData();
```

Replace `KIDS` → `kids`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/InviteFlow.tsx
git commit -m "refactor: InviteFlow uses useData hook"
```

---

## Task 12: End-to-End Verification

- [ ] **Step 1: Verify Supabase is running**

```bash
cd /home/coder/workspaces/yibai/supabase-docker
docker compose ps
```

All services should show "Up" or "healthy".

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/coder/workspaces/yibai
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 3: Start the Expo dev server**

```bash
cd /home/coder/workspaces/yibai
npx expo start --web
```

- [ ] **Step 4: Test auth flow**

1. App should show `LoginWelcome` screen
2. Tap "登录其他账号" → PhoneLogin screen
3. Tap "其他方式登录" → bottom sheet with WeChat, Apple, **邮箱**
4. Tap 邮箱 → `EmailLogin` screen
5. Switch to "注册" mode, enter `demo@yibai.app` / `demo123456`
6. Or use "登录" mode with the demo account
7. After login, should navigate to `Home` and show data from Supabase

- [ ] **Step 5: Test data loading**

1. Home feed should show level cards (from `levels` table)
2. Navigate to drawer — should show kids (朵朵, 小满)
3. Navigate to Memory — should show 8 memories
4. Navigate to Mascot — should show 团子/糯米 with accessories
5. Navigate to Settings — should show user role and kids

- [ ] **Step 6: Test data persistence**

1. Close the app / refresh the page
2. Reopen — should auto-login (session persisted) and show same data

- [ ] **Step 7: Final commit**

If any fixes were needed during verification:

```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```
