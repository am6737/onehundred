-- Admin V2 database foundation:
-- stable activity identity/versioning, legacy compatibility, assets, governance, audit, RLS and safe RPCs.
-- Idempotent by design; this migration only adds/bridges data and does not remove or rename legacy app tables.

BEGIN;

-- Stable deterministic UUIDs for one-time backfills and legacy bridge triggers.
CREATE OR REPLACE FUNCTION public.admin_v2_stable_uuid(p_kind text, p_key text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  WITH h AS (SELECT md5(p_kind || ':' || p_key) AS v)
  SELECT (
    substr(v, 1, 8) || '-' ||
    substr(v, 9, 4) || '-' ||
    substr(v, 13, 4) || '-' ||
    substr(v, 17, 4) || '-' ||
    substr(v, 21, 12)
  )::uuid
  FROM h;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_try_timestamptz(p_value text, p_fallback timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN p_fallback;
  END IF;
  BEGIN
    RETURN p_value::timestamptz;
  EXCEPTION WHEN others THEN
    RETURN p_fallback;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE p.admin_role
    WHEN 'content_editor' THEN 'content_editor'
    WHEN 'content_reviewer' THEN 'content_reviewer'
    WHEN 'family_support' THEN 'family_support'
    WHEN 'system_admin' THEN 'system_admin'
    WHEN 'super_admin' THEN 'system_admin'
    WHEN 'admin' THEN 'system_admin'
    WHEN 'operator' THEN 'content_reviewer'
    WHEN 'support' THEN 'family_support'
    ELSE NULL
  END
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

DO $$
BEGIN
  ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_admin_role_check;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_admin_role_v2_compat_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_admin_role_v2_compat_check
      CHECK (
        admin_role IS NULL OR admin_role IN (
          'super_admin','admin','operator','support',
          'content_editor','content_reviewer','family_support','system_admin'
        )
      ) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_v2_has_role(p_allowed text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.admin_v2_current_role() = ANY(COALESCE(p_allowed, '{}'::text[])), false);
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_has_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE p_permission
    WHEN 'manage_system_activity' THEN public.admin_v2_has_role(ARRAY['content_editor','system_admin'])
    WHEN 'review_content' THEN public.admin_v2_has_role(ARRAY['content_reviewer','system_admin'])
    WHEN 'view_private_record' THEN public.admin_v2_has_role(ARRAY['content_reviewer','family_support','system_admin'])
    WHEN 'view_family_private_asset' THEN public.admin_v2_has_role(ARRAY['content_reviewer','family_support','system_admin'])
    WHEN 'view_family_activity' THEN public.admin_v2_has_role(ARRAY['content_reviewer','family_support','system_admin'])
    WHEN 'manage_moderation_case' THEN public.admin_v2_has_role(ARRAY['content_reviewer','family_support','system_admin'])
    WHEN 'family_support' THEN public.admin_v2_has_role(ARRAY['family_support','system_admin'])
    WHEN 'view_audit' THEN public.admin_v2_has_role(ARRAY['system_admin'])
    WHEN 'write_audit' THEN public.admin_v2_has_role(ARRAY['content_editor','content_reviewer','family_support','system_admin'])
    ELSE false
  END;
$$;

CREATE TABLE IF NOT EXISTS public.admin_v2_system_illustration_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  display_no text,
  title text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'illustrations',
  path text NOT NULL,
  mime_type text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','disabled','archived')),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_v2_family_private_cover_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  title text,
  storage_bucket text NOT NULL DEFAULT 'illustrations',
  path text NOT NULL,
  mime_type text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','disabled','archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.admin_v2_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL
    CHECK (source_type IN ('system','family','copied_family')),
  source_key text NOT NULL,
  display_no text,
  family_id uuid REFERENCES public.families(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  current_version_id uuid,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived','unpublished','deleted')),
  visibility text NOT NULL
    CHECK (visibility IN ('system','family_private','governed')),
  copied_from_activity_id uuid REFERENCES public.admin_v2_activities(id) ON DELETE SET NULL,
  copied_from_version_id uuid,
  legacy_level_num text,
  legacy_custom_level_id integer,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source_type = 'system' AND family_id IS NULL) OR (source_type <> 'system' AND family_id IS NOT NULL)),
  CHECK ((source_type = 'copied_family') = (copied_from_activity_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_v2_activities_system_source
  ON public.admin_v2_activities (source_key)
  WHERE source_type = 'system';
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_v2_activities_family_source
  ON public.admin_v2_activities (family_id, source_key)
  WHERE source_type IN ('family','copied_family');
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_v2_activities_legacy_level
  ON public.admin_v2_activities (legacy_level_num)
  WHERE legacy_level_num IS NOT NULL AND source_type = 'system';
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_v2_activities_legacy_custom
  ON public.admin_v2_activities (legacy_custom_level_id)
  WHERE legacy_custom_level_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.admin_v2_activity_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.admin_v2_activities(id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived','unpublished')),
  title text NOT NULL,
  why text NOT NULL DEFAULT '',
  how text NOT NULL DEFAULT '',
  record_hint text NOT NULL DEFAULT '',
  suggest_mode text NOT NULL DEFAULT 'photo'
    CHECK (suggest_mode IN ('text','photo','video','voice')),
  allowed_capture_modes text[] NOT NULL DEFAULT ARRAY['text','photo','video','voice']::text[],
  illustration_asset_id uuid REFERENCES public.admin_v2_system_illustration_assets(id) ON DELETE SET NULL,
  family_private_cover_asset_id uuid REFERENCES public.admin_v2_family_private_cover_assets(id) ON DELETE SET NULL,
  illustration_source text NOT NULL DEFAULT 'none'
    CHECK (illustration_source IN ('system_asset','family_private','motif_fallback','none')),
  illustration_path text,
  family_id uuid REFERENCES public.families(id) ON DELETE CASCADE,
  perspective text CHECK (perspective IS NULL OR perspective IN ('parent','child','together')),
  tone text,
  category text,
  scene text,
  tags text[],
  min_age smallint CHECK (min_age IS NULL OR min_age >= 0),
  max_age smallint CHECK (max_age IS NULL OR max_age <= 18),
  seasonal boolean,
  seal_recommendation jsonb,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  drafted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_approved_at timestamptz,
  review_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  copied_from_version_id uuid REFERENCES public.admin_v2_activity_versions(id) ON DELETE SET NULL,
  legacy_level_num text,
  legacy_custom_level_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, version_no),
  CHECK (cardinality(allowed_capture_modes) > 0),
  CHECK (allowed_capture_modes <@ ARRAY['text','photo','video','voice']::text[]),
  CHECK (suggest_mode = ANY(allowed_capture_modes)),
  CHECK (min_age IS NULL OR max_age IS NULL OR max_age >= min_age),
  CHECK (
    (illustration_source = 'system_asset' AND illustration_asset_id IS NOT NULL AND family_private_cover_asset_id IS NULL)
    OR (illustration_source = 'family_private' AND family_private_cover_asset_id IS NOT NULL AND illustration_asset_id IS NULL)
    OR (illustration_source IN ('motif_fallback','none') AND illustration_asset_id IS NULL AND family_private_cover_asset_id IS NULL)
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_v2_activities_current_version_fkey'
  ) THEN
    ALTER TABLE public.admin_v2_activities
      ADD CONSTRAINT admin_v2_activities_current_version_fkey
      FOREIGN KEY (current_version_id)
      REFERENCES public.admin_v2_activity_versions(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_v2_activities_copied_from_version_fkey'
  ) THEN
    ALTER TABLE public.admin_v2_activities
      ADD CONSTRAINT admin_v2_activities_copied_from_version_fkey
      FOREIGN KEY (copied_from_version_id)
      REFERENCES public.admin_v2_activity_versions(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_v2_activity_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  kid_id text NOT NULL,
  activity_id uuid NOT NULL REFERENCES public.admin_v2_activities(id) ON DELETE RESTRICT,
  activity_version_id uuid NOT NULL REFERENCES public.admin_v2_activity_versions(id) ON DELETE RESTRICT,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  primary_capture_mode text NOT NULL CHECK (primary_capture_mode IN ('text','photo','video','voice')),
  capture_modes text[] NOT NULL,
  title text,
  caption text,
  transcript text,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  legacy_duration text,
  shots integer CHECK (shots IS NULL OR shots >= 0),
  place text,
  recorded_at timestamptz NOT NULL,
  legacy_recorded_date text,
  sealed text NOT NULL DEFAULT 'unsealed' CHECK (sealed IN ('sealed','unsealed')),
  seal_until timestamptz,
  seal_label text,
  moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending','approved','rejected','hidden')),
  moderation_note text,
  snapshot jsonb NOT NULL,
  legacy_memory_id text UNIQUE,
  invite_token_id text,
  invited_role text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(capture_modes) > 0),
  CHECK (capture_modes <@ ARRAY['text','photo','video','voice']::text[]),
  CHECK (primary_capture_mode = ANY(capture_modes))
);

CREATE INDEX IF NOT EXISTS idx_admin_v2_records_family_time
  ON public.admin_v2_activity_records (family_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_v2_records_activity
  ON public.admin_v2_activity_records (activity_id, activity_version_id);
CREATE INDEX IF NOT EXISTS idx_admin_v2_records_moderation
  ON public.admin_v2_activity_records (moderation_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_v2_activity_record_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.admin_v2_activity_records(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image','video','audio','text','other')),
  storage_bucket text,
  storage_path text,
  mime_type text,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  width integer CHECK (width IS NULL OR width >= 0),
  height integer CHECK (height IS NULL OR height >= 0),
  order_index integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  caption text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_admin_v2_record_media_record
  ON public.admin_v2_activity_record_media (record_id, order_index, created_at);

CREATE TABLE IF NOT EXISTS public.admin_v2_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  actor_role text NOT NULL
    CHECK (actor_role IN ('content_editor','content_reviewer','family_support','system_admin')),
  action text NOT NULL
    CHECK (action IN ('create','update','copy','approve_review','publish','unpublish','archive','delete','view_private','moderate','grant_access','revoke_access')),
  target_type text NOT NULL
    CHECK (target_type IN ('activity','activity_version','record','asset','family','member','moderation_case')),
  target_id text NOT NULL,
  family_id uuid REFERENCES public.families(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_v2_audit_events_time
  ON public.admin_v2_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_v2_audit_events_actor
  ON public.admin_v2_audit_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_v2_audit_events_target
  ON public.admin_v2_audit_events (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_v2_audit_events_family
  ON public.admin_v2_audit_events (family_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_v2_moderation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL
    CHECK (kind IN ('record_review','activity_review','asset_review','family_support','policy_violation','public_request')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_review','resolved','rejected','closed')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 8),
  target_type text NOT NULL
    CHECK (target_type IN ('activity','activity_version','record','asset','family')),
  target_id text NOT NULL,
  family_id uuid REFERENCES public.families(id) ON DELETE SET NULL,
  opened_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text,
  audit_event_id uuid REFERENCES public.admin_v2_audit_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_v2_moderation_cases_status
  ON public.admin_v2_moderation_cases (status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_v2_moderation_cases_target
  ON public.admin_v2_moderation_cases (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_v2_moderation_cases_family
  ON public.admin_v2_moderation_cases (family_id, opened_at DESC);

-- Direct RLS. Admins can directly manage platform/system objects, but family-private records,
-- family activities and private covers require governance RPCs that record a reason.
ALTER TABLE public.admin_v2_system_illustration_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_v2_family_private_cover_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_v2_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_v2_activity_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_v2_activity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_v2_activity_record_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_v2_moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_v2_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_v2_system_assets_read" ON public.admin_v2_system_illustration_assets;
CREATE POLICY "admin_v2_system_assets_read"
  ON public.admin_v2_system_illustration_assets FOR SELECT
  USING (status = 'active' OR public.admin_v2_has_permission('manage_system_activity'));
DROP POLICY IF EXISTS "admin_v2_system_assets_write" ON public.admin_v2_system_illustration_assets;
CREATE POLICY "admin_v2_system_assets_write"
  ON public.admin_v2_system_illustration_assets FOR ALL
  USING (public.admin_v2_has_permission('manage_system_activity'))
  WITH CHECK (public.admin_v2_has_permission('manage_system_activity'));

DROP POLICY IF EXISTS "admin_v2_family_covers_family_read" ON public.admin_v2_family_private_cover_assets;
CREATE POLICY "admin_v2_family_covers_family_read"
  ON public.admin_v2_family_private_cover_assets FOR SELECT
  USING (family_id = public.my_family_id());
DROP POLICY IF EXISTS "admin_v2_family_covers_family_write" ON public.admin_v2_family_private_cover_assets;
CREATE POLICY "admin_v2_family_covers_family_write"
  ON public.admin_v2_family_private_cover_assets FOR ALL
  USING (family_id = public.my_family_id())
  WITH CHECK (family_id = public.my_family_id());

DROP POLICY IF EXISTS "admin_v2_activities_system_read" ON public.admin_v2_activities;
CREATE POLICY "admin_v2_activities_system_read"
  ON public.admin_v2_activities FOR SELECT
  USING ((source_type = 'system' AND status <> 'deleted') OR family_id = public.my_family_id());
DROP POLICY IF EXISTS "admin_v2_activities_system_admin_write" ON public.admin_v2_activities;
CREATE POLICY "admin_v2_activities_system_admin_write"
  ON public.admin_v2_activities FOR ALL
  USING (
    (source_type = 'system' AND public.admin_v2_has_permission('manage_system_activity'))
    OR (source_type <> 'system' AND family_id = public.my_family_id())
  )
  WITH CHECK (
    (source_type = 'system' AND public.admin_v2_has_permission('manage_system_activity'))
    OR (source_type <> 'system' AND family_id = public.my_family_id())
  );

DROP POLICY IF EXISTS "admin_v2_versions_read" ON public.admin_v2_activity_versions;
CREATE POLICY "admin_v2_versions_read"
  ON public.admin_v2_activity_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_v2_activities a
      WHERE a.id = activity_id
        AND ((a.source_type = 'system' AND a.status <> 'deleted') OR a.family_id = public.my_family_id())
    )
  );
DROP POLICY IF EXISTS "admin_v2_versions_write" ON public.admin_v2_activity_versions;
CREATE POLICY "admin_v2_versions_write"
  ON public.admin_v2_activity_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_v2_activities a
      WHERE a.id = activity_id
        AND (
          (a.source_type = 'system' AND public.admin_v2_has_permission('manage_system_activity'))
          OR (a.source_type <> 'system' AND a.family_id = public.my_family_id())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_v2_activities a
      WHERE a.id = activity_id
        AND (
          (a.source_type = 'system' AND public.admin_v2_has_permission('manage_system_activity'))
          OR (a.source_type <> 'system' AND a.family_id = public.my_family_id())
        )
    )
  );

DROP POLICY IF EXISTS "admin_v2_records_family" ON public.admin_v2_activity_records;
CREATE POLICY "admin_v2_records_family"
  ON public.admin_v2_activity_records FOR ALL
  USING (family_id = public.my_family_id())
  WITH CHECK (family_id = public.my_family_id());

DROP POLICY IF EXISTS "admin_v2_record_media_family" ON public.admin_v2_activity_record_media;
CREATE POLICY "admin_v2_record_media_family"
  ON public.admin_v2_activity_record_media FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_v2_activity_records r
      WHERE r.id = record_id AND r.family_id = public.my_family_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_v2_activity_records r
      WHERE r.id = record_id AND r.family_id = public.my_family_id()
    )
  );

DROP POLICY IF EXISTS "admin_v2_moderation_cases_admin" ON public.admin_v2_moderation_cases;
CREATE POLICY "admin_v2_moderation_cases_admin"
  ON public.admin_v2_moderation_cases FOR ALL
  USING (public.admin_v2_has_permission('manage_moderation_case'))
  WITH CHECK (public.admin_v2_has_permission('manage_moderation_case'));

DROP POLICY IF EXISTS "admin_v2_audit_events_admin_read" ON public.admin_v2_audit_events;
CREATE POLICY "admin_v2_audit_events_admin_read"
  ON public.admin_v2_audit_events FOR SELECT
  USING (public.admin_v2_has_permission('view_audit') OR actor_id = auth.uid());

-- Tighten legacy audit table without changing its shape.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_audit_log_admin_read" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_admin_read"
  ON public.admin_audit_log FOR SELECT
  USING (public.admin_v2_has_permission('view_audit') OR admin_user_id = auth.uid());
DROP POLICY IF EXISTS "admin_audit_log_admin_insert" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_admin_insert"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (public.admin_v2_has_permission('write_audit') AND admin_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.admin_v2_prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'admin_v2_audit_events_are_append_only' USING errcode = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_v2_audit_events_append_only ON public.admin_v2_audit_events;
CREATE TRIGGER trg_admin_v2_audit_events_append_only
  BEFORE UPDATE OR DELETE ON public.admin_v2_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.admin_v2_prevent_audit_mutation();

CREATE OR REPLACE FUNCTION public.admin_v2_prevent_published_version_content_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'published' AND (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.why IS DISTINCT FROM OLD.why OR
    NEW.how IS DISTINCT FROM OLD.how OR
    NEW.record_hint IS DISTINCT FROM OLD.record_hint OR
    NEW.suggest_mode IS DISTINCT FROM OLD.suggest_mode OR
    NEW.allowed_capture_modes IS DISTINCT FROM OLD.allowed_capture_modes OR
    NEW.illustration_asset_id IS DISTINCT FROM OLD.illustration_asset_id OR
    NEW.family_private_cover_asset_id IS DISTINCT FROM OLD.family_private_cover_asset_id OR
    NEW.illustration_source IS DISTINCT FROM OLD.illustration_source OR
    NEW.illustration_path IS DISTINCT FROM OLD.illustration_path OR
    NEW.perspective IS DISTINCT FROM OLD.perspective OR
    NEW.tone IS DISTINCT FROM OLD.tone OR
    NEW.category IS DISTINCT FROM OLD.category OR
    NEW.scene IS DISTINCT FROM OLD.scene OR
    NEW.tags IS DISTINCT FROM OLD.tags OR
    NEW.min_age IS DISTINCT FROM OLD.min_age OR
    NEW.max_age IS DISTINCT FROM OLD.max_age OR
    NEW.seasonal IS DISTINCT FROM OLD.seasonal OR
    NEW.seal_recommendation IS DISTINCT FROM OLD.seal_recommendation
  ) THEN
    RAISE EXCEPTION 'published_activity_versions_are_content_immutable' USING errcode = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_v2_published_version_content_lock ON public.admin_v2_activity_versions;
CREATE TRIGGER trg_admin_v2_published_version_content_lock
  BEFORE UPDATE ON public.admin_v2_activity_versions
  FOR EACH ROW EXECUTE FUNCTION public.admin_v2_prevent_published_version_content_mutation();

DROP FUNCTION IF EXISTS public.admin_v2_write_audit_event(text, text, text, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.admin_v2_write_audit_event(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_family_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.admin_v2_current_role();
  v_event public.admin_v2_audit_events;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF v_role IS NULL OR NOT public.admin_v2_has_permission('write_audit') THEN
    RAISE EXCEPTION 'not_admin' USING errcode = '42501';
  END IF;
  INSERT INTO public.admin_v2_audit_events (
    actor_id, actor_role, action, target_type, target_id, family_id, reason, metadata
  )
  VALUES (
    v_actor, v_role, p_action, p_target_type, p_target_id, p_family_id, NULLIF(btrim(p_reason), ''), COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_event;

  RETURN jsonb_build_object(
    'id', v_event.id::text,
    'actor_id', v_event.actor_id::text,
    'actor_role', v_event.actor_role,
    'action', v_event.action,
    'target_type', v_event.target_type,
    'target_id', v_event.target_id,
    'family_id', v_event.family_id::text,
    'reason', v_event.reason,
    'metadata', v_event.metadata,
    'created_at', v_event.created_at
  );
END;
$$;

DROP FUNCTION IF EXISTS public.admin_v2_create_moderation_case(text, text, text, uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.admin_v2_require_governance_reason(p_reason text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;
  RETURN v_reason;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_json_text_array(
  p_value jsonb,
  p_default text[] DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_modes text[];
BEGIN
  IF p_value IS NULL OR p_value = 'null'::jsonb THEN
    RETURN p_default;
  END IF;
  IF jsonb_typeof(p_value) <> 'array' THEN
    RAISE EXCEPTION 'allowed_capture_modes_must_be_array';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT mode ORDER BY mode), ARRAY[]::text[])
  INTO v_modes
  FROM jsonb_array_elements_text(p_value) AS mode;

  RETURN v_modes;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_validate_capture_modes(
  p_allowed text[],
  p_suggest text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_allowed IS NULL OR cardinality(p_allowed) = 0 THEN
    RAISE EXCEPTION 'allowed_capture_modes_required';
  END IF;
  IF NOT p_allowed <@ ARRAY['text','photo','video','voice']::text[] THEN
    RAISE EXCEPTION 'invalid_allowed_capture_modes';
  END IF;
  IF p_suggest IS NULL OR p_suggest NOT IN ('text','photo','video','voice') THEN
    RAISE EXCEPTION 'invalid_suggest_mode';
  END IF;
  IF NOT p_suggest = ANY(p_allowed) THEN
    RAISE EXCEPTION 'suggest_mode_not_allowed';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_activity_version_json(v public.admin_v2_activity_versions)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', v.id::text,
    'activity_id', v.activity_id::text,
    'version_no', v.version_no,
    'status', v.status,
    'title', v.title,
    'why', v.why,
    'how', v.how,
    'record_hint', v.record_hint,
    'suggest_mode', v.suggest_mode,
    'allowed_capture_modes', v.allowed_capture_modes,
    'illustration', jsonb_build_object(
      'asset_id', COALESCE(v.illustration_asset_id, v.family_private_cover_asset_id)::text,
      'source', v.illustration_source,
      'path', v.illustration_path
    ),
    'family_id', v.family_id::text,
    'perspective', v.perspective,
    'tone', v.tone,
    'category', v.category,
    'scene', v.scene,
    'tags', v.tags,
    'min_age', v.min_age,
    'max_age', v.max_age,
    'seasonal', v.seasonal,
    'seal_recommendation', v.seal_recommendation,
    'published_at', v.published_at,
    'published_by', v.published_by::text,
    'drafted_by', v.drafted_by::text,
    'review_approved_at', v.review_approved_at,
    'review_approved_by', v.review_approved_by::text,
    'copied_from_version_id', v.copied_from_version_id::text,
    'created_at', v.created_at,
    'updated_at', v.updated_at
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_activity_detail_json(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_activity public.admin_v2_activities;
  v_current jsonb;
  v_versions jsonb;
BEGIN
  SELECT * INTO v_activity
  FROM public.admin_v2_activities
  WHERE id = p_activity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity_not_found';
  END IF;

  SELECT public.admin_v2_activity_version_json(v)
  INTO v_current
  FROM public.admin_v2_activity_versions v
  WHERE v.id = v_activity.current_version_id;

  SELECT COALESCE(jsonb_agg(public.admin_v2_activity_version_json(v) ORDER BY v.version_no DESC), '[]'::jsonb)
  INTO v_versions
  FROM public.admin_v2_activity_versions v
  WHERE v.activity_id = p_activity_id;

  RETURN jsonb_build_object(
    'id', v_activity.id::text,
    'source_type', v_activity.source_type,
    'source_key', v_activity.source_key,
    'display_no', v_activity.display_no,
    'family_id', v_activity.family_id::text,
    'created_by', COALESCE(v_activity.created_by::text, ''),
    'created_at', v_activity.created_at,
    'updated_at', v_activity.updated_at,
    'current_version_id', v_activity.current_version_id::text,
    'status', v_activity.status,
    'visibility', v_activity.visibility,
    'copied_from', CASE
      WHEN v_activity.copied_from_activity_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'activity_id', v_activity.copied_from_activity_id::text,
        'activity_version_id', v_activity.copied_from_version_id::text
      )
    END,
    'deleted_at', v_activity.deleted_at,
    'current_version', v_current,
    'versions', v_versions,
    'audit_metadata', jsonb_build_object('read_model_source', 'activities_v2', 'compatibility_note', NULL)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_moderation_case_json(v public.admin_v2_moderation_cases)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', v.id::text,
    'kind', v.kind,
    'status', v.status,
    'reason', v.reason,
    'target_type', v.target_type,
    'target_id', v.target_id,
    'family_id', v.family_id::text,
    'opened_by', v.opened_by::text,
    'assigned_to', v.assigned_to::text,
    'opened_at', v.opened_at,
    'resolved_at', v.resolved_at,
    'resolution_note', v.resolution_note,
    'audit_event_id', v.audit_event_id::text
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_validate_system_publish(p_activity public.admin_v2_activities, p_version public.admin_v2_activity_versions)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_max_version_no integer;
BEGIN
  IF p_activity.source_type <> 'system' OR p_activity.family_id IS NOT NULL THEN
    RAISE EXCEPTION 'publish_requires_system_activity';
  END IF;
  IF p_version.activity_id <> p_activity.id THEN
    RAISE EXCEPTION 'activity_version_mismatch';
  END IF;
  IF p_version.status <> 'draft' THEN
    RAISE EXCEPTION 'publish_requires_draft_version';
  END IF;
  IF p_version.review_approved_at IS NULL OR p_version.review_approved_by IS NULL THEN
    RAISE EXCEPTION 'publish_blocked_review_not_approved';
  END IF;
  IF NULLIF(btrim(p_version.title), '') IS NULL THEN
    v_missing := array_append(v_missing, 'title');
  END IF;
  IF NULLIF(btrim(p_version.why), '') IS NULL THEN
    v_missing := array_append(v_missing, 'why');
  END IF;
  IF NULLIF(btrim(p_version.how), '') IS NULL THEN
    v_missing := array_append(v_missing, 'how');
  END IF;
  IF NULLIF(btrim(p_version.record_hint), '') IS NULL THEN
    v_missing := array_append(v_missing, 'record_hint');
  END IF;
  IF p_version.suggest_mode IS NULL THEN
    v_missing := array_append(v_missing, 'suggest_mode');
  END IF;
  IF p_version.allowed_capture_modes IS NULL OR cardinality(p_version.allowed_capture_modes) = 0 THEN
    v_missing := array_append(v_missing, 'allowed_capture_modes');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'validation_failed_missing_fields:%', array_to_string(v_missing, ',');
  END IF;

  PERFORM public.admin_v2_validate_capture_modes(p_version.allowed_capture_modes, p_version.suggest_mode);

  SELECT COALESCE(max(version_no), 0)
  INTO v_max_version_no
  FROM public.admin_v2_activity_versions
  WHERE activity_id = p_activity.id
    AND status IN ('published','archived','unpublished')
    AND id <> p_version.id;
  IF p_version.version_no <= v_max_version_no THEN
    RAISE EXCEPTION 'publish_blocked_version_not_incremental';
  END IF;

  IF p_version.illustration_source = 'system_asset' THEN
    IF p_version.illustration_asset_id IS NULL OR p_version.family_private_cover_asset_id IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_illustration_source';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_v2_system_illustration_assets a
      WHERE a.id = p_version.illustration_asset_id AND a.status = 'active'
    ) THEN
      RAISE EXCEPTION 'invalid_illustration_asset';
    END IF;
  ELSIF p_version.illustration_source = 'family_private' THEN
    RAISE EXCEPTION 'system_activity_cannot_publish_family_private_asset';
  ELSIF p_version.illustration_source IN ('motif_fallback','none') THEN
    IF p_version.illustration_asset_id IS NOT NULL OR p_version.family_private_cover_asset_id IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_illustration_source';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_illustration_source';
  END IF;

  IF p_version.seal_recommendation IS NOT NULL THEN
    IF jsonb_typeof(p_version.seal_recommendation) <> 'object'
      OR NOT p_version.seal_recommendation ? 'default_state'
      OR NOT p_version.seal_recommendation ? 'kind'
      OR p_version.seal_recommendation->>'default_state' NOT IN ('recommend_unsealed','recommend_sealed')
      OR p_version.seal_recommendation->>'kind' NOT IN ('none','until_date','age_based','manual_prompt')
      OR p_version.seal_recommendation ? 'sealed'
      OR p_version.seal_recommendation ? 'seal_until' THEN
      RAISE EXCEPTION 'invalid_seal_recommendation';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_list_moderation_cases(
  p_options jsonb DEFAULT '{}'::jsonb
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_options jsonb := COALESCE(p_options, '{}'::jsonb);
  v_status text := NULLIF(COALESCE(v_options->>'status', v_options->>'moderationStatus'), 'all');
  v_kind text := NULLIF(v_options->>'kind', 'all');
  v_search text := NULLIF(btrim(v_options->>'search'), '');
  v_limit integer := LEAST(GREATEST(COALESCE((v_options->>'limit')::integer, 50), 1), 200);
  v_offset integer := GREATEST(COALESCE((v_options->>'offset')::integer, 0), 0);
BEGIN
  IF NOT public.admin_v2_has_permission('manage_moderation_case') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_status IS NOT NULL AND v_status NOT IN ('open','in_review','resolved','rejected','closed') THEN
    RAISE EXCEPTION 'invalid_moderation_case_status';
  END IF;
  IF v_kind IS NOT NULL AND v_kind NOT IN ('record_review','activity_review','asset_review','family_support','policy_violation','public_request') THEN
    RAISE EXCEPTION 'invalid_moderation_case_kind';
  END IF;

  RETURN QUERY
    SELECT public.admin_v2_moderation_case_json(c)
    FROM public.admin_v2_moderation_cases c
    WHERE (v_status IS NULL OR c.status = v_status)
      AND (v_kind IS NULL OR c.kind = v_kind)
      AND (
        v_search IS NULL
        OR c.id::text ILIKE '%' || v_search || '%'
        OR c.reason ILIKE '%' || v_search || '%'
        OR c.target_id ILIKE '%' || v_search || '%'
        OR c.family_id::text ILIKE '%' || v_search || '%'
      )
    ORDER BY c.opened_at DESC, c.created_at DESC
    LIMIT v_limit
    OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_create_activity_draft(
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.admin_v2_current_role();
  v_input jsonb := COALESCE(p_input, '{}'::jsonb);
  v_source_type text := COALESCE(v_input->>'sourceType', v_input->>'source_type');
  v_family_id uuid := NULLIF(COALESCE(v_input->>'familyId', v_input->>'family_id'), '')::uuid;
  v_title text := NULLIF(btrim(v_input->>'title'), '');
  v_allowed text[] := public.admin_v2_json_text_array(COALESCE(v_input->'allowedCaptureModes', v_input->'allowed_capture_modes'), NULL);
  v_suggest text;
  v_reason text;
  v_activity public.admin_v2_activities;
  v_version public.admin_v2_activity_versions;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF v_source_type NOT IN ('system','family') THEN
    RAISE EXCEPTION 'invalid_activity_source_type';
  END IF;
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'validation_failed_missing_fields:title';
  END IF;

  v_suggest := COALESCE(NULLIF(COALESCE(v_input->>'suggestMode', v_input->>'suggest_mode'), ''), v_allowed[1]);
  PERFORM public.admin_v2_validate_capture_modes(v_allowed, v_suggest);

  IF v_source_type = 'system' THEN
    IF v_role NOT IN ('content_editor','system_admin') THEN
      RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
    END IF;
    IF v_family_id IS NOT NULL THEN
      RAISE EXCEPTION 'system_activity_family_id_forbidden';
    END IF;
  ELSE
    IF v_role NOT IN ('family_support','system_admin') THEN
      RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
    END IF;
    v_reason := public.admin_v2_require_governance_reason(COALESCE(v_input->>'governanceReason', v_input->>'governance_reason'));
    IF v_family_id IS NULL THEN
      RAISE EXCEPTION 'validation_failed_missing_fields:familyId';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.families f WHERE f.id = v_family_id) THEN
      RAISE EXCEPTION 'family_not_found';
    END IF;
  END IF;

  INSERT INTO public.admin_v2_activities (
    source_type, source_key, display_no, family_id, created_by, status, visibility, created_at, updated_at
  )
  VALUES (
    v_source_type,
    v_source_type || ':draft:' || v_actor::text || ':' || extract(epoch FROM clock_timestamp())::text,
    NULLIF(btrim(COALESCE(v_input->>'displayNo', v_input->>'display_no')), ''),
    v_family_id,
    v_actor,
    'draft',
    CASE WHEN v_source_type = 'system' THEN 'system' ELSE 'family_private' END,
    now(),
    now()
  )
  RETURNING * INTO v_activity;

  INSERT INTO public.admin_v2_activity_versions (
    activity_id, version_no, status, title, why, how, record_hint, suggest_mode, allowed_capture_modes,
    illustration_source, family_id, drafted_by, created_at, updated_at
  )
  VALUES (
    v_activity.id, 1, 'draft', v_title, COALESCE(v_input->>'why', ''), COALESCE(v_input->>'how', ''),
    COALESCE(COALESCE(v_input->>'recordHint', v_input->>'record_hint'), ''), v_suggest, v_allowed,
    'none', v_family_id, v_actor, now(), now()
  )
  RETURNING * INTO v_version;

  UPDATE public.admin_v2_activities
  SET current_version_id = v_version.id,
      updated_at = now()
  WHERE id = v_activity.id;

  PERFORM public.admin_v2_write_audit_event(
    'create',
    'activity',
    v_activity.id::text,
    v_reason,
    jsonb_build_object('rpc', 'admin_v2_create_activity_draft', 'source_type', v_source_type, 'version_id', v_version.id::text),
    v_family_id
  );

  RETURN public.admin_v2_activity_detail_json(v_activity.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_update_activity_draft(
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.admin_v2_current_role();
  v_input jsonb := COALESCE(p_input, '{}'::jsonb);
  v_patch jsonb := COALESCE(v_input->'patch', '{}'::jsonb);
  v_activity_id uuid := NULLIF(COALESCE(v_input->>'activityId', v_input->>'activity_id'), '')::uuid;
  v_version_id uuid := NULLIF(COALESCE(v_input->>'versionId', v_input->>'version_id'), '')::uuid;
  v_activity public.admin_v2_activities;
  v_version public.admin_v2_activity_versions;
  v_allowed text[];
  v_suggest text;
  v_illustration jsonb;
  v_illustration_source text;
  v_illustration_asset_id uuid;
  v_family_private_cover_asset_id uuid;
  v_illustration_path text;
  v_reason text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;

  SELECT * INTO v_activity
  FROM public.admin_v2_activities
  WHERE id = v_activity_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity_not_found';
  END IF;

  SELECT * INTO v_version
  FROM public.admin_v2_activity_versions
  WHERE id = v_version_id AND activity_id = v_activity.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity_version_not_found';
  END IF;
  IF v_version.status <> 'draft' THEN
    RAISE EXCEPTION 'immutable_violation_only_draft_versions_can_be_edited' USING errcode = '42501';
  END IF;

  IF v_activity.source_type = 'system' THEN
    IF v_role NOT IN ('content_editor','system_admin') THEN
      RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
    END IF;
  ELSE
    IF v_role NOT IN ('family_support','system_admin') THEN
      RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
    END IF;
    v_reason := public.admin_v2_require_governance_reason(COALESCE(v_input->>'governanceReason', v_input->>'governance_reason'));
  END IF;

  v_allowed := public.admin_v2_json_text_array(COALESCE(v_patch->'allowed_capture_modes', v_patch->'allowedCaptureModes'), v_version.allowed_capture_modes);
  v_suggest := COALESCE(NULLIF(COALESCE(v_patch->>'suggest_mode', v_patch->>'suggestMode'), ''), v_version.suggest_mode);
  PERFORM public.admin_v2_validate_capture_modes(v_allowed, v_suggest);

  v_illustration_source := v_version.illustration_source;
  v_illustration_asset_id := v_version.illustration_asset_id;
  v_family_private_cover_asset_id := v_version.family_private_cover_asset_id;
  v_illustration_path := v_version.illustration_path;

  IF v_patch ? 'illustration' THEN
    v_illustration := v_patch->'illustration';
    v_illustration_source := COALESCE(NULLIF(v_illustration->>'source', ''), 'none');
    v_illustration_path := NULLIF(v_illustration->>'path', '');
    v_illustration_asset_id := NULL;
    v_family_private_cover_asset_id := NULL;

    IF v_illustration_source = 'system_asset' THEN
      v_illustration_asset_id := NULLIF(v_illustration->>'asset_id', '')::uuid;
      IF v_illustration_asset_id IS NULL THEN
        RAISE EXCEPTION 'validation_failed_missing_fields:illustration.asset_id';
      END IF;
      SELECT a.path INTO v_illustration_path
      FROM public.admin_v2_system_illustration_assets a
      WHERE a.id = v_illustration_asset_id AND a.status = 'active';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_illustration_asset';
      END IF;
    ELSIF v_illustration_source = 'family_private' THEN
      v_family_private_cover_asset_id := NULLIF(v_illustration->>'asset_id', '')::uuid;
      IF v_activity.source_type = 'system' THEN
        RAISE EXCEPTION 'system_activity_cannot_use_family_private_asset';
      END IF;
      IF v_family_private_cover_asset_id IS NULL THEN
        RAISE EXCEPTION 'validation_failed_missing_fields:illustration.asset_id';
      END IF;
      SELECT a.path INTO v_illustration_path
      FROM public.admin_v2_family_private_cover_assets a
      WHERE a.id = v_family_private_cover_asset_id AND a.family_id = v_activity.family_id AND a.status = 'active';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_family_private_cover_asset';
      END IF;
    ELSIF v_illustration_source NOT IN ('motif_fallback','none') THEN
      RAISE EXCEPTION 'invalid_illustration_source';
    END IF;
  END IF;

  UPDATE public.admin_v2_activity_versions
  SET title = CASE WHEN v_patch ? 'title' THEN COALESCE(NULLIF(btrim(v_patch->>'title'), ''), title) ELSE title END,
      why = CASE WHEN v_patch ? 'why' THEN COALESCE(v_patch->>'why', '') ELSE why END,
      how = CASE WHEN v_patch ? 'how' THEN COALESCE(v_patch->>'how', '') ELSE how END,
      record_hint = CASE
        WHEN v_patch ? 'record_hint' THEN COALESCE(v_patch->>'record_hint', '')
        WHEN v_patch ? 'recordHint' THEN COALESCE(v_patch->>'recordHint', '')
        ELSE record_hint
      END,
      suggest_mode = v_suggest,
      allowed_capture_modes = v_allowed,
      illustration_asset_id = v_illustration_asset_id,
      family_private_cover_asset_id = v_family_private_cover_asset_id,
      illustration_source = v_illustration_source,
      illustration_path = v_illustration_path,
      perspective = CASE WHEN v_patch ? 'perspective' THEN NULLIF(v_patch->>'perspective', '') ELSE perspective END,
      tone = CASE WHEN v_patch ? 'tone' THEN NULLIF(v_patch->>'tone', '') ELSE tone END,
      category = CASE WHEN v_patch ? 'category' THEN NULLIF(v_patch->>'category', '') ELSE category END,
      scene = CASE WHEN v_patch ? 'scene' THEN NULLIF(v_patch->>'scene', '') ELSE scene END,
      tags = CASE WHEN v_patch ? 'tags' THEN public.admin_v2_json_text_array(v_patch->'tags', NULL) ELSE tags END,
      min_age = CASE WHEN v_patch ? 'min_age' THEN NULLIF(v_patch->>'min_age', '')::smallint ELSE min_age END,
      max_age = CASE WHEN v_patch ? 'max_age' THEN NULLIF(v_patch->>'max_age', '')::smallint ELSE max_age END,
      seasonal = CASE WHEN v_patch ? 'seasonal' THEN (v_patch->>'seasonal')::boolean ELSE seasonal END,
      seal_recommendation = CASE WHEN v_patch ? 'seal_recommendation' THEN v_patch->'seal_recommendation' ELSE seal_recommendation END,
      review_approved_at = NULL,
      review_approved_by = NULL,
      updated_at = now()
  WHERE id = v_version_id
  RETURNING * INTO v_version;

  UPDATE public.admin_v2_activities
  SET updated_at = now()
  WHERE id = v_activity.id;

  PERFORM public.admin_v2_write_audit_event(
    'update',
    'activity_version',
    v_version.id::text,
    v_reason,
    jsonb_build_object('rpc', 'admin_v2_update_activity_draft', 'activity_id', v_activity.id::text, 'patch_keys', (
      SELECT COALESCE(jsonb_agg(k), '[]'::jsonb) FROM jsonb_object_keys(v_patch) AS k
    )),
    v_activity.family_id
  );

  RETURN public.admin_v2_activity_detail_json(v_activity.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_copy_system_activity_to_family(
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.admin_v2_current_role();
  v_input jsonb := COALESCE(p_input, '{}'::jsonb);
  v_activity_id uuid := NULLIF(COALESCE(v_input->>'activityId', v_input->>'activity_id'), '')::uuid;
  v_version_id uuid := NULLIF(COALESCE(v_input->>'activityVersionId', v_input->>'activity_version_id'), '')::uuid;
  v_family_id uuid := NULLIF(COALESCE(v_input->>'familyId', v_input->>'family_id'), '')::uuid;
  v_reason text;
  v_source_activity public.admin_v2_activities;
  v_source_version public.admin_v2_activity_versions;
  v_activity public.admin_v2_activities;
  v_version public.admin_v2_activity_versions;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF v_role NOT IN ('family_support','system_admin') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  v_reason := public.admin_v2_require_governance_reason(COALESCE(v_input->>'governanceReason', v_input->>'governance_reason'));
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'validation_failed_missing_fields:familyId';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.families f WHERE f.id = v_family_id) THEN
    RAISE EXCEPTION 'family_not_found';
  END IF;

  SELECT * INTO v_source_activity
  FROM public.admin_v2_activities
  WHERE id = v_activity_id AND source_type = 'system' AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'system_activity_not_found';
  END IF;

  IF v_version_id IS NULL THEN
    v_version_id := v_source_activity.current_version_id;
  END IF;

  SELECT * INTO v_source_version
  FROM public.admin_v2_activity_versions
  WHERE id = v_version_id
    AND activity_id = v_source_activity.id
    AND status = 'published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'published_system_activity_version_not_found';
  END IF;

  INSERT INTO public.admin_v2_activities (
    source_type, source_key, display_no, family_id, created_by, status, visibility,
    copied_from_activity_id, copied_from_version_id, created_at, updated_at
  )
  VALUES (
    'copied_family',
    'copied_family:' || v_family_id::text || ':' || v_source_activity.id::text || ':' || v_source_version.id::text || ':' || extract(epoch FROM clock_timestamp())::text,
    v_source_activity.display_no,
    v_family_id,
    v_actor,
    'published',
    'family_private',
    v_source_activity.id,
    v_source_version.id,
    now(),
    now()
  )
  RETURNING * INTO v_activity;

  INSERT INTO public.admin_v2_activity_versions (
    activity_id, version_no, status, title, why, how, record_hint, suggest_mode, allowed_capture_modes,
    illustration_asset_id, family_private_cover_asset_id, illustration_source, illustration_path, family_id,
    perspective, tone, category, scene, tags, min_age, max_age, seasonal, seal_recommendation,
    published_at, published_by, drafted_by, copied_from_version_id, created_at, updated_at
  )
  VALUES (
    v_activity.id, 1, 'published', v_source_version.title, v_source_version.why, v_source_version.how,
    v_source_version.record_hint, v_source_version.suggest_mode, v_source_version.allowed_capture_modes,
    v_source_version.illustration_asset_id, NULL,
    CASE WHEN v_source_version.illustration_source = 'family_private' THEN 'none' ELSE v_source_version.illustration_source END,
    v_source_version.illustration_path, v_family_id, v_source_version.perspective, v_source_version.tone,
    v_source_version.category, v_source_version.scene, v_source_version.tags, v_source_version.min_age,
    v_source_version.max_age, v_source_version.seasonal, v_source_version.seal_recommendation,
    now(), v_actor, v_actor, v_source_version.id, now(), now()
  )
  RETURNING * INTO v_version;

  UPDATE public.admin_v2_activities
  SET current_version_id = v_version.id,
      updated_at = now()
  WHERE id = v_activity.id;

  PERFORM public.admin_v2_write_audit_event(
    'copy',
    'activity',
    v_activity.id::text,
    v_reason,
    jsonb_build_object(
      'rpc', 'admin_v2_copy_system_activity_to_family',
      'copied_from_activity_id', v_source_activity.id::text,
      'copied_from_version_id', v_source_version.id::text,
      'version_id', v_version.id::text
    ),
    v_family_id
  );

  RETURN public.admin_v2_activity_detail_json(v_activity.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_create_activity_version(
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.admin_v2_current_role();
  v_input jsonb := COALESCE(p_input, '{}'::jsonb);
  v_activity_id uuid := NULLIF(COALESCE(v_input->>'activityId', v_input->>'activity_id'), '')::uuid;
  v_activity public.admin_v2_activities;
  v_base public.admin_v2_activity_versions;
  v_version public.admin_v2_activity_versions;
  v_allowed text[];
  v_suggest text;
  v_version_no integer;
  v_reason text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;

  SELECT * INTO v_activity
  FROM public.admin_v2_activities
  WHERE id = v_activity_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity_not_found';
  END IF;

  IF v_activity.source_type = 'system' THEN
    IF v_role NOT IN ('content_editor','system_admin') THEN
      RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
    END IF;
  ELSE
    IF v_role NOT IN ('family_support','system_admin') THEN
      RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
    END IF;
    v_reason := public.admin_v2_require_governance_reason(COALESCE(v_input->>'governanceReason', v_input->>'governance_reason'));
  END IF;

  SELECT * INTO v_base
  FROM public.admin_v2_activity_versions
  WHERE activity_id = v_activity.id
  ORDER BY version_no DESC
  LIMIT 1;

  SELECT COALESCE(max(version_no), 0) + 1
  INTO v_version_no
  FROM public.admin_v2_activity_versions
  WHERE activity_id = v_activity.id;

  v_allowed := public.admin_v2_json_text_array(
    COALESCE(v_input->'allowed_capture_modes', v_input->'allowedCaptureModes'),
    COALESCE(v_base.allowed_capture_modes, ARRAY['text','photo','video','voice']::text[])
  );
  v_suggest := COALESCE(NULLIF(COALESCE(v_input->>'suggest_mode', v_input->>'suggestMode'), ''), v_base.suggest_mode, v_allowed[1]);
  PERFORM public.admin_v2_validate_capture_modes(v_allowed, v_suggest);

  INSERT INTO public.admin_v2_activity_versions (
    activity_id, version_no, status, title, why, how, record_hint, suggest_mode, allowed_capture_modes,
    illustration_asset_id, family_private_cover_asset_id, illustration_source, illustration_path, family_id,
    perspective, tone, category, scene, tags, min_age, max_age, seasonal, seal_recommendation,
    drafted_by, copied_from_version_id, created_at, updated_at
  )
  VALUES (
    v_activity.id, v_version_no, 'draft',
    COALESCE(NULLIF(v_input->>'title', ''), v_base.title),
    COALESCE(v_input->>'why', v_base.why, ''),
    COALESCE(v_input->>'how', v_base.how, ''),
    COALESCE(COALESCE(v_input->>'record_hint', v_input->>'recordHint'), v_base.record_hint, ''),
    v_suggest,
    v_allowed,
    v_base.illustration_asset_id,
    v_base.family_private_cover_asset_id,
    COALESCE(v_base.illustration_source, 'none'),
    v_base.illustration_path,
    v_activity.family_id,
    COALESCE(NULLIF(v_input->>'perspective', ''), v_base.perspective),
    COALESCE(NULLIF(v_input->>'tone', ''), v_base.tone),
    COALESCE(NULLIF(v_input->>'category', ''), v_base.category),
    COALESCE(NULLIF(v_input->>'scene', ''), v_base.scene),
    COALESCE(public.admin_v2_json_text_array(v_input->'tags', NULL), v_base.tags),
    COALESCE(NULLIF(v_input->>'min_age', '')::smallint, v_base.min_age),
    COALESCE(NULLIF(v_input->>'max_age', '')::smallint, v_base.max_age),
    COALESCE((v_input->>'seasonal')::boolean, v_base.seasonal),
    COALESCE(v_input->'seal_recommendation', v_base.seal_recommendation),
    v_actor,
    v_base.id,
    now(),
    now()
  )
  RETURNING * INTO v_version;

  UPDATE public.admin_v2_activities
  SET updated_at = now()
  WHERE id = v_activity.id;

  PERFORM public.admin_v2_write_audit_event(
    'create',
    'activity_version',
    v_version.id::text,
    v_reason,
    jsonb_build_object('rpc', 'admin_v2_create_activity_version', 'activity_id', v_activity.id::text, 'copied_from_version_id', v_base.id::text),
    v_activity.family_id
  );

  RETURN public.admin_v2_activity_version_json(v_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_approve_activity_version(
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_input jsonb := COALESCE(p_input, '{}'::jsonb);
  v_activity_id uuid := NULLIF(COALESCE(v_input->>'activityId', v_input->>'activity_id'), '')::uuid;
  v_version_id uuid := NULLIF(COALESCE(v_input->>'versionId', v_input->>'version_id'), '')::uuid;
  v_activity public.admin_v2_activities;
  v_version public.admin_v2_activity_versions;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF NOT public.admin_v2_has_role(ARRAY['content_reviewer','system_admin']) THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;

  SELECT * INTO v_activity
  FROM public.admin_v2_activities
  WHERE id = v_activity_id AND source_type = 'system' AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'system_activity_not_found';
  END IF;

  UPDATE public.admin_v2_activity_versions
  SET review_approved_at = now(),
      review_approved_by = v_actor,
      updated_at = now()
  WHERE id = v_version_id
    AND activity_id = v_activity.id
    AND status = 'draft'
  RETURNING * INTO v_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'draft_activity_version_not_found';
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'approve_review',
    'activity_version',
    v_version.id::text,
    NULLIF(btrim(v_input->>'reason'), ''),
    jsonb_build_object('rpc', 'admin_v2_approve_activity_version', 'activity_id', v_activity.id::text),
    NULL
  );

  RETURN public.admin_v2_activity_version_json(v_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_publish_activity_version(
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_input jsonb := COALESCE(p_input, '{}'::jsonb);
  v_activity_id uuid := NULLIF(COALESCE(v_input->>'activityId', v_input->>'activity_id'), '')::uuid;
  v_version_id uuid := NULLIF(COALESCE(v_input->>'versionId', v_input->>'version_id'), '')::uuid;
  v_activity public.admin_v2_activities;
  v_version public.admin_v2_activity_versions;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF NOT public.admin_v2_has_role(ARRAY['system_admin']) THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;

  SELECT * INTO v_activity
  FROM public.admin_v2_activities
  WHERE id = v_activity_id AND source_type = 'system' AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'system_activity_not_found';
  END IF;

  SELECT * INTO v_version
  FROM public.admin_v2_activity_versions
  WHERE id = v_version_id AND activity_id = v_activity.id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity_version_not_found';
  END IF;

  PERFORM public.admin_v2_validate_system_publish(v_activity, v_version);

  UPDATE public.admin_v2_activity_versions
  SET status = 'archived',
      updated_at = now()
  WHERE activity_id = v_activity.id
    AND id <> v_version.id
    AND status = 'published';

  UPDATE public.admin_v2_activity_versions
  SET status = 'published',
      published_at = now(),
      published_by = v_actor,
      updated_at = now()
  WHERE id = v_version.id
  RETURNING * INTO v_version;

  UPDATE public.admin_v2_activities
  SET current_version_id = v_version.id,
      status = 'published',
      updated_at = now()
  WHERE id = v_activity.id;

  PERFORM public.admin_v2_write_audit_event(
    'publish',
    'activity_version',
    v_version.id::text,
    NULLIF(btrim(v_input->>'reason'), ''),
    jsonb_build_object('rpc', 'admin_v2_publish_activity_version', 'activity_id', v_activity.id::text, 'version_no', v_version.version_no),
    NULL
  );

  RETURN public.admin_v2_activity_version_json(v_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_unpublish_activity_version(
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_input jsonb := COALESCE(p_input, '{}'::jsonb);
  v_activity_id uuid := NULLIF(COALESCE(v_input->>'activityId', v_input->>'activity_id'), '')::uuid;
  v_version_id uuid := NULLIF(COALESCE(v_input->>'versionId', v_input->>'version_id'), '')::uuid;
  v_activity public.admin_v2_activities;
  v_version public.admin_v2_activity_versions;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF NOT public.admin_v2_has_role(ARRAY['system_admin']) THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;

  SELECT * INTO v_activity
  FROM public.admin_v2_activities
  WHERE id = v_activity_id AND source_type = 'system' AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'system_activity_not_found';
  END IF;

  UPDATE public.admin_v2_activity_versions
  SET status = 'unpublished',
      updated_at = now()
  WHERE id = v_version_id
    AND activity_id = v_activity.id
    AND status = 'published'
  RETURNING * INTO v_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'published_activity_version_not_found';
  END IF;

  UPDATE public.admin_v2_activities
  SET current_version_id = v_version.id,
      status = 'unpublished',
      updated_at = now()
  WHERE id = v_activity.id;

  PERFORM public.admin_v2_write_audit_event(
    'unpublish',
    'activity_version',
    v_version.id::text,
    NULLIF(btrim(v_input->>'reason'), ''),
    jsonb_build_object('rpc', 'admin_v2_unpublish_activity_version', 'activity_id', v_activity.id::text),
    NULL
  );

  RETURN public.admin_v2_activity_version_json(v_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_archive_activity_version(
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_input jsonb := COALESCE(p_input, '{}'::jsonb);
  v_activity_id uuid := NULLIF(COALESCE(v_input->>'activityId', v_input->>'activity_id'), '')::uuid;
  v_version_id uuid := NULLIF(COALESCE(v_input->>'versionId', v_input->>'version_id'), '')::uuid;
  v_activity public.admin_v2_activities;
  v_version public.admin_v2_activity_versions;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF NOT public.admin_v2_has_role(ARRAY['system_admin']) THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;

  SELECT * INTO v_activity
  FROM public.admin_v2_activities
  WHERE id = v_activity_id AND source_type = 'system' AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'system_activity_not_found';
  END IF;

  UPDATE public.admin_v2_activity_versions
  SET status = 'archived',
      updated_at = now()
  WHERE id = v_version_id
    AND activity_id = v_activity.id
    AND status IN ('draft','unpublished','published')
  RETURNING * INTO v_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity_version_not_found';
  END IF;

  IF v_activity.current_version_id = v_version.id THEN
    UPDATE public.admin_v2_activities
    SET status = 'archived',
        current_version_id = v_version.id,
        updated_at = now()
    WHERE id = v_activity.id;
  ELSE
    UPDATE public.admin_v2_activities
    SET updated_at = now()
    WHERE id = v_activity.id;
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'archive',
    'activity_version',
    v_version.id::text,
    NULLIF(btrim(v_input->>'reason'), ''),
    jsonb_build_object('rpc', 'admin_v2_archive_activity_version', 'activity_id', v_activity.id::text),
    NULL
  );

  RETURN public.admin_v2_activity_version_json(v_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_create_moderation_case(
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_input jsonb := COALESCE(p_input, '{}'::jsonb);
  v_kind text := COALESCE(v_input->>'kind', '');
  v_target_type text := COALESCE(v_input->>'targetType', v_input->>'target_type');
  v_target_id text := COALESCE(v_input->>'targetId', v_input->>'target_id');
  v_family_id uuid := NULLIF(COALESCE(v_input->>'familyId', v_input->>'family_id'), '')::uuid;
  v_reason text := public.admin_v2_require_governance_reason(v_input->>'reason');
  v_audit jsonb;
  v_case public.admin_v2_moderation_cases;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF NOT public.admin_v2_has_permission('manage_moderation_case') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_kind NOT IN ('record_review','activity_review','asset_review','family_support','policy_violation','public_request') THEN
    RAISE EXCEPTION 'invalid_moderation_case_kind';
  END IF;
  IF v_target_type NOT IN ('activity','activity_version','record','asset','family') THEN
    RAISE EXCEPTION 'invalid_moderation_case_target_type';
  END IF;
  IF NULLIF(btrim(v_target_id), '') IS NULL THEN
    RAISE EXCEPTION 'validation_failed_missing_fields:targetId';
  END IF;

  INSERT INTO public.admin_v2_moderation_cases (
    kind, target_type, target_id, family_id, reason, opened_by, assigned_to
  )
  VALUES (
    v_kind, v_target_type, v_target_id, v_family_id, v_reason, v_actor,
    NULLIF(COALESCE(v_input->>'assignedTo', v_input->>'assigned_to'), '')::uuid
  )
  RETURNING * INTO v_case;

  v_audit := public.admin_v2_write_audit_event(
    'create',
    'moderation_case',
    v_case.id::text,
    v_reason,
    jsonb_build_object(
      'rpc', 'admin_v2_create_moderation_case',
      'kind', v_kind,
      'target_type', v_target_type,
      'target_id', v_target_id
    ),
    v_family_id
  );

  UPDATE public.admin_v2_moderation_cases
  SET audit_event_id = (v_audit->>'id')::uuid,
      updated_at = now()
  WHERE id = v_case.id
  RETURNING * INTO v_case;

  RETURN public.admin_v2_moderation_case_json(v_case);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_resolve_moderation_case(
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_input jsonb := COALESCE(p_input, '{}'::jsonb);
  v_case_id uuid := NULLIF(COALESCE(v_input->>'caseId', v_input->>'case_id'), '')::uuid;
  v_status text := v_input->>'status';
  v_note text := public.admin_v2_require_governance_reason(COALESCE(v_input->>'resolutionNote', v_input->>'resolution_note'));
  v_case public.admin_v2_moderation_cases;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF NOT public.admin_v2_has_permission('manage_moderation_case') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_status NOT IN ('resolved','rejected','closed') THEN
    RAISE EXCEPTION 'invalid_moderation_case_resolution_status';
  END IF;

  UPDATE public.admin_v2_moderation_cases
  SET status = v_status,
      resolved_at = now(),
      resolution_note = v_note,
      updated_at = now()
  WHERE id = v_case_id
    AND status IN ('open','in_review')
  RETURNING * INTO v_case;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'open_moderation_case_not_found';
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'moderate',
    'moderation_case',
    v_case.id::text,
    v_note,
    jsonb_build_object(
      'rpc', 'admin_v2_resolve_moderation_case',
      'status', v_status,
      'target_type', v_case.target_type,
      'target_id', v_case.target_id
    ),
    v_case.family_id
  );

  RETURN public.admin_v2_moderation_case_json(v_case);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_access_private_record(
  p_record_id uuid,
  p_governance_reason text,
  p_moderation_case_id uuid DEFAULT NULL
)
RETURNS public.admin_v2_activity_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(p_governance_reason), '');
  v_record public.admin_v2_activity_records;
BEGIN
  IF NOT public.admin_v2_has_permission('view_private_record') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;

  SELECT * INTO v_record
  FROM public.admin_v2_activity_records
  WHERE id = p_record_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_not_found';
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'view_private',
    'record',
    p_record_id::text,
    v_reason,
    jsonb_build_object('moderation_case_id', p_moderation_case_id),
    v_record.family_id
  );

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_access_private_record_media(
  p_record_id uuid,
  p_governance_reason text,
  p_moderation_case_id uuid DEFAULT NULL
)
RETURNS SETOF public.admin_v2_activity_record_media
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(p_governance_reason), '');
  v_family_id uuid;
BEGIN
  IF NOT public.admin_v2_has_permission('view_private_record') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;

  SELECT family_id INTO v_family_id
  FROM public.admin_v2_activity_records
  WHERE id = p_record_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_not_found';
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'view_private',
    'record',
    p_record_id::text,
    v_reason,
    jsonb_build_object('media', true, 'moderation_case_id', p_moderation_case_id),
    v_family_id
  );

  RETURN QUERY
    SELECT *
    FROM public.admin_v2_activity_record_media
    WHERE record_id = p_record_id
    ORDER BY order_index, created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_access_family_private_cover(
  p_asset_id uuid,
  p_governance_reason text,
  p_moderation_case_id uuid DEFAULT NULL
)
RETURNS public.admin_v2_family_private_cover_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(p_governance_reason), '');
  v_asset public.admin_v2_family_private_cover_assets;
BEGIN
  IF NOT public.admin_v2_has_permission('view_family_private_asset') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;

  SELECT * INTO v_asset
  FROM public.admin_v2_family_private_cover_assets
  WHERE id = p_asset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'asset_not_found';
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'view_private',
    'asset',
    p_asset_id::text,
    v_reason,
    jsonb_build_object('asset_kind', 'family_private_cover', 'moderation_case_id', p_moderation_case_id),
    v_asset.family_id
  );

  RETURN v_asset;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_access_family_activity(
  p_activity_id uuid,
  p_governance_reason text,
  p_moderation_case_id uuid DEFAULT NULL
)
RETURNS public.admin_v2_activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(p_governance_reason), '');
  v_activity public.admin_v2_activities;
BEGIN
  IF NOT public.admin_v2_has_permission('view_family_activity') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;

  SELECT * INTO v_activity
  FROM public.admin_v2_activities
  WHERE id = p_activity_id AND source_type <> 'system';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity_not_found';
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'view_private',
    'activity',
    p_activity_id::text,
    v_reason,
    jsonb_build_object('moderation_case_id', p_moderation_case_id),
    v_activity.family_id
  );

  RETURN v_activity;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text := public.admin_v2_current_role();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'not_admin' USING errcode = '42501';
  END IF;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'users', (SELECT count(*) FROM public.profiles),
      'families', (SELECT count(*) FROM public.families),
      'kids', (SELECT count(*) FROM public.kids),
      'memories', (SELECT count(*) FROM public.memories),
      'pending_review', (SELECT count(*) FROM public.admin_v2_activity_records WHERE moderation_status = 'pending' AND deleted_at IS NULL),
      'notification_queue', (SELECT count(*) FROM public.notification_outbox WHERE status IN ('pending','processing')),
      'system_activities', (SELECT count(*) FROM public.admin_v2_activities WHERE source_type = 'system' AND deleted_at IS NULL),
      'family_activities', (SELECT count(*) FROM public.admin_v2_activities WHERE source_type <> 'system' AND deleted_at IS NULL),
      'published_versions', (SELECT count(*) FROM public.admin_v2_activity_versions WHERE status = 'published'),
      'assets', (
        (SELECT count(*) FROM public.admin_v2_system_illustration_assets WHERE status = 'active') +
        (SELECT count(*) FROM public.admin_v2_family_private_cover_assets WHERE status = 'active')
      ),
      'moderation_cases', (SELECT count(*) FROM public.admin_v2_moderation_cases WHERE status IN ('open','in_review')),
      'audit_events', (SELECT count(*) FROM public.admin_v2_audit_events)
    ),
    'daily', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'day', d.day::text,
          'new_users', COALESCE(u.new_users, 0),
          'new_memories', COALESCE(m.new_memories, 0),
          'active_families', COALESCE(m.active_families, 0)
        )
        ORDER BY d.day
      ), '[]'::jsonb)
      FROM generate_series((current_date - interval '13 days')::date, current_date, interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', created_at)::date AS day, count(*) AS new_users
        FROM public.profiles
        WHERE created_at >= current_date - interval '13 days'
        GROUP BY 1
      ) u ON u.day = d.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at)::date AS day, count(*) AS new_memories, count(DISTINCT family_id) AS active_families
        FROM public.memories
        WHERE created_at >= current_date - interval '13 days'
        GROUP BY 1
      ) m ON m.day = d.day
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_list_system_activities(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text := public.admin_v2_current_role();
  v_status text := NULLIF(p_status, 'all');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'not_admin' USING errcode = '42501';
  END IF;
  IF v_status IS NOT NULL AND v_status NOT IN ('draft','published','archived','unpublished','deleted') THEN
    RAISE EXCEPTION 'invalid_activity_status';
  END IF;

  RETURN QUERY
    SELECT jsonb_build_object(
      'id', a.id::text,
      'source_type', a.source_type,
      'source_key', a.source_key,
      'display_no', a.display_no,
      'family_id', a.family_id::text,
      'created_by', COALESCE(a.created_by::text, ''),
      'created_at', a.created_at,
      'updated_at', a.updated_at,
      'current_version_id', a.current_version_id::text,
      'status', a.status,
      'visibility', a.visibility,
      'copied_from', CASE
        WHEN a.copied_from_activity_id IS NULL THEN NULL
        ELSE jsonb_build_object('activity_id', a.copied_from_activity_id::text, 'activity_version_id', a.copied_from_version_id::text)
      END,
      'current_version', public.admin_v2_activity_version_json(v),
      'read_model_source', 'activities_v2'
    )
    FROM public.admin_v2_activities a
    LEFT JOIN public.admin_v2_activity_versions v ON v.id = a.current_version_id
    WHERE a.source_type = 'system'
      AND a.deleted_at IS NULL
      AND (v_status IS NULL OR a.status = v_status)
      AND (
        p_search IS NULL
        OR a.id::text ILIKE '%' || p_search || '%'
        OR a.display_no ILIKE '%' || p_search || '%'
        OR a.source_key ILIKE '%' || p_search || '%'
        OR v.title ILIKE '%' || p_search || '%'
        OR v.category ILIKE '%' || p_search || '%'
        OR v.scene ILIKE '%' || p_search || '%'
      )
    ORDER BY a.updated_at DESC, a.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_get_system_activity(
  p_activity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text := public.admin_v2_current_role();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'not_admin' USING errcode = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.admin_v2_activities a
    WHERE a.id = p_activity_id
      AND a.source_type = 'system'
      AND a.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'system_activity_not_found';
  END IF;

  RETURN public.admin_v2_activity_detail_json(p_activity_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_list_system_assets(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text := public.admin_v2_current_role();
  v_status text := NULLIF(p_status, 'all');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'not_admin' USING errcode = '42501';
  END IF;
  IF v_status IS NOT NULL AND v_status NOT IN ('active','disabled','archived') THEN
    RAISE EXCEPTION 'invalid_asset_status';
  END IF;

  RETURN QUERY
    SELECT jsonb_build_object(
      'kind', 'system_illustration',
      'read_model_source', 'activities_v2',
      'id', a.id::text,
      'source_key', a.source_key,
      'display_no', a.display_no,
      'title', a.title,
      'path', a.path,
      'mime_type', a.mime_type,
      'status', a.status,
      'usage_count', a.usage_count,
      'created_by', COALESCE(a.created_by::text, ''),
      'created_at', a.created_at,
      'updated_at', a.updated_at
    )
    FROM public.admin_v2_system_illustration_assets a
    WHERE (v_status IS NULL OR a.status = v_status)
      AND (
        p_search IS NULL
        OR a.id::text ILIKE '%' || p_search || '%'
        OR a.source_key ILIKE '%' || p_search || '%'
        OR a.display_no ILIKE '%' || p_search || '%'
        OR a.title ILIKE '%' || p_search || '%'
        OR a.path ILIKE '%' || p_search || '%'
      )
    ORDER BY a.updated_at DESC, a.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_list_families(
  governance_reason text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(governance_reason), '');
BEGIN
  IF NOT public.admin_v2_has_permission('family_support') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'view_private',
    'family',
    'list',
    v_reason,
    jsonb_build_object('rpc', 'admin_v2_list_families', 'search', p_search),
    NULL
  );

  RETURN QUERY
    SELECT jsonb_build_object(
      'id', f.id::text,
      'created_by', f.created_by::text,
      'invite_code', f.invite_code,
      'created_at', f.created_at,
      'member_count', COALESCE(fm.member_count, 0),
      'kid_count', COALESCE(k.kid_count, 0),
      'memory_count', COALESCE(m.memory_count, 0)
    )
    FROM public.families f
    LEFT JOIN (
      SELECT family_id, count(*) AS member_count
      FROM public.family_members
      GROUP BY family_id
    ) fm ON fm.family_id = f.id
    LEFT JOIN (
      SELECT family_id, count(*) AS kid_count
      FROM public.kids
      GROUP BY family_id
    ) k ON k.family_id = f.id
    LEFT JOIN (
      SELECT family_id, count(*) AS memory_count
      FROM public.memories
      GROUP BY family_id
    ) m ON m.family_id = f.id
    WHERE p_search IS NULL
      OR f.id::text ILIKE '%' || p_search || '%'
      OR f.created_by::text ILIKE '%' || p_search || '%'
      OR f.invite_code ILIKE '%' || p_search || '%'
    ORDER BY f.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_list_family_activities(
  governance_reason text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(governance_reason), '');
BEGIN
  IF NOT public.admin_v2_has_permission('view_family_activity') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'view_private',
    'activity',
    'list',
    v_reason,
    jsonb_build_object('rpc', 'admin_v2_list_family_activities', 'search', p_search),
    NULL
  );

  RETURN QUERY
    SELECT jsonb_build_object(
      'id', a.id::text,
      'source_type', a.source_type,
      'source_key', a.source_key,
      'display_no', a.display_no,
      'family_id', a.family_id::text,
      'created_by', COALESCE(a.created_by::text, ''),
      'created_at', a.created_at,
      'updated_at', a.updated_at,
      'current_version_id', a.current_version_id::text,
      'status', a.status,
      'visibility', a.visibility,
      'copied_from', CASE
        WHEN a.copied_from_activity_id IS NULL THEN NULL
        ELSE jsonb_build_object('activity_id', a.copied_from_activity_id::text, 'activity_version_id', a.copied_from_version_id::text)
      END,
      'current_version', jsonb_build_object(
        'id', v.id::text,
        'activity_id', v.activity_id::text,
        'version_no', v.version_no,
        'status', v.status,
        'title', v.title,
        'why', v.why,
        'how', v.how,
        'record_hint', v.record_hint,
        'suggest_mode', v.suggest_mode,
        'allowed_capture_modes', v.allowed_capture_modes,
        'illustration', jsonb_build_object(
          'asset_id', COALESCE(v.illustration_asset_id, v.family_private_cover_asset_id)::text,
          'source', v.illustration_source,
          'path', v.illustration_path
        ),
        'family_id', v.family_id::text,
        'perspective', v.perspective,
        'tone', v.tone,
        'category', v.category,
        'scene', v.scene,
        'tags', v.tags,
        'min_age', v.min_age,
        'max_age', v.max_age,
        'seasonal', v.seasonal,
        'seal_recommendation', v.seal_recommendation,
        'published_at', v.published_at,
        'published_by', v.published_by::text,
        'drafted_by', v.drafted_by::text,
        'review_approved_at', v.review_approved_at,
        'review_approved_by', v.review_approved_by::text,
        'copied_from_version_id', v.copied_from_version_id::text,
        'created_at', v.created_at,
        'updated_at', v.updated_at
      ),
      'read_model_source', 'activities_v2'
    )
    FROM public.admin_v2_activities a
    LEFT JOIN public.admin_v2_activity_versions v ON v.id = a.current_version_id
    WHERE a.source_type <> 'system'
      AND a.deleted_at IS NULL
      AND (
        p_search IS NULL
        OR a.id::text ILIKE '%' || p_search || '%'
        OR a.family_id::text ILIKE '%' || p_search || '%'
        OR a.display_no ILIKE '%' || p_search || '%'
        OR a.source_key ILIKE '%' || p_search || '%'
        OR v.title ILIKE '%' || p_search || '%'
      )
    ORDER BY a.updated_at DESC, a.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_get_family_activity(
  p_activity_id uuid,
  governance_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(governance_reason), '');
  v_activity public.admin_v2_activities;
  v_current jsonb;
  v_versions jsonb;
BEGIN
  IF NOT public.admin_v2_has_permission('view_family_activity') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;

  SELECT * INTO v_activity
  FROM public.admin_v2_activities
  WHERE id = p_activity_id AND source_type <> 'system' AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity_not_found';
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'view_private',
    'activity',
    p_activity_id::text,
    v_reason,
    jsonb_build_object('rpc', 'admin_v2_get_family_activity'),
    v_activity.family_id
  );

  SELECT jsonb_build_object(
    'id', v.id::text,
    'activity_id', v.activity_id::text,
    'version_no', v.version_no,
    'status', v.status,
    'title', v.title,
    'why', v.why,
    'how', v.how,
    'record_hint', v.record_hint,
    'suggest_mode', v.suggest_mode,
    'allowed_capture_modes', v.allowed_capture_modes,
    'illustration', jsonb_build_object(
      'asset_id', COALESCE(v.illustration_asset_id, v.family_private_cover_asset_id)::text,
      'source', v.illustration_source,
      'path', v.illustration_path
    ),
    'family_id', v.family_id::text,
    'perspective', v.perspective,
    'tone', v.tone,
    'category', v.category,
    'scene', v.scene,
    'tags', v.tags,
    'min_age', v.min_age,
    'max_age', v.max_age,
    'seasonal', v.seasonal,
    'seal_recommendation', v.seal_recommendation,
    'published_at', v.published_at,
    'published_by', v.published_by::text,
    'drafted_by', v.drafted_by::text,
    'review_approved_at', v.review_approved_at,
    'review_approved_by', v.review_approved_by::text,
    'copied_from_version_id', v.copied_from_version_id::text,
    'created_at', v.created_at,
    'updated_at', v.updated_at
  )
  INTO v_current
  FROM public.admin_v2_activity_versions v
  WHERE v.id = v_activity.current_version_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', v.id::text,
      'activity_id', v.activity_id::text,
      'version_no', v.version_no,
      'status', v.status,
      'title', v.title,
      'why', v.why,
      'how', v.how,
      'record_hint', v.record_hint,
      'suggest_mode', v.suggest_mode,
      'allowed_capture_modes', v.allowed_capture_modes,
      'illustration', jsonb_build_object(
        'asset_id', COALESCE(v.illustration_asset_id, v.family_private_cover_asset_id)::text,
        'source', v.illustration_source,
        'path', v.illustration_path
      ),
      'family_id', v.family_id::text,
      'perspective', v.perspective,
      'tone', v.tone,
      'category', v.category,
      'scene', v.scene,
      'tags', v.tags,
      'min_age', v.min_age,
      'max_age', v.max_age,
      'seasonal', v.seasonal,
      'seal_recommendation', v.seal_recommendation,
      'published_at', v.published_at,
      'published_by', v.published_by::text,
      'drafted_by', v.drafted_by::text,
      'review_approved_at', v.review_approved_at,
      'review_approved_by', v.review_approved_by::text,
      'copied_from_version_id', v.copied_from_version_id::text,
      'created_at', v.created_at,
      'updated_at', v.updated_at
    )
    ORDER BY v.version_no DESC
  ), '[]'::jsonb)
  INTO v_versions
  FROM public.admin_v2_activity_versions v
  WHERE v.activity_id = p_activity_id;

  RETURN jsonb_build_object(
    'id', v_activity.id::text,
    'source_type', v_activity.source_type,
    'source_key', v_activity.source_key,
    'display_no', v_activity.display_no,
    'family_id', v_activity.family_id::text,
    'created_by', COALESCE(v_activity.created_by::text, ''),
    'created_at', v_activity.created_at,
    'updated_at', v_activity.updated_at,
    'current_version_id', v_activity.current_version_id::text,
    'status', v_activity.status,
    'visibility', v_activity.visibility,
    'copied_from', CASE
      WHEN v_activity.copied_from_activity_id IS NULL THEN NULL
      ELSE jsonb_build_object('activity_id', v_activity.copied_from_activity_id::text, 'activity_version_id', v_activity.copied_from_version_id::text)
    END,
    'current_version', v_current,
    'versions', v_versions,
    'audit_metadata', jsonb_build_object('read_model_source', 'activities_v2', 'compatibility_note', NULL)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_list_family_records(
  governance_reason text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_moderation_status text DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(governance_reason), '');
  v_status text := CASE p_moderation_status
    WHEN 'flagged' THEN 'rejected'
    WHEN 'removed' THEN 'hidden'
    ELSE p_moderation_status
  END;
BEGIN
  IF NOT public.admin_v2_has_permission('view_private_record') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'view_private',
    'record',
    'list',
    v_reason,
    jsonb_build_object('rpc', 'admin_v2_list_family_records', 'search', p_search, 'moderation_status', p_moderation_status),
    NULL
  );

  RETURN QUERY
    SELECT jsonb_build_object(
      'id', r.id::text,
      'family_id', r.family_id::text,
      'kid_id', r.kid_id,
      'activity_id', r.activity_id::text,
      'activity_version_id', r.activity_version_id::text,
      'recorded_by', COALESCE(r.recorded_by::text, ''),
      'primary_capture_mode', r.primary_capture_mode,
      'capture_modes', r.capture_modes,
      'title', r.title,
      'caption', r.caption,
      'transcript', r.transcript,
      'duration', COALESCE(to_jsonb(r.duration_seconds), to_jsonb(r.legacy_duration)),
      'shots', r.shots,
      'place', r.place,
      'recorded_at', r.recorded_at,
      'sealed', r.sealed,
      'seal_until', r.seal_until,
      'seal_label', r.seal_label,
      'moderation_status', CASE r.moderation_status WHEN 'rejected' THEN 'flagged' WHEN 'hidden' THEN 'removed' ELSE r.moderation_status END,
      'moderation_note', r.moderation_note,
      'snapshot', r.snapshot,
      'created_at', r.created_at,
      'updated_at', r.updated_at,
      'media_count', COALESCE(media.media_count, 0),
      'media_kinds', COALESCE(media.media_kinds, ARRAY[]::text[]),
      'read_model_source', 'governed_rpc'
    )
    FROM public.admin_v2_activity_records r
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS media_count, COALESCE(array_agg(DISTINCT rm.kind ORDER BY rm.kind), ARRAY[]::text[]) AS media_kinds
      FROM public.admin_v2_activity_record_media rm
      WHERE rm.record_id = r.id
    ) media ON true
    WHERE r.deleted_at IS NULL
      AND (v_status IS NULL OR r.moderation_status = v_status)
      AND (
        p_search IS NULL
        OR r.id::text ILIKE '%' || p_search || '%'
        OR r.family_id::text ILIKE '%' || p_search || '%'
        OR r.kid_id ILIKE '%' || p_search || '%'
        OR r.title ILIKE '%' || p_search || '%'
        OR r.caption ILIKE '%' || p_search || '%'
        OR r.transcript ILIKE '%' || p_search || '%'
        OR r.snapshot->>'activity_title' ILIKE '%' || p_search || '%'
      )
    ORDER BY r.recorded_at DESC, r.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_get_family_record(
  p_record_id uuid,
  governance_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(governance_reason), '');
  v_record public.admin_v2_activity_records;
  v_audit jsonb;
  v_media jsonb;
  v_media_count integer;
  v_media_kinds text[];
BEGIN
  IF NOT public.admin_v2_has_permission('view_private_record') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;

  SELECT * INTO v_record
  FROM public.admin_v2_activity_records
  WHERE id = p_record_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_not_found';
  END IF;

  v_audit := public.admin_v2_write_audit_event(
    'view_private',
    'record',
    p_record_id::text,
    v_reason,
    jsonb_build_object('rpc', 'admin_v2_get_family_record'),
    v_record.family_id
  );

  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', rm.id::text,
        'record_id', rm.record_id::text,
        'kind', rm.kind,
        'storage_path', rm.storage_path,
        'mime_type', rm.mime_type,
        'duration', rm.duration_seconds,
        'width', rm.width,
        'height', rm.height,
        'order_index', rm.order_index,
        'is_primary', rm.is_primary,
        'caption', rm.caption,
        'created_at', rm.created_at
      )
      ORDER BY rm.order_index, rm.created_at
    ), '[]'::jsonb),
    count(rm.id)::integer,
    COALESCE(array_agg(DISTINCT rm.kind ORDER BY rm.kind) FILTER (WHERE rm.id IS NOT NULL), ARRAY[]::text[])
  INTO v_media, v_media_count, v_media_kinds
  FROM public.admin_v2_activity_record_media rm
  WHERE rm.record_id = p_record_id;

  RETURN jsonb_build_object(
    'id', v_record.id::text,
    'family_id', v_record.family_id::text,
    'kid_id', v_record.kid_id,
    'activity_id', v_record.activity_id::text,
    'activity_version_id', v_record.activity_version_id::text,
    'recorded_by', COALESCE(v_record.recorded_by::text, ''),
    'primary_capture_mode', v_record.primary_capture_mode,
    'capture_modes', v_record.capture_modes,
    'title', v_record.title,
    'caption', v_record.caption,
    'transcript', v_record.transcript,
    'duration', COALESCE(to_jsonb(v_record.duration_seconds), to_jsonb(v_record.legacy_duration)),
    'shots', v_record.shots,
    'place', v_record.place,
    'recorded_at', v_record.recorded_at,
    'sealed', v_record.sealed,
    'seal_until', v_record.seal_until,
    'seal_label', v_record.seal_label,
    'moderation_status', CASE v_record.moderation_status WHEN 'rejected' THEN 'flagged' WHEN 'hidden' THEN 'removed' ELSE v_record.moderation_status END,
    'moderation_note', v_record.moderation_note,
    'snapshot', v_record.snapshot,
    'created_at', v_record.created_at,
    'updated_at', v_record.updated_at,
    'media_count', COALESCE(v_media_count, 0),
    'media_kinds', COALESCE(v_media_kinds, ARRAY[]::text[]),
    'media', v_media,
    'audit_event_id', v_audit->>'id',
    'read_model_source', 'governed_rpc'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_list_family_private_cover_assets(
  governance_reason text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(governance_reason), '');
BEGIN
  IF NOT public.admin_v2_has_permission('view_family_private_asset') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'view_private',
    'asset',
    'list',
    v_reason,
    jsonb_build_object('rpc', 'admin_v2_list_family_private_cover_assets', 'search', p_search, 'asset_kind', 'family_private_cover'),
    NULL
  );

  RETURN QUERY
    SELECT jsonb_build_object(
      'kind', 'family_private_cover',
      'read_model_source', 'governed_rpc',
      'id', a.id::text,
      'family_id', a.family_id::text,
      'source_key', a.source_key,
      'title', a.title,
      'path', a.path,
      'mime_type', a.mime_type,
      'status', a.status,
      'created_by', COALESCE(a.created_by::text, ''),
      'created_at', a.created_at,
      'updated_at', a.updated_at
    )
    FROM public.admin_v2_family_private_cover_assets a
    WHERE p_search IS NULL
      OR a.id::text ILIKE '%' || p_search || '%'
      OR a.family_id::text ILIKE '%' || p_search || '%'
      OR a.source_key ILIKE '%' || p_search || '%'
      OR a.title ILIKE '%' || p_search || '%'
      OR a.path ILIKE '%' || p_search || '%'
    ORDER BY a.updated_at DESC, a.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

DROP FUNCTION IF EXISTS public.admin_v2_update_record_moderation(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_v2_update_record_moderation(
  p_record_id uuid,
  p_status text,
  p_note text DEFAULT NULL,
  governance_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(governance_reason), '');
  v_record public.admin_v2_activity_records;
  v_media_count integer;
  v_media_kinds text[];
  v_status text := CASE p_status
    WHEN 'flagged' THEN 'rejected'
    WHEN 'removed' THEN 'hidden'
    ELSE p_status
  END;
  v_legacy_status text;
BEGIN
  IF NOT public.admin_v2_has_permission('review_content') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_status NOT IN ('pending','approved','rejected','hidden') THEN
    RAISE EXCEPTION 'invalid_moderation_status';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;

  UPDATE public.admin_v2_activity_records
  SET moderation_status = v_status,
      moderation_note = COALESCE(p_note, ''),
      updated_at = now()
  WHERE id = p_record_id
  RETURNING * INTO v_record;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_not_found';
  END IF;

  v_legacy_status := CASE v_status
    WHEN 'rejected' THEN 'flagged'
    WHEN 'hidden' THEN 'removed'
    ELSE v_status
  END;

  IF v_record.legacy_memory_id IS NOT NULL THEN
    UPDATE public.memories
    SET moderation_status = v_legacy_status,
        moderation_note = COALESCE(p_note, '')
    WHERE id = v_record.legacy_memory_id;
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'moderate',
    'record',
    p_record_id::text,
    v_reason,
    jsonb_build_object('status', v_status, 'legacy_status', v_legacy_status, 'note', COALESCE(p_note, '')),
    v_record.family_id
  );

  SELECT count(rm.id)::integer, COALESCE(array_agg(DISTINCT rm.kind ORDER BY rm.kind) FILTER (WHERE rm.id IS NOT NULL), ARRAY[]::text[])
  INTO v_media_count, v_media_kinds
  FROM public.admin_v2_activity_record_media rm
  WHERE rm.record_id = p_record_id;

  RETURN jsonb_build_object(
    'id', v_record.id::text,
    'family_id', v_record.family_id::text,
    'kid_id', v_record.kid_id,
    'activity_id', v_record.activity_id::text,
    'activity_version_id', v_record.activity_version_id::text,
    'recorded_by', COALESCE(v_record.recorded_by::text, ''),
    'primary_capture_mode', v_record.primary_capture_mode,
    'capture_modes', v_record.capture_modes,
    'title', v_record.title,
    'caption', v_record.caption,
    'transcript', v_record.transcript,
    'duration', COALESCE(to_jsonb(v_record.duration_seconds), to_jsonb(v_record.legacy_duration)),
    'shots', v_record.shots,
    'place', v_record.place,
    'recorded_at', v_record.recorded_at,
    'sealed', v_record.sealed,
    'seal_until', v_record.seal_until,
    'seal_label', v_record.seal_label,
    'moderation_status', v_legacy_status,
    'moderation_note', v_record.moderation_note,
    'snapshot', v_record.snapshot,
    'created_at', v_record.created_at,
    'updated_at', v_record.updated_at,
    'media_count', COALESCE(v_media_count, 0),
    'media_kinds', COALESCE(v_media_kinds, ARRAY[]::text[]),
    'read_model_source', 'governed_rpc'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_list_notifications(
  governance_reason text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(governance_reason), '');
  v_status text := NULLIF(p_status, 'all');
BEGIN
  IF NOT public.admin_v2_has_permission('family_support') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;
  IF v_status IS NOT NULL AND v_status NOT IN ('pending','processing','done','dead') THEN
    RAISE EXCEPTION 'invalid_notification_status';
  END IF;

  PERFORM public.admin_v2_write_audit_event(
    'view_private',
    'family',
    'notification_outbox:list',
    v_reason,
    jsonb_build_object('rpc', 'admin_v2_list_notifications', 'search', p_search, 'status', p_status),
    NULL
  );

  RETURN QUERY
    SELECT jsonb_build_object(
      'id', o.id,
      'event', o.event,
      'family_id', o.family_id::text,
      'kid_id', o.kid_id,
      'actor_user_id', o.actor_user_id::text,
      'who', o.who,
      'dedupe_key', o.dedupe_key,
      'status', o.status,
      'attempts', o.attempts,
      'max_attempts', o.max_attempts,
      'next_attempt_at', o.next_attempt_at,
      'sent_count', o.sent_count,
      'last_error', o.last_error,
      'payload', to_jsonb(o)->'payload',
      'created_at', o.created_at,
      'processed_at', o.processed_at,
      'read_model_source', 'governed_rpc'
    )
    FROM public.notification_outbox o
    WHERE (v_status IS NULL OR o.status = v_status)
      AND (
        p_search IS NULL
        OR o.id::text ILIKE '%' || p_search || '%'
        OR o.event ILIKE '%' || p_search || '%'
        OR o.family_id::text ILIKE '%' || p_search || '%'
        OR o.kid_id ILIKE '%' || p_search || '%'
        OR o.actor_user_id::text ILIKE '%' || p_search || '%'
        OR o.who ILIKE '%' || p_search || '%'
        OR o.dedupe_key ILIKE '%' || p_search || '%'
        OR o.last_error ILIKE '%' || p_search || '%'
      )
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_update_notification_preferences(
  p_family_id uuid,
  p_patch jsonb,
  governance_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := NULLIF(btrim(governance_reason), '');
  v_patch jsonb := COALESCE(p_patch, '{}'::jsonb);
  v_row public.notification_preferences;
  v_frequency text;
BEGIN
  IF NOT public.admin_v2_has_permission('family_support') THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 8 THEN
    RAISE EXCEPTION 'governance_reason_required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.families WHERE id = p_family_id) THEN
    RAISE EXCEPTION 'family_not_found';
  END IF;

  v_frequency := v_patch->>'frequency';
  IF v_frequency IS NOT NULL AND v_frequency NOT IN ('gentle','normal','frequent') THEN
    RAISE EXCEPTION 'invalid_notification_frequency';
  END IF;

  INSERT INTO public.notification_preferences (
    family_id,
    enabled,
    frequency,
    notify_family,
    quiet_start,
    quiet_end,
    updated_at
  )
  VALUES (
    p_family_id,
    COALESCE((v_patch->>'enabled')::boolean, true),
    COALESCE(v_frequency, 'normal'),
    COALESCE((v_patch->>'notify_family')::boolean, true),
    COALESCE((v_patch->>'quiet_start')::time, '22:00'::time),
    COALESCE((v_patch->>'quiet_end')::time, '08:00'::time),
    now()
  )
  ON CONFLICT (family_id) DO UPDATE
    SET enabled = CASE WHEN v_patch ? 'enabled' THEN (v_patch->>'enabled')::boolean ELSE public.notification_preferences.enabled END,
        frequency = CASE WHEN v_patch ? 'frequency' THEN v_frequency ELSE public.notification_preferences.frequency END,
        notify_family = CASE WHEN v_patch ? 'notify_family' THEN (v_patch->>'notify_family')::boolean ELSE public.notification_preferences.notify_family END,
        quiet_start = CASE WHEN v_patch ? 'quiet_start' THEN (v_patch->>'quiet_start')::time ELSE public.notification_preferences.quiet_start END,
        quiet_end = CASE WHEN v_patch ? 'quiet_end' THEN (v_patch->>'quiet_end')::time ELSE public.notification_preferences.quiet_end END,
        updated_at = now()
  RETURNING * INTO v_row;

  PERFORM public.admin_v2_write_audit_event(
    'update',
    'family',
    p_family_id::text,
    v_reason,
    jsonb_build_object('rpc', 'admin_v2_update_notification_preferences', 'patch', v_patch),
    p_family_id
  );

  RETURN to_jsonb(v_row);
END;
$$;

DO $$
DECLARE
  v_function text;
  v_allowed_function text;
  v_authenticated_allowlist text[] := ARRAY[
    'public.admin_v2_has_permission(text)',
    'public.admin_v2_dashboard_summary()',
    'public.admin_v2_list_system_activities(integer, integer, text, text)',
    'public.admin_v2_get_system_activity(uuid)',
    'public.admin_v2_list_system_assets(integer, integer, text, text)',
    'public.admin_v2_list_families(text, integer, integer, text)',
    'public.admin_v2_list_family_activities(text, integer, integer, text)',
    'public.admin_v2_get_family_activity(uuid, text)',
    'public.admin_v2_list_family_records(text, integer, integer, text, text)',
    'public.admin_v2_get_family_record(uuid, text)',
    'public.admin_v2_list_family_private_cover_assets(text, integer, integer, text)',
    'public.admin_v2_list_notifications(text, integer, integer, text, text)',
    'public.admin_v2_list_moderation_cases(jsonb)',
    'public.admin_v2_create_activity_draft(jsonb)',
    'public.admin_v2_update_activity_draft(jsonb)',
    'public.admin_v2_copy_system_activity_to_family(jsonb)',
    'public.admin_v2_create_activity_version(jsonb)',
    'public.admin_v2_approve_activity_version(jsonb)',
    'public.admin_v2_publish_activity_version(jsonb)',
    'public.admin_v2_unpublish_activity_version(jsonb)',
    'public.admin_v2_archive_activity_version(jsonb)',
    'public.admin_v2_create_moderation_case(jsonb)',
    'public.admin_v2_resolve_moderation_case(jsonb)',
    'public.admin_v2_access_private_record(uuid, text, uuid)',
    'public.admin_v2_access_private_record_media(uuid, text, uuid)',
    'public.admin_v2_access_family_private_cover(uuid, text, uuid)',
    'public.admin_v2_access_family_activity(uuid, text, uuid)',
    'public.admin_v2_update_record_moderation(uuid, text, text, text)',
    'public.admin_v2_update_notification_preferences(uuid, jsonb, text)'
  ];
BEGIN
  FOR v_function IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'admin_v2\_%' ESCAPE '\'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_function);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_function);
  END LOOP;

  FOREACH v_allowed_function IN ARRAY v_authenticated_allowlist
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_allowed_function);
  END LOOP;
END $$;

-- Backfill system illustration assets and activities from legacy levels.
INSERT INTO public.admin_v2_system_illustration_assets (id, source_key, display_no, title, path, status, created_at, updated_at)
SELECT DISTINCT ON (l.illustration_path)
  public.admin_v2_stable_uuid('system_illustration_asset', l.illustration_path),
  'illustrations:' || l.illustration_path,
  l.num,
  l.title,
  l.illustration_path,
  CASE WHEN COALESCE(l.active, true) THEN 'active' ELSE 'disabled' END,
  now(),
  now()
FROM public.levels l
WHERE l.illustration_path IS NOT NULL AND btrim(l.illustration_path) <> ''
ORDER BY l.illustration_path, l.sort_order, l.num
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_v2_activities (
  id, source_type, source_key, display_no, family_id, created_by, current_version_id,
  status, visibility, legacy_level_num, created_at, updated_at
)
SELECT
  public.admin_v2_stable_uuid('activity:system', l.num),
  'system',
  'system:level:' || l.num,
  l.num,
  NULL,
  NULL,
  public.admin_v2_stable_uuid('activity_version:system', l.num || ':1'),
  CASE WHEN COALESCE(l.active, true) THEN 'published' ELSE 'unpublished' END,
  'system',
  l.num,
  now(),
  now()
FROM public.levels l
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_v2_activity_versions (
  id, activity_id, version_no, status, title, why, how, record_hint, suggest_mode, allowed_capture_modes,
  illustration_asset_id, illustration_source, illustration_path, family_id, perspective, tone, category, scene,
  tags, min_age, max_age, seasonal, seal_recommendation, published_at, legacy_level_num, created_at, updated_at
)
SELECT
  public.admin_v2_stable_uuid('activity_version:system', l.num || ':1'),
  public.admin_v2_stable_uuid('activity:system', l.num),
  1,
  CASE WHEN COALESCE(l.active, true) THEN 'published' ELSE 'unpublished' END,
  l.title,
  COALESCE(l.why, ''),
  COALESCE(l.how, ''),
  COALESCE(l.record, ''),
  l.suggest,
  ARRAY['text','photo','video','voice']::text[],
  CASE
    WHEN l.illustration_path IS NOT NULL AND btrim(l.illustration_path) <> ''
      THEN public.admin_v2_stable_uuid('system_illustration_asset', l.illustration_path)
    ELSE NULL
  END,
  CASE
    WHEN l.illustration_path IS NOT NULL AND btrim(l.illustration_path) <> '' THEN 'system_asset'
    ELSE 'motif_fallback'
  END,
  l.illustration_path,
  NULL,
  l.perspective,
  l.tone,
  l.category,
  l.scene,
  l.tags,
  l.min_age,
  l.max_age,
  l.seasonal,
  jsonb_build_object(
    'default_state', CASE WHEN l.sealed THEN 'recommend_sealed' ELSE 'recommend_unsealed' END,
    'kind', CASE WHEN l.sealed THEN CASE WHEN l.seal_kind = 'age18' THEN 'age_based' ELSE 'until_date' END ELSE 'none' END,
    'default_until', l.seal_until,
    'label', l.sealed_on,
    'reason', NULL
  ),
  CASE WHEN COALESCE(l.active, true) THEN now() ELSE NULL END,
  l.num,
  now(),
  now()
FROM public.levels l
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_v2_family_private_cover_assets (id, family_id, source_key, title, path, status, created_by, created_at, updated_at)
SELECT DISTINCT ON (c.family_id, c.illustration_path)
  public.admin_v2_stable_uuid('family_private_cover_asset', c.family_id::text || ':' || c.illustration_path),
  c.family_id,
  'illustrations:' || c.illustration_path,
  c.title,
  c.illustration_path,
  'active',
  c.user_id,
  c.created_at,
  now()
FROM public.custom_levels c
WHERE c.illustration_path IS NOT NULL AND btrim(c.illustration_path) <> ''
ORDER BY c.family_id, c.illustration_path, c.created_at, c.id
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_v2_activities (
  id, source_type, source_key, display_no, family_id, created_by, current_version_id,
  status, visibility, legacy_custom_level_id, created_at, updated_at
)
SELECT
  public.admin_v2_stable_uuid('activity:custom', c.family_id::text || ':' || c.id::text),
  'family',
  'family:custom_level:' || c.id::text,
  c.num,
  c.family_id,
  c.user_id,
  public.admin_v2_stable_uuid('activity_version:custom', c.family_id::text || ':' || c.id::text || ':1'),
  'published',
  'family_private',
  c.id,
  c.created_at,
  now()
FROM public.custom_levels c
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_v2_activity_versions (
  id, activity_id, version_no, status, title, why, how, record_hint, suggest_mode, allowed_capture_modes,
  family_private_cover_asset_id, illustration_source, illustration_path, family_id, perspective, tone,
  copied_from_version_id, legacy_custom_level_id, created_at, updated_at
)
SELECT
  public.admin_v2_stable_uuid('activity_version:custom', c.family_id::text || ':' || c.id::text || ':1'),
  public.admin_v2_stable_uuid('activity:custom', c.family_id::text || ':' || c.id::text),
  1,
  'published',
  c.title,
  COALESCE(c.why, ''),
  COALESCE(c.how, ''),
  COALESCE(c.record_hint, ''),
  CASE WHEN c.suggest IN ('text','photo','video','voice') THEN c.suggest ELSE 'photo' END,
  ARRAY['text','photo','video','voice']::text[],
  CASE
    WHEN c.illustration_path IS NOT NULL AND btrim(c.illustration_path) <> ''
      THEN public.admin_v2_stable_uuid('family_private_cover_asset', c.family_id::text || ':' || c.illustration_path)
    ELSE NULL
  END,
  CASE
    WHEN c.illustration_path IS NOT NULL AND btrim(c.illustration_path) <> '' THEN 'family_private'
    ELSE 'none'
  END,
  c.illustration_path,
  c.family_id,
  c.perspective,
  c.tone,
  NULL,
  c.id,
  c.created_at,
  now()
FROM public.custom_levels c
ON CONFLICT (id) DO NOTHING;

-- Legacy records can point at deleted/missing custom levels. Keep them readable via archived fallback activities.
WITH missing AS (
  SELECT
    m.family_id,
    m.level_num,
    min(m.user_id::text)::uuid AS created_by,
    min(m.created_at) AS created_at,
    min(m.title) AS title,
    min(m.perspective) AS perspective,
    min(m.tone) AS tone,
    min(m.type) AS suggest
  FROM public.memories m
  WHERE NOT EXISTS (SELECT 1 FROM public.admin_v2_activities a WHERE a.source_type = 'system' AND a.legacy_level_num = m.level_num)
    AND NOT EXISTS (
      SELECT 1
      FROM public.admin_v2_activities a
      WHERE a.source_type <> 'system' AND a.family_id = m.family_id AND a.display_no = m.level_num
    )
  GROUP BY m.family_id, m.level_num
)
INSERT INTO public.admin_v2_activities (
  id, source_type, source_key, display_no, family_id, created_by, current_version_id,
  status, visibility, created_at, updated_at
)
SELECT
  public.admin_v2_stable_uuid('activity:legacy_missing', family_id::text || ':' || level_num),
  'family',
  'legacy_missing_level:' || level_num,
  level_num,
  family_id,
  created_by,
  public.admin_v2_stable_uuid('activity_version:legacy_missing', family_id::text || ':' || level_num || ':1'),
  'archived',
  'family_private',
  created_at,
  now()
FROM missing
ON CONFLICT (id) DO NOTHING;

WITH missing AS (
  SELECT
    m.family_id,
    m.level_num,
    min(m.created_at) AS created_at,
    min(m.title) AS title,
    min(m.perspective) AS perspective,
    min(m.tone) AS tone,
    min(m.type) AS suggest
  FROM public.memories m
  WHERE NOT EXISTS (SELECT 1 FROM public.admin_v2_activities a WHERE a.source_type = 'system' AND a.legacy_level_num = m.level_num)
    AND NOT EXISTS (
      SELECT 1
      FROM public.admin_v2_activities a
      WHERE a.source_type <> 'system' AND a.family_id = m.family_id AND a.display_no = m.level_num
    )
  GROUP BY m.family_id, m.level_num
)
INSERT INTO public.admin_v2_activity_versions (
  id, activity_id, version_no, status, title, why, how, record_hint, suggest_mode, allowed_capture_modes,
  illustration_source, family_id, perspective, tone, created_at, updated_at
)
SELECT
  public.admin_v2_stable_uuid('activity_version:legacy_missing', family_id::text || ':' || level_num || ':1'),
  public.admin_v2_stable_uuid('activity:legacy_missing', family_id::text || ':' || level_num),
  1,
  'archived',
  COALESCE(title, level_num),
  '',
  '',
  '',
  CASE WHEN suggest IN ('text','photo','video','voice') THEN suggest ELSE 'photo' END,
  ARRAY['text','photo','video','voice']::text[],
  'none',
  family_id,
  CASE WHEN perspective IN ('parent','child','together') THEN perspective ELSE 'together' END,
  COALESCE(tone, 'orange'),
  created_at,
  now()
FROM missing
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_v2_resolve_activity_id(p_family_id uuid, p_level_num text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id
  FROM (
    SELECT a.id, 1 AS rank
    FROM public.admin_v2_activities a
    WHERE a.source_type = 'system' AND a.legacy_level_num = p_level_num
    UNION ALL
    SELECT a.id, 2 AS rank
    FROM public.admin_v2_activities a
    WHERE a.source_type <> 'system'
      AND a.family_id = p_family_id
      AND a.display_no = p_level_num
      AND a.deleted_at IS NULL
    UNION ALL
    SELECT a.id, 3 AS rank
    FROM public.admin_v2_activities a
    WHERE a.source_type <> 'system'
      AND a.family_id = p_family_id
      AND a.source_key = 'legacy_missing_level:' || p_level_num
  ) candidates
  ORDER BY rank
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_upsert_legacy_missing_activity(
  p_family_id uuid,
  p_level_num text,
  p_title text,
  p_perspective text,
  p_tone text,
  p_suggest text,
  p_created_by uuid,
  p_created_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_activity_id uuid := public.admin_v2_stable_uuid('activity:legacy_missing', p_family_id::text || ':' || p_level_num);
  v_version_id uuid := public.admin_v2_stable_uuid('activity_version:legacy_missing', p_family_id::text || ':' || p_level_num || ':1');
BEGIN
  INSERT INTO public.admin_v2_activities (
    id, source_type, source_key, display_no, family_id, created_by, current_version_id,
    status, visibility, created_at, updated_at
  )
  VALUES (
    v_activity_id, 'family', 'legacy_missing_level:' || p_level_num, p_level_num, p_family_id,
    p_created_by, v_version_id, 'archived', 'family_private', COALESCE(p_created_at, now()), now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.admin_v2_activity_versions (
    id, activity_id, version_no, status, title, why, how, record_hint, suggest_mode, allowed_capture_modes,
    illustration_source, family_id, perspective, tone, created_at, updated_at
  )
  VALUES (
    v_version_id, v_activity_id, 1, 'archived', COALESCE(NULLIF(p_title, ''), p_level_num), '', '', '',
    CASE WHEN p_suggest IN ('text','photo','video','voice') THEN p_suggest ELSE 'photo' END,
    ARRAY['text','photo','video','voice']::text[], 'none', p_family_id,
    CASE WHEN p_perspective IN ('parent','child','together') THEN p_perspective ELSE 'together' END,
    COALESCE(p_tone, 'orange'), COALESCE(p_created_at, now()), now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN v_activity_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_record_media_kind(p_path text, p_mime text DEFAULT NULL)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN COALESCE(p_mime, '') LIKE 'image/%' THEN 'image'
    WHEN COALESCE(p_mime, '') LIKE 'video/%' THEN 'video'
    WHEN COALESCE(p_mime, '') LIKE 'audio/%' THEN 'audio'
    WHEN lower(p_path) ~ '\.(mp4|mov|m4v|3gp|webm)$' THEN 'video'
    WHEN lower(p_path) ~ '\.(m4a|caf|wav|mp3|aac|ogg)$' THEN 'audio'
    WHEN lower(p_path) ~ '\.(jpg|jpeg|png|heic|heif|webp|gif)$' THEN 'image'
    WHEN lower(p_path) ~ '\.(txt|md)$' THEN 'text'
    ELSE 'other'
  END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_sync_record_media_for_memory(p_memory_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_record_id uuid;
BEGIN
  SELECT id INTO v_record_id
  FROM public.admin_v2_activity_records
  WHERE legacy_memory_id = p_memory_id;

  IF v_record_id IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.admin_v2_activity_record_media (
    id, record_id, kind, storage_bucket, storage_path, mime_type, width, height, order_index, is_primary, metadata, created_at
  )
  SELECT
    public.admin_v2_stable_uuid('record_media', o.bucket_id || ':' || o.name),
    v_record_id,
    public.admin_v2_record_media_kind(o.name, o.metadata->>'mimetype'),
    o.bucket_id,
    o.name,
    o.metadata->>'mimetype',
    CASE WHEN o.metadata->>'width' ~ '^\d+$' THEN (o.metadata->>'width')::integer ELSE NULL END,
    CASE WHEN o.metadata->>'height' ~ '^\d+$' THEN (o.metadata->>'height')::integer ELSE NULL END,
    row_number() OVER (ORDER BY o.name)::integer - 1,
    row_number() OVER (ORDER BY o.name) = 1,
    COALESCE(o.metadata, '{}'::jsonb),
    COALESCE(o.created_at, now())
  FROM storage.objects o
  WHERE o.bucket_id = 'memories'
    AND split_part(o.name, '/', 2) = p_memory_id
  ON CONFLICT (storage_bucket, storage_path) DO UPDATE
    SET record_id = EXCLUDED.record_id,
        kind = EXCLUDED.kind,
        mime_type = EXCLUDED.mime_type,
        width = EXCLUDED.width,
        height = EXCLUDED.height,
        order_index = EXCLUDED.order_index,
        is_primary = EXCLUDED.is_primary,
        metadata = EXCLUDED.metadata;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_sync_memory_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_activity_id uuid;
  v_version_id uuid;
  v_version public.admin_v2_activity_versions;
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.admin_v2_activity_records WHERE legacy_memory_id = OLD.id;
    RETURN OLD;
  END IF;

  v_activity_id := public.admin_v2_resolve_activity_id(NEW.family_id, NEW.level_num);
  IF v_activity_id IS NULL THEN
    v_activity_id := public.admin_v2_upsert_legacy_missing_activity(
      NEW.family_id, NEW.level_num, NEW.title, NEW.perspective, NEW.tone, NEW.type, NEW.user_id, NEW.created_at
    );
  END IF;

  SELECT current_version_id INTO v_version_id
  FROM public.admin_v2_activities
  WHERE id = v_activity_id;

  SELECT * INTO v_version
  FROM public.admin_v2_activity_versions
  WHERE id = v_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity_version_not_found';
  END IF;

  v_status := CASE NEW.moderation_status
    WHEN 'flagged' THEN 'rejected'
    WHEN 'removed' THEN 'hidden'
    WHEN 'pending' THEN 'pending'
    ELSE 'approved'
  END;

  INSERT INTO public.admin_v2_activity_records (
    id, family_id, kid_id, activity_id, activity_version_id, recorded_by, primary_capture_mode, capture_modes,
    title, caption, transcript, duration_seconds, legacy_duration, shots, place, recorded_at, legacy_recorded_date,
    sealed, seal_until, seal_label, moderation_status, moderation_note, snapshot, legacy_memory_id, invite_token_id,
    invited_role, created_at, updated_at
  )
  VALUES (
    public.admin_v2_stable_uuid('activity_record:memory', NEW.id),
    NEW.family_id,
    NEW.kid_id,
    v_activity_id,
    v_version_id,
    NEW.user_id,
    NEW.type,
    ARRAY[NEW.type]::text[],
    NEW.title,
    NEW.caption,
    NEW.transcript,
    CASE WHEN NEW.duration ~ '^\d+$' THEN NEW.duration::integer ELSE NULL END,
    NEW.duration,
    NEW.shots,
    NEW.place,
    public.admin_v2_try_timestamptz(NEW.date, NEW.created_at),
    NEW.date,
    CASE WHEN NEW.sealed THEN 'sealed' ELSE 'unsealed' END,
    public.admin_v2_try_timestamptz(NEW.seal_until::text, NULL::timestamptz),
    NEW.seal_label,
    v_status,
    NEW.moderation_note,
    jsonb_build_object(
      'activity_title', v_version.title,
      'activity_why', v_version.why,
      'activity_how', v_version.how,
      'record_hint', v_version.record_hint,
      'suggest_mode', v_version.suggest_mode,
      'allowed_capture_modes', v_version.allowed_capture_modes,
      'illustration_source', v_version.illustration_source,
      'legacy_level_num', NEW.level_num
    ),
    NEW.id,
    NEW.invite_token_id,
    NEW.invited_role,
    NEW.created_at,
    now()
  )
  ON CONFLICT (legacy_memory_id) DO UPDATE
    SET family_id = EXCLUDED.family_id,
        kid_id = EXCLUDED.kid_id,
        recorded_by = EXCLUDED.recorded_by,
        title = EXCLUDED.title,
        caption = EXCLUDED.caption,
        transcript = EXCLUDED.transcript,
        duration_seconds = EXCLUDED.duration_seconds,
        legacy_duration = EXCLUDED.legacy_duration,
        shots = EXCLUDED.shots,
        place = EXCLUDED.place,
        recorded_at = EXCLUDED.recorded_at,
        legacy_recorded_date = EXCLUDED.legacy_recorded_date,
        sealed = EXCLUDED.sealed,
        seal_until = EXCLUDED.seal_until,
        seal_label = EXCLUDED.seal_label,
        moderation_status = EXCLUDED.moderation_status,
        moderation_note = EXCLUDED.moderation_note,
        invite_token_id = EXCLUDED.invite_token_id,
        invited_role = EXCLUDED.invited_role,
        updated_at = now();

  PERFORM public.admin_v2_sync_record_media_for_memory(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_sync_custom_level_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_activity_id uuid;
  v_version_no integer;
  v_version_id uuid;
  v_cover_asset_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.admin_v2_activities
    SET status = 'deleted',
        deleted_at = COALESCE(deleted_at, now()),
        updated_at = now()
    WHERE legacy_custom_level_id = OLD.id;
    RETURN OLD;
  END IF;

  v_activity_id := public.admin_v2_stable_uuid('activity:custom', NEW.family_id::text || ':' || NEW.id::text);

  IF NEW.illustration_path IS NOT NULL AND btrim(NEW.illustration_path) <> '' THEN
    v_cover_asset_id := public.admin_v2_stable_uuid('family_private_cover_asset', NEW.family_id::text || ':' || NEW.illustration_path);
    INSERT INTO public.admin_v2_family_private_cover_assets (
      id, family_id, source_key, title, path, status, created_by, created_at, updated_at
    )
    VALUES (
      v_cover_asset_id, NEW.family_id, 'illustrations:' || NEW.illustration_path, NEW.title,
      NEW.illustration_path, 'active', NEW.user_id, NEW.created_at, now()
    )
    ON CONFLICT (id) DO UPDATE
      SET title = EXCLUDED.title,
          status = 'active',
          updated_at = now();
  END IF;

  INSERT INTO public.admin_v2_activities (
    id, source_type, source_key, display_no, family_id, created_by, status, visibility,
    legacy_custom_level_id, created_at, updated_at
  )
  VALUES (
    v_activity_id, 'family', 'family:custom_level:' || NEW.id::text, NEW.num, NEW.family_id, NEW.user_id,
    'published', 'family_private', NEW.id, NEW.created_at, now()
  )
  ON CONFLICT (id) DO UPDATE
    SET display_no = EXCLUDED.display_no,
        status = 'published',
        deleted_at = NULL,
        updated_at = now();

  IF TG_OP = 'UPDATE' AND NOT (
    NEW.num IS DISTINCT FROM OLD.num OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.why IS DISTINCT FROM OLD.why OR
    NEW.how IS DISTINCT FROM OLD.how OR
    NEW.record_hint IS DISTINCT FROM OLD.record_hint OR
    NEW.perspective IS DISTINCT FROM OLD.perspective OR
    NEW.tone IS DISTINCT FROM OLD.tone OR
    NEW.suggest IS DISTINCT FROM OLD.suggest OR
    NEW.illustration_path IS DISTINCT FROM OLD.illustration_path
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(max(version_no), 0) + 1
  INTO v_version_no
  FROM public.admin_v2_activity_versions
  WHERE activity_id = v_activity_id;

  IF TG_OP = 'INSERT' THEN
    v_version_no := 1;
  END IF;

  v_version_id := public.admin_v2_stable_uuid(
    'activity_version:custom',
    NEW.family_id::text || ':' || NEW.id::text || ':' || v_version_no::text
  );

  INSERT INTO public.admin_v2_activity_versions (
    id, activity_id, version_no, status, title, why, how, record_hint, suggest_mode, allowed_capture_modes,
    family_private_cover_asset_id, illustration_source, illustration_path, family_id, perspective, tone,
    legacy_custom_level_id, created_at, updated_at
  )
  VALUES (
    v_version_id, v_activity_id, v_version_no, 'published', NEW.title, COALESCE(NEW.why, ''),
    COALESCE(NEW.how, ''), COALESCE(NEW.record_hint, ''),
    CASE WHEN NEW.suggest IN ('text','photo','video','voice') THEN NEW.suggest ELSE 'photo' END,
    ARRAY['text','photo','video','voice']::text[], v_cover_asset_id,
    CASE WHEN v_cover_asset_id IS NOT NULL THEN 'family_private' ELSE 'none' END,
    NEW.illustration_path, NEW.family_id, NEW.perspective, NEW.tone, NEW.id, NEW.created_at, now()
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.admin_v2_activities
  SET current_version_id = v_version_id,
      updated_at = now()
  WHERE id = v_activity_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_sync_system_level_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_activity_id uuid;
  v_version_no integer;
  v_version_id uuid;
  v_asset_id uuid;
BEGIN
  v_activity_id := public.admin_v2_stable_uuid('activity:system', NEW.num);

  IF NEW.illustration_path IS NOT NULL AND btrim(NEW.illustration_path) <> '' THEN
    v_asset_id := public.admin_v2_stable_uuid('system_illustration_asset', NEW.illustration_path);
    INSERT INTO public.admin_v2_system_illustration_assets (id, source_key, display_no, title, path, status, updated_at)
    VALUES (
      v_asset_id, 'illustrations:' || NEW.illustration_path, NEW.num, NEW.title, NEW.illustration_path,
      CASE WHEN COALESCE(NEW.active, true) THEN 'active' ELSE 'disabled' END, now()
    )
    ON CONFLICT (id) DO UPDATE
      SET title = EXCLUDED.title,
          status = EXCLUDED.status,
          updated_at = now();
  END IF;

  INSERT INTO public.admin_v2_activities (
    id, source_type, source_key, display_no, status, visibility, legacy_level_num, created_at, updated_at
  )
  VALUES (
    v_activity_id, 'system', 'system:level:' || NEW.num, NEW.num,
    CASE WHEN COALESCE(NEW.active, true) THEN 'published' ELSE 'unpublished' END,
    'system', NEW.num, now(), now()
  )
  ON CONFLICT (id) DO UPDATE
    SET display_no = EXCLUDED.display_no,
        status = EXCLUDED.status,
        updated_at = now();

  IF TG_OP = 'UPDATE' AND NOT (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.why IS DISTINCT FROM OLD.why OR
    NEW.how IS DISTINCT FROM OLD.how OR
    NEW.record IS DISTINCT FROM OLD.record OR
    NEW.suggest IS DISTINCT FROM OLD.suggest OR
    NEW.sealed IS DISTINCT FROM OLD.sealed OR
    NEW.seal_until IS DISTINCT FROM OLD.seal_until OR
    NEW.sealed_on IS DISTINCT FROM OLD.sealed_on OR
    NEW.seal_kind IS DISTINCT FROM OLD.seal_kind OR
    NEW.seasonal IS DISTINCT FROM OLD.seasonal OR
    NEW.illustration_path IS DISTINCT FROM OLD.illustration_path OR
    NEW.category IS DISTINCT FROM OLD.category OR
    NEW.scene IS DISTINCT FROM OLD.scene OR
    NEW.min_age IS DISTINCT FROM OLD.min_age OR
    NEW.max_age IS DISTINCT FROM OLD.max_age OR
    NEW.tags IS DISTINCT FROM OLD.tags OR
    NEW.active IS DISTINCT FROM OLD.active
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(max(version_no), 0) + 1
  INTO v_version_no
  FROM public.admin_v2_activity_versions
  WHERE activity_id = v_activity_id;

  IF TG_OP = 'INSERT' THEN
    v_version_no := 1;
  END IF;

  v_version_id := public.admin_v2_stable_uuid('activity_version:system', NEW.num || ':' || v_version_no::text);

  INSERT INTO public.admin_v2_activity_versions (
    id, activity_id, version_no, status, title, why, how, record_hint, suggest_mode, allowed_capture_modes,
    illustration_asset_id, illustration_source, illustration_path, family_id, perspective, tone, category, scene,
    tags, min_age, max_age, seasonal, seal_recommendation, published_at, legacy_level_num, created_at, updated_at
  )
  VALUES (
    v_version_id, v_activity_id, v_version_no,
    CASE WHEN COALESCE(NEW.active, true) THEN 'published' ELSE 'unpublished' END,
    NEW.title, COALESCE(NEW.why, ''), COALESCE(NEW.how, ''), COALESCE(NEW.record, ''),
    CASE WHEN NEW.suggest IN ('text','photo','video','voice') THEN NEW.suggest ELSE 'photo' END,
    ARRAY['text','photo','video','voice']::text[], v_asset_id,
    CASE WHEN v_asset_id IS NOT NULL THEN 'system_asset' ELSE 'motif_fallback' END,
    NEW.illustration_path, NULL, NEW.perspective, NEW.tone, NEW.category, NEW.scene, NEW.tags,
    NEW.min_age, NEW.max_age, NEW.seasonal,
    jsonb_build_object(
      'default_state', CASE WHEN NEW.sealed THEN 'recommend_sealed' ELSE 'recommend_unsealed' END,
      'kind', CASE WHEN NEW.sealed THEN CASE WHEN NEW.seal_kind = 'age18' THEN 'age_based' ELSE 'until_date' END ELSE 'none' END,
      'default_until', NEW.seal_until,
      'label', NEW.sealed_on,
      'reason', NULL
    ),
    CASE WHEN COALESCE(NEW.active, true) THEN now() ELSE NULL END,
    NEW.num,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.admin_v2_activities
  SET current_version_id = v_version_id,
      updated_at = now()
  WHERE id = v_activity_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_sync_storage_memory_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_memory_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.bucket_id = 'memories' THEN
      DELETE FROM public.admin_v2_activity_record_media
      WHERE storage_bucket = OLD.bucket_id AND storage_path = OLD.name;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.bucket_id <> 'memories' THEN
    RETURN NEW;
  END IF;

  v_memory_id := split_part(NEW.name, '/', 2);
  IF v_memory_id IS NULL OR v_memory_id = '' THEN
    RETURN NEW;
  END IF;

  PERFORM public.admin_v2_sync_record_media_for_memory(v_memory_id);
  RETURN NEW;
END;
$$;

-- Backfill records after helper functions are in place.
INSERT INTO public.admin_v2_activity_records (
  id, family_id, kid_id, activity_id, activity_version_id, recorded_by, primary_capture_mode, capture_modes,
  title, caption, transcript, duration_seconds, legacy_duration, shots, place, recorded_at, legacy_recorded_date,
  sealed, seal_until, seal_label, moderation_status, moderation_note, snapshot, legacy_memory_id, invite_token_id,
  invited_role, created_at, updated_at
)
SELECT
  public.admin_v2_stable_uuid('activity_record:memory', m.id),
  m.family_id,
  m.kid_id,
  a.id,
  v.id,
  m.user_id,
  m.type,
  ARRAY[m.type]::text[],
  m.title,
  m.caption,
  m.transcript,
  CASE WHEN m.duration ~ '^\d+$' THEN m.duration::integer ELSE NULL END,
  m.duration,
  m.shots,
  m.place,
  public.admin_v2_try_timestamptz(m.date, m.created_at),
  m.date,
  CASE WHEN m.sealed THEN 'sealed' ELSE 'unsealed' END,
  public.admin_v2_try_timestamptz(m.seal_until::text, NULL::timestamptz),
  m.seal_label,
  CASE m.moderation_status
    WHEN 'flagged' THEN 'rejected'
    WHEN 'removed' THEN 'hidden'
    WHEN 'pending' THEN 'pending'
    ELSE 'approved'
  END,
  m.moderation_note,
  jsonb_build_object(
    'activity_title', v.title,
    'activity_why', v.why,
    'activity_how', v.how,
    'record_hint', v.record_hint,
    'suggest_mode', v.suggest_mode,
    'allowed_capture_modes', v.allowed_capture_modes,
    'illustration_source', v.illustration_source,
    'legacy_level_num', m.level_num
  ),
  m.id,
  m.invite_token_id,
  m.invited_role,
  m.created_at,
  now()
FROM public.memories m
JOIN LATERAL (
  SELECT public.admin_v2_resolve_activity_id(m.family_id, m.level_num) AS id
) a ON a.id IS NOT NULL
JOIN public.admin_v2_activities act ON act.id = a.id
JOIN public.admin_v2_activity_versions v ON v.id = act.current_version_id
ON CONFLICT (legacy_memory_id) DO NOTHING;

SELECT public.admin_v2_sync_record_media_for_memory(m.id)
FROM public.memories m;

DROP TRIGGER IF EXISTS trg_admin_v2_sync_memory_record ON public.memories;
CREATE TRIGGER trg_admin_v2_sync_memory_record
  AFTER INSERT OR UPDATE OR DELETE ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.admin_v2_sync_memory_record();

DROP TRIGGER IF EXISTS trg_admin_v2_sync_custom_level_activity ON public.custom_levels;
CREATE TRIGGER trg_admin_v2_sync_custom_level_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.custom_levels
  FOR EACH ROW EXECUTE FUNCTION public.admin_v2_sync_custom_level_activity();

DROP TRIGGER IF EXISTS trg_admin_v2_sync_system_level_activity ON public.levels;
CREATE TRIGGER trg_admin_v2_sync_system_level_activity
  AFTER INSERT OR UPDATE ON public.levels
  FOR EACH ROW EXECUTE FUNCTION public.admin_v2_sync_system_level_activity();

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_admin_v2_sync_storage_memory_media ON storage.objects';
    EXECUTE 'CREATE TRIGGER trg_admin_v2_sync_storage_memory_media
      AFTER INSERT OR UPDATE OR DELETE ON storage.objects
      FOR EACH ROW EXECUTE FUNCTION public.admin_v2_sync_storage_memory_media()';
  END IF;
END $$;

COMMIT;
