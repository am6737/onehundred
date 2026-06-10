-- 一百件事 — Database Schema

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

-- 9. Storage: private bucket for memory media (photos / videos / audio)
--    Files live at `${userId}/${memoryId}/<name>.<ext>`; owner-folder access only.
INSERT INTO storage.buckets (id, name, public) VALUES ('memories', 'memories', false)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "memories_media_own" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'memories' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'memories' AND (storage.foldername(name))[1] = auth.uid()::text);
