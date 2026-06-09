# Supabase Integration Design — "一百件事"

## Overview

Replace all hardcoded mock data in `src/data/index.ts` and AsyncStorage persistence in `src/utils/storage.ts` with a self-hosted Supabase backend. Add email/password authentication via Supabase GoTrue.

### Goals

- Self-host Supabase on the current machine via Docker Compose
- Migrate all data (LEVELS, KIDS, MEMORIES, MASCOTS, CUSTOM_LEVELS, user identity, appearance) to Postgres tables
- Add email/password auth as a login option (in the "其他方式登录" sheet)
- Protect user data with Row Level Security (RLS)
- Minimize changes to screen components — keep the same exported function/constant names from the data layer

### Non-Goals

- Phone/SMS auth, WeChat OAuth, Apple Sign-In (future work)
- File/image uploads to Supabase Storage (memories currently have no real media)
- Realtime subscriptions (not needed for current UX)
- Multi-family / sharing features

---

## 1. Infrastructure: Self-Hosted Supabase

### Deployment

Use the official Supabase self-hosting Docker Compose setup:

1. Clone `supabase/supabase` docker directory or use the standalone docker-compose template
2. Configure `.env` with:
   - `POSTGRES_PASSWORD` — strong random password
   - `JWT_SECRET` — 32+ char secret for GoTrue tokens
   - `ANON_KEY` / `SERVICE_ROLE_KEY` — generated JWTs matching the secret
   - `SITE_URL` — `http://localhost:3000` (Expo dev)
   - `STUDIO_PORT` — 8000 (Dashboard)
   - `API_EXTERNAL_URL` — `http://<machine-ip>:8000`
3. `docker compose up -d`
4. Verify Studio accessible at `http://localhost:8000`

### Ports

| Service | Port |
|---------|------|
| Kong (API gateway) | 8000 |
| Studio (Dashboard) | 3000 |
| PostgreSQL | 5432 |

The React Native app connects to the Kong API gateway at `http://<host>:8000`.

---

## 2. Database Schema

### 2.1 `levels` — Public activity list (read-only for all users)

```sql
CREATE TABLE levels (
  num        TEXT PRIMARY KEY,
  perspective TEXT NOT NULL CHECK (perspective IN ('parent','child','together')),
  tone       TEXT NOT NULL,
  title      TEXT NOT NULL,
  why        TEXT NOT NULL DEFAULT '',
  how        TEXT NOT NULL DEFAULT '',
  record     TEXT NOT NULL DEFAULT '',
  suggest    TEXT NOT NULL DEFAULT 'photo' CHECK (suggest IN ('voice','photo','text','video')),
  sealed     BOOLEAN NOT NULL DEFAULT false,
  seal_until TEXT,
  sealed_on  TEXT,
  seasonal   BOOLEAN NOT NULL DEFAULT false,
  kid        TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "levels_public_read" ON levels FOR SELECT USING (true);
```

Seeded with the 20 levels from `LEVELS` array.

### 2.2 `wardrobe` — Public wardrobe items (read-only)

```sql
CREATE TABLE wardrobe (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  slot  TEXT NOT NULL,
  at    INT NOT NULL,
  line  TEXT NOT NULL
);

ALTER TABLE wardrobe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wardrobe_public_read" ON wardrobe FOR SELECT USING (true);
```

Seeded with the 5 items from `WARDROBE` array.

### 2.3 `profiles` — User profile (1:1 with auth.users)

```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role           TEXT NOT NULL DEFAULT '爸爸',
  custom_role    TEXT NOT NULL DEFAULT '',
  appearance     JSONB,
  family_extras  JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
```

Replaces: `DEFAULT_ME`, `getMe()`/`setMe()`, `getAppearance()`/`setAppearance()` in storage.ts.

### 2.4 `kids` — Children in a family

```sql
CREATE TABLE kids (
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

ALTER TABLE kids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_own" ON kids
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Seeded per-user. Replaces `KIDS` array.

### 2.5 `memories` — Recorded memories

```sql
CREATE TABLE memories (
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

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memories_own" ON memories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Replaces `MEMORIES` array.

### 2.6 `mascots` — Pet mascot state per kid

```sql
CREATE TABLE mascots (
  kid_id   TEXT NOT NULL,
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  tone     TEXT NOT NULL DEFAULT 'orange',
  since    TEXT NOT NULL DEFAULT '',
  stage    INT NOT NULL DEFAULT 1,
  grown    INT NOT NULL DEFAULT 0,
  items    JSONB NOT NULL DEFAULT '[]',
  log      JSONB NOT NULL DEFAULT '[]',
  PRIMARY KEY (kid_id, user_id)
);

ALTER TABLE mascots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mascots_own" ON mascots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Replaces `MASCOTS` object.

### 2.7 `custom_levels` — User-created activities

```sql
CREATE TABLE custom_levels (
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

ALTER TABLE custom_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_levels_own" ON custom_levels
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Replaces `CUSTOM_LEVELS` array and `addCustomLevel()`.

---

## 3. Seed Data

A `seed.sql` file will insert:

- 20 rows into `levels` (from `LEVELS` array)
- 5 rows into `wardrobe` (from `WARDROBE` array)

User-specific data (kids, memories, mascots) will be seeded via a function that runs after a demo user signs up, or via a separate seed script that creates a demo user and populates their data matching the current mock data.

### Demo seed approach

```sql
-- After creating a demo user via GoTrue API:
-- INSERT INTO kids (...) VALUES (...) for duo and man
-- INSERT INTO memories (...) VALUES (...) for all 8 memories
-- INSERT INTO mascots (...) VALUES (...) for duo and man mascots
-- INSERT INTO custom_levels (...) VALUES (...) for the 1 custom level
```

---

## 4. App Data Layer

### 4.1 New file: `src/lib/supabase.ts`

Initialize the Supabase JS client:

```
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = 'http://<host>:8000'
const supabaseAnonKey = '<anon-key>'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

Dependencies to add: `@supabase/supabase-js`

### 4.2 Refactored: `src/data/index.ts`

The file keeps the same exported names but fetches from Supabase instead of returning hardcoded arrays. Strategy:

**Static/public data** (`PERSPECTIVES`, `ROLES`, `WARDROBE` constants, pure functions like `kidAge`, `nowCtx`, `suitsNow`, `levelWeight`, `weightedShuffle`, `frameLabel`, `meName`, `meChar`):
- Stay as-is in the file. These are either display constants or pure computations that don't need a database.

**Data that moves to Supabase** — exposed via async functions:

| Old export | New signature | Source |
|------------|--------------|--------|
| `LEVELS` | `fetchLevels(): Promise<Level[]>` | `levels` table |
| `KIDS` | `fetchKids(): Promise<Kid[]>` | `kids` table (filtered by user_id) |
| `MEMORIES` | `fetchMemories(): Promise<Memory[]>` | `memories` table (filtered by user_id) |
| `MASCOTS` | `fetchMascots(): Promise<Record<string, Mascot>>` | `mascots` table (filtered by user_id) |
| `WARDROBE` | `fetchWardrobe(): Promise<WardrobeItem[]>` | `wardrobe` table |
| `CUSTOM_LEVELS` / `customLevels()` | `fetchCustomLevels(): Promise<Level[]>` | `custom_levels` table |
| `addCustomLevel(...)` | `addCustomLevel(...): Promise<Level>` | INSERT into `custom_levels` |
| `HELLO` | Computed from fetched kids + memories | Derived |

**Derived functions** (`kidDone`, `memoriesForKid`, `allLevels`, `throwback`, `yearReview`, `wardrobeState`, `nextUnlock`):
- Stay as pure functions but accept data as parameters instead of referencing module-level constants
- e.g. `kidDone(memories, kidId)` instead of `kidDone(kidId)`

### 4.3 Refactored: `src/utils/storage.ts`

All functions (`getMe`, `setMe`, `getAppearance`, `setAppearance`, `getFamilyExtras`, `setFamilyExtras`) are replaced with Supabase profile operations:

| Old | New |
|-----|-----|
| `getMe()` | `supabase.from('profiles').select().eq('id', uid).single()` |
| `setMe(m)` | `supabase.from('profiles').upsert({ id: uid, role: m.role, ... })` |
| `getAppearance()` | Read `appearance` column from `profiles` |
| `setAppearance(v)` | Update `appearance` column in `profiles` |
| `getFamilyExtras()` | Read `family_extras` JSONB column from `profiles` |
| `setFamilyExtras(list)` | Update `family_extras` JSONB column in `profiles` |

### 4.4 Data loading pattern in screens

Screens currently import constants directly:
```js
import { LEVELS, KIDS, MEMORIES, ... } from '../data';
```

After migration, screens use React state + useEffect to load data:
```js
const [levels, setLevels] = useState([]);
useEffect(() => { fetchLevels().then(setLevels); }, []);
```

To minimize screen-level changes, consider a **context provider** (`DataProvider`) at the app root that:
1. Fetches all data on auth state change
2. Provides it via React Context
3. Screens consume via `useData()` hook

```
// Usage in screens:
const { levels, kids, memories, mascots } = useData();
```

This keeps screen components almost unchanged — they just swap the import for a hook call.

---

## 5. Authentication

### 5.1 Auth flow

1. User opens app → `LoginWelcome` screen (existing)
2. User taps "其他方式登录" → bottom sheet appears (existing)
3. **New**: sheet shows "邮箱" icon alongside WeChat and Apple
4. Tap "邮箱" → navigate to new `EmailLogin` screen
5. `EmailLogin` has two tabs: "登录" / "注册"
   - 登录: email + password → `supabase.auth.signInWithPassword()`
   - 注册: email + password + confirm password → `supabase.auth.signUp()`
6. On success → `navigation.replace('Home')`

### 5.2 Session management

- Supabase JS client stores session in AsyncStorage (configured in 4.1)
- On app start, check `supabase.auth.getSession()`
  - If valid session exists → skip login, go to `Home`
  - If no session → show `LoginWelcome`
- Add `supabase.auth.onAuthStateChange()` listener in App.tsx to handle token refresh and sign-out

### 5.3 New screen: `EmailLogin.tsx`

Reuses existing shared components (`BackButton`, `BottomButton`, `AgreementRow`) from `Login.tsx`. UI:

- Back button (top left)
- Title: "邮箱登录" or "注册账号" (based on tab)
- Email input (similar style to PhoneInput)
- Password input (with secure text)
- Confirm password (register tab only)
- Tab toggle: "没有账号？注册" / "已有账号？登录"
- Bottom button: "登录" / "注册"
- Error text display for auth failures

### 5.4 Profile creation on sign-up

Use a Postgres trigger or the app to create a `profiles` row on first sign-up:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## 6. File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `docker/` (new dir) | Create | Supabase Docker Compose config |
| `docker/.env` | Create | Supabase environment variables |
| `docker/seed.sql` | Create | Seed LEVELS and WARDROBE data |
| `src/lib/supabase.ts` | Create | Supabase client initialization |
| `src/lib/auth.ts` | Create | Auth helper functions (signIn, signUp, signOut, getSession) |
| `src/data/index.ts` | Rewrite | Replace hardcoded data with Supabase fetch functions; keep pure utility functions |
| `src/data/DataProvider.tsx` | Create | React Context provider for app-wide data |
| `src/utils/storage.ts` | Rewrite | Replace AsyncStorage calls with Supabase profile operations |
| `src/screens/Login.tsx` | Modify | Add "邮箱" icon to social login sheet, navigate to EmailLogin |
| `src/screens/EmailLogin.tsx` | Create | Email/password login and registration screen |
| `App.tsx` | Modify | Wrap with `DataProvider`, add auth session check, add `EmailLogin` to navigator |
| `src/screens/HomeFeed.tsx` | Modify | Use `useData()` hook instead of direct imports |
| `src/screens/Settings.tsx` | Modify | Use `useData()` hook instead of direct imports |
| `src/screens/Memory.tsx` | Modify | Use `useData()` hook instead of direct imports |
| `src/screens/Drawer.tsx` | Modify | Use `useData()` hook instead of direct imports |
| `src/screens/RecordFlow.tsx` | Modify | Use `useData()` hook instead of direct imports |
| `src/screens/RecordsCalendar.tsx` | Modify | Use `useData()` hook instead of direct imports |
| `src/screens/LevelDetail.tsx` | Modify | Use `useData()` hook instead of direct imports |
| `src/screens/BookPreview.tsx` | Modify | Use `useData()` hook instead of direct imports |
| `src/screens/Mascot.tsx` | Modify | Use `useData()` hook (if it imports MASCOTS data) |
| `src/screens/YearReview.tsx` | Modify | Use `useData()` hook (if it imports data) |
| `package.json` | Modify | Add `@supabase/supabase-js` dependency |

---

## 7. Migration Sequence

1. **Deploy Supabase** — Docker Compose up, verify Studio works
2. **Create tables + seed** — Run SQL via Studio or psql
3. **Add Supabase client** — `src/lib/supabase.ts`
4. **Build DataProvider** — Context + fetch logic + `useData()` hook
5. **Build auth layer** — `src/lib/auth.ts`, session check in App.tsx
6. **Add EmailLogin screen** — New screen + route + social sheet entry
7. **Migrate data layer** — Rewrite `src/data/index.ts` and `src/utils/storage.ts`
8. **Update all screens** — Swap imports to `useData()` hook
9. **Test end-to-end** — Register, login, browse levels, record memory, check mascot

---

## 8. Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Supabase client for JS/TS |

`@react-native-async-storage/async-storage` is already installed and will be reused for Supabase session persistence.

No other new dependencies needed.
