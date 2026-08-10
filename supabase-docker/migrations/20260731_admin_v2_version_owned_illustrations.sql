-- Admin V2: illustrations belong to activity versions.
-- Removes the independent system illustration asset table after verified backfill.
-- Family-private cover assets are retained because they preserve family ownership/governance.

BEGIN;

ALTER TABLE public.admin_v2_activity_versions
  ADD COLUMN IF NOT EXISTS illustration_storage_bucket text,
  ADD COLUMN IF NOT EXISTS illustration_storage_path text,
  ADD COLUMN IF NOT EXISTS illustration_mime_type text,
  ADD COLUMN IF NOT EXISTS illustration_width integer,
  ADD COLUMN IF NOT EXISTS illustration_height integer,
  ADD COLUMN IF NOT EXISTS illustration_alt text,
  ADD COLUMN IF NOT EXISTS illustration_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.admin_v2_activity_versions'::regclass
      AND conname = 'admin_v2_activity_versions_illustration_width_check'
  ) THEN
    ALTER TABLE public.admin_v2_activity_versions
      ADD CONSTRAINT admin_v2_activity_versions_illustration_width_check
      CHECK (illustration_width IS NULL OR illustration_width >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.admin_v2_activity_versions'::regclass
      AND conname = 'admin_v2_activity_versions_illustration_height_check'
  ) THEN
    ALTER TABLE public.admin_v2_activity_versions
      ADD CONSTRAINT admin_v2_activity_versions_illustration_height_check
      CHECK (illustration_height IS NULL OR illustration_height >= 0);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_admin_v2_published_version_content_lock ON public.admin_v2_activity_versions;

DO $$
DECLARE
  v_constraint text;
BEGIN
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.admin_v2_activity_versions'::regclass
      AND contype = 'f'
      AND confrelid = 'public.admin_v2_system_illustration_assets'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.admin_v2_activity_versions DROP CONSTRAINT IF EXISTS %I', v_constraint);
  END LOOP;

  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.admin_v2_activity_versions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%illustration_source%'
      AND pg_get_constraintdef(oid) ILIKE '%illustration_asset_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.admin_v2_activity_versions DROP CONSTRAINT IF EXISTS %I', v_constraint);
  END LOOP;
END $$;

UPDATE public.admin_v2_activity_versions v
SET illustration_storage_bucket = COALESCE(v.illustration_storage_bucket, a.storage_bucket, 'illustrations'),
    illustration_storage_path = COALESCE(NULLIF(v.illustration_storage_path, ''), NULLIF(v.illustration_path, ''), a.path),
    illustration_mime_type = COALESCE(v.illustration_mime_type, a.mime_type),
    illustration_alt = COALESCE(NULLIF(v.illustration_alt, ''), a.title, v.title),
    illustration_metadata = COALESCE(v.illustration_metadata, '{}'::jsonb) || jsonb_build_object(
      'legacy_system_asset_id', a.id::text,
      'legacy_system_asset_source_key', a.source_key,
      'legacy_system_asset_status', a.status,
      'backfilled_at', now()
    ),
    updated_at = now()
FROM public.admin_v2_system_illustration_assets a
WHERE v.illustration_source = 'system_asset'
  AND v.illustration_asset_id = a.id
  AND NOT (COALESCE(v.illustration_metadata, '{}'::jsonb) ? 'legacy_system_asset_id');

UPDATE public.admin_v2_activity_versions v
SET illustration_storage_bucket = COALESCE(v.illustration_storage_bucket, 'illustrations'),
    illustration_storage_path = COALESCE(NULLIF(v.illustration_storage_path, ''), NULLIF(v.illustration_path, '')),
    illustration_alt = COALESCE(NULLIF(v.illustration_alt, ''), v.title),
    illustration_asset_id = COALESCE(
      v.illustration_asset_id,
      public.admin_v2_stable_uuid('system_illustration_asset', COALESCE(NULLIF(v.illustration_storage_path, ''), NULLIF(v.illustration_path, '')))
    ),
    updated_at = now()
WHERE v.illustration_source = 'system_asset'
  AND COALESCE(NULLIF(v.illustration_storage_path, ''), NULLIF(v.illustration_path, '')) IS NOT NULL
  AND (
    v.illustration_storage_bucket IS NULL
    OR v.illustration_storage_path IS NULL
    OR v.illustration_alt IS NULL
    OR v.illustration_asset_id IS NULL
  );

UPDATE public.admin_v2_activity_versions v
SET illustration_storage_bucket = COALESCE(v.illustration_storage_bucket, a.storage_bucket, 'illustrations'),
    illustration_storage_path = COALESCE(NULLIF(v.illustration_storage_path, ''), NULLIF(v.illustration_path, ''), a.path),
    illustration_mime_type = COALESCE(v.illustration_mime_type, a.mime_type),
    illustration_alt = COALESCE(NULLIF(v.illustration_alt, ''), a.title, v.title),
    illustration_metadata = COALESCE(v.illustration_metadata, '{}'::jsonb) || jsonb_build_object(
      'family_private_cover_asset_id', a.id::text,
      'family_private_cover_source_key', a.source_key,
      'family_private_cover_status', a.status,
      'backfilled_at', now()
    ),
    updated_at = now()
FROM public.admin_v2_family_private_cover_assets a
WHERE v.illustration_source = 'family_private'
  AND v.family_private_cover_asset_id = a.id
  AND (
    NOT (COALESCE(v.illustration_metadata, '{}'::jsonb) ? 'family_private_cover_asset_id')
    OR v.illustration_storage_bucket IS NULL
    OR v.illustration_storage_path IS NULL
    OR v.illustration_alt IS NULL
  );

DO $$
DECLARE
  v_missing_version_refs integer;
  v_orphan_system_assets integer;
BEGIN
  SELECT count(*)::integer
  INTO v_missing_version_refs
  FROM public.admin_v2_activity_versions v
  WHERE v.illustration_source = 'system_asset'
    AND COALESCE(NULLIF(v.illustration_storage_path, ''), NULLIF(v.illustration_path, '')) IS NULL;

  IF v_missing_version_refs > 0 THEN
    RAISE EXCEPTION 'admin_v2_system_illustration_backfill_incomplete:%', v_missing_version_refs;
  END IF;

  SELECT count(*)::integer
  INTO v_orphan_system_assets
  FROM public.admin_v2_system_illustration_assets a
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.admin_v2_activity_versions v
    WHERE v.illustration_source = 'system_asset'
      AND (
        v.illustration_asset_id = a.id
        OR COALESCE(NULLIF(v.illustration_storage_path, ''), NULLIF(v.illustration_path, '')) = a.path
      )
  );

  IF v_orphan_system_assets > 0 THEN
    RAISE EXCEPTION 'admin_v2_system_illustration_assets_have_no_version_owner:%', v_orphan_system_assets;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.admin_v2_activity_versions'::regclass
      AND conname = 'admin_v2_activity_versions_illustration_ownership_check'
  ) THEN
    ALTER TABLE public.admin_v2_activity_versions
      ADD CONSTRAINT admin_v2_activity_versions_illustration_ownership_check
      CHECK (
        (
          illustration_source = 'system_asset'
          AND family_private_cover_asset_id IS NULL
          AND COALESCE(NULLIF(illustration_storage_path, ''), NULLIF(illustration_path, '')) IS NOT NULL
        )
        OR (
          illustration_source = 'family_private'
          AND illustration_asset_id IS NULL
          AND family_private_cover_asset_id IS NOT NULL
          AND COALESCE(NULLIF(illustration_storage_path, ''), NULLIF(illustration_path, '')) IS NOT NULL
        )
        OR (
          illustration_source IN ('motif_fallback', 'none')
          AND illustration_asset_id IS NULL
          AND family_private_cover_asset_id IS NULL
        )
      );
  END IF;
END $$;

DO $$
DECLARE
  v_relkind "char";
BEGIN
  SELECT c.relkind
  INTO v_relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'admin_v2_system_illustration_assets';

  IF v_relkind = 'r' THEN
    DROP POLICY IF EXISTS "admin_v2_system_assets_read" ON public.admin_v2_system_illustration_assets;
    DROP POLICY IF EXISTS "admin_v2_system_assets_write" ON public.admin_v2_system_illustration_assets;
    DROP TABLE public.admin_v2_system_illustration_assets;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.admin_v2_system_illustration_assets AS
WITH version_illustrations AS (
  SELECT
    COALESCE(
      v.illustration_asset_id,
      public.admin_v2_stable_uuid('system_illustration_asset', COALESCE(NULLIF(v.illustration_storage_path, ''), NULLIF(v.illustration_path, '')))
    ) AS id,
    'illustrations:' || COALESCE(NULLIF(v.illustration_storage_path, ''), NULLIF(v.illustration_path, '')) AS source_key,
    a.display_no,
    COALESCE(NULLIF(v.illustration_alt, ''), v.title) AS title,
    COALESCE(NULLIF(v.illustration_storage_bucket, ''), 'illustrations') AS storage_bucket,
    COALESCE(NULLIF(v.illustration_storage_path, ''), NULLIF(v.illustration_path, '')) AS path,
    v.illustration_mime_type AS mime_type,
    a.id AS activity_id,
    a.status AS activity_status,
    v.status AS version_status,
    COALESCE(v.published_by, v.drafted_by, a.created_by) AS created_by,
    v.created_at,
    v.updated_at
  FROM public.admin_v2_activity_versions v
  JOIN public.admin_v2_activities a ON a.id = v.activity_id
  WHERE v.illustration_source = 'system_asset'
    AND COALESCE(NULLIF(v.illustration_storage_path, ''), NULLIF(v.illustration_path, '')) IS NOT NULL
)
SELECT
  id,
  min(source_key) AS source_key,
  min(display_no) AS display_no,
  min(title) AS title,
  min(storage_bucket) AS storage_bucket,
  path,
  max(mime_type) AS mime_type,
  CASE
    WHEN bool_or(activity_status = 'published' AND version_status = 'published') THEN 'active'
    WHEN bool_or(activity_status = 'unpublished' OR version_status = 'unpublished') THEN 'disabled'
    ELSE 'archived'
  END AS status,
  count(DISTINCT activity_id)::integer AS usage_count,
  min(created_by::text)::uuid AS created_by,
  min(created_at) AS created_at,
  max(updated_at) AS updated_at
FROM version_illustrations
GROUP BY id, path;

REVOKE ALL ON public.admin_v2_system_illustration_assets FROM PUBLIC, anon, authenticated;

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
    NEW.illustration_storage_bucket IS DISTINCT FROM OLD.illustration_storage_bucket OR
    NEW.illustration_storage_path IS DISTINCT FROM OLD.illustration_storage_path OR
    NEW.illustration_mime_type IS DISTINCT FROM OLD.illustration_mime_type OR
    NEW.illustration_width IS DISTINCT FROM OLD.illustration_width OR
    NEW.illustration_height IS DISTINCT FROM OLD.illustration_height OR
    NEW.illustration_alt IS DISTINCT FROM OLD.illustration_alt OR
    NEW.illustration_metadata IS DISTINCT FROM OLD.illustration_metadata OR
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

CREATE TRIGGER trg_admin_v2_published_version_content_lock
  BEFORE UPDATE ON public.admin_v2_activity_versions
  FOR EACH ROW EXECUTE FUNCTION public.admin_v2_prevent_published_version_content_mutation();

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
      'path', COALESCE(v.illustration_storage_path, v.illustration_path),
      'storage_bucket', v.illustration_storage_bucket,
      'storage_path', v.illustration_storage_path,
      'mime_type', v.illustration_mime_type,
      'width', v.illustration_width,
      'height', v.illustration_height,
      'alt', v.illustration_alt,
      'metadata', v.illustration_metadata
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
    IF p_version.family_private_cover_asset_id IS NOT NULL
      OR COALESCE(NULLIF(p_version.illustration_storage_path, ''), NULLIF(p_version.illustration_path, '')) IS NULL THEN
      RAISE EXCEPTION 'invalid_illustration_source';
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
  v_illustration_storage_bucket text;
  v_illustration_storage_path text;
  v_illustration_mime_type text;
  v_illustration_width integer;
  v_illustration_height integer;
  v_illustration_alt text;
  v_illustration_metadata jsonb;
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
  v_illustration_storage_bucket := v_version.illustration_storage_bucket;
  v_illustration_storage_path := COALESCE(v_version.illustration_storage_path, v_version.illustration_path);
  v_illustration_mime_type := v_version.illustration_mime_type;
  v_illustration_width := v_version.illustration_width;
  v_illustration_height := v_version.illustration_height;
  v_illustration_alt := v_version.illustration_alt;
  v_illustration_metadata := COALESCE(v_version.illustration_metadata, '{}'::jsonb);

  IF v_patch ? 'illustration' THEN
    v_illustration := COALESCE(v_patch->'illustration', '{}'::jsonb);
    v_illustration_source := COALESCE(NULLIF(v_illustration->>'source', ''), 'none');
    v_illustration_asset_id := NULL;
    v_family_private_cover_asset_id := NULL;
    v_illustration_storage_bucket := NULLIF(COALESCE(v_illustration->>'storage_bucket', v_illustration->>'bucket'), '');
    v_illustration_storage_path := NULLIF(COALESCE(v_illustration->>'storage_path', v_illustration->>'path'), '');
    v_illustration_mime_type := NULLIF(COALESCE(v_illustration->>'mime_type', v_illustration->>'mime'), '');
    v_illustration_width := NULLIF(v_illustration->>'width', '')::integer;
    v_illustration_height := NULLIF(v_illustration->>'height', '')::integer;
    v_illustration_alt := NULLIF(v_illustration->>'alt', '');
    v_illustration_metadata := COALESCE(v_illustration->'metadata', '{}'::jsonb);

    IF v_illustration_source = 'system_asset' THEN
      v_illustration_asset_id := NULLIF(v_illustration->>'asset_id', '')::uuid;
      IF v_illustration_storage_path IS NULL AND v_illustration_asset_id IS NOT NULL THEN
        SELECT a.path, a.storage_bucket, a.mime_type, a.title
        INTO v_illustration_storage_path, v_illustration_storage_bucket, v_illustration_mime_type, v_illustration_alt
        FROM public.admin_v2_system_illustration_assets a
        WHERE a.id = v_illustration_asset_id;
      END IF;
      IF v_illustration_storage_path IS NULL THEN
        RAISE EXCEPTION 'validation_failed_missing_fields:illustration.storage_path';
      END IF;
      v_illustration_storage_bucket := COALESCE(v_illustration_storage_bucket, 'illustrations');
      v_illustration_asset_id := COALESCE(
        v_illustration_asset_id,
        public.admin_v2_stable_uuid('system_illustration_asset', v_illustration_storage_path)
      );
    ELSIF v_illustration_source = 'family_private' THEN
      v_family_private_cover_asset_id := NULLIF(v_illustration->>'asset_id', '')::uuid;
      IF v_activity.source_type = 'system' THEN
        RAISE EXCEPTION 'system_activity_cannot_use_family_private_asset';
      END IF;
      IF v_family_private_cover_asset_id IS NULL THEN
        RAISE EXCEPTION 'validation_failed_missing_fields:illustration.asset_id';
      END IF;
      SELECT a.path, a.storage_bucket, a.mime_type, a.title
      INTO v_illustration_storage_path, v_illustration_storage_bucket, v_illustration_mime_type, v_illustration_alt
      FROM public.admin_v2_family_private_cover_assets a
      WHERE a.id = v_family_private_cover_asset_id AND a.family_id = v_activity.family_id AND a.status = 'active';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_family_private_cover_asset';
      END IF;
    ELSIF v_illustration_source IN ('motif_fallback','none') THEN
      v_illustration_storage_bucket := NULL;
      v_illustration_storage_path := NULL;
      v_illustration_mime_type := NULL;
      v_illustration_width := NULL;
      v_illustration_height := NULL;
      v_illustration_alt := NULL;
      v_illustration_metadata := '{}'::jsonb;
    ELSE
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
      illustration_path = v_illustration_storage_path,
      illustration_storage_bucket = v_illustration_storage_bucket,
      illustration_storage_path = v_illustration_storage_path,
      illustration_mime_type = v_illustration_mime_type,
      illustration_width = v_illustration_width,
      illustration_height = v_illustration_height,
      illustration_alt = v_illustration_alt,
      illustration_metadata = COALESCE(v_illustration_metadata, '{}'::jsonb),
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
    illustration_asset_id, family_private_cover_asset_id, illustration_source, illustration_path,
    illustration_storage_bucket, illustration_storage_path, illustration_mime_type, illustration_width,
    illustration_height, illustration_alt, illustration_metadata, family_id,
    perspective, tone, category, scene, tags, min_age, max_age, seasonal, seal_recommendation,
    published_at, published_by, drafted_by, copied_from_version_id, created_at, updated_at
  )
  VALUES (
    v_activity.id, 1, 'published', v_source_version.title, v_source_version.why, v_source_version.how,
    v_source_version.record_hint, v_source_version.suggest_mode, v_source_version.allowed_capture_modes,
    v_source_version.illustration_asset_id, NULL,
    CASE WHEN v_source_version.illustration_source = 'family_private' THEN 'none' ELSE v_source_version.illustration_source END,
    CASE WHEN v_source_version.illustration_source = 'family_private' THEN NULL ELSE COALESCE(v_source_version.illustration_storage_path, v_source_version.illustration_path) END,
    CASE WHEN v_source_version.illustration_source = 'family_private' THEN NULL ELSE v_source_version.illustration_storage_bucket END,
    CASE WHEN v_source_version.illustration_source = 'family_private' THEN NULL ELSE v_source_version.illustration_storage_path END,
    CASE WHEN v_source_version.illustration_source = 'family_private' THEN NULL ELSE v_source_version.illustration_mime_type END,
    CASE WHEN v_source_version.illustration_source = 'family_private' THEN NULL ELSE v_source_version.illustration_width END,
    CASE WHEN v_source_version.illustration_source = 'family_private' THEN NULL ELSE v_source_version.illustration_height END,
    CASE WHEN v_source_version.illustration_source = 'family_private' THEN NULL ELSE v_source_version.illustration_alt END,
    CASE WHEN v_source_version.illustration_source = 'family_private' THEN '{}'::jsonb ELSE v_source_version.illustration_metadata END,
    v_family_id, v_source_version.perspective, v_source_version.tone,
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
    illustration_asset_id, family_private_cover_asset_id, illustration_source, illustration_path,
    illustration_storage_bucket, illustration_storage_path, illustration_mime_type, illustration_width,
    illustration_height, illustration_alt, illustration_metadata, family_id,
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
    COALESCE(v_base.illustration_storage_path, v_base.illustration_path),
    v_base.illustration_storage_bucket,
    v_base.illustration_storage_path,
    v_base.illustration_mime_type,
    v_base.illustration_width,
    v_base.illustration_height,
    v_base.illustration_alt,
    COALESCE(v_base.illustration_metadata, '{}'::jsonb),
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
        (SELECT count(*) FROM public.admin_v2_system_illustration_assets) +
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
      'read_model_source', 'version_illustration_compat',
      'id', a.id::text,
      'source_key', a.source_key,
      'display_no', a.display_no,
      'title', a.title,
      'path', a.path,
      'storage_bucket', a.storage_bucket,
      'storage_path', a.path,
      'mime_type', a.mime_type,
      'status', a.status,
      'usage_count', a.usage_count,
      'used_by_activity_ids', COALESCE(used.used_by_activity_ids, ARRAY[]::text[]),
      'created_by', COALESCE(a.created_by::text, ''),
      'created_at', a.created_at,
      'updated_at', a.updated_at
    )
    FROM public.admin_v2_system_illustration_assets a
    LEFT JOIN LATERAL (
      SELECT array_agg(DISTINCT v.activity_id::text ORDER BY v.activity_id::text) AS used_by_activity_ids
      FROM public.admin_v2_activity_versions v
      WHERE v.illustration_source = 'system_asset'
        AND COALESCE(NULLIF(v.illustration_storage_path, ''), NULLIF(v.illustration_path, '')) = a.path
    ) used ON true
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
      'current_version', public.admin_v2_activity_version_json(v),
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
      ELSE jsonb_build_object('activity_id', v_activity.copied_from_activity_id::text, 'activity_version_id', v_activity.copied_from_version_id::text)
    END,
    'current_version', v_current,
    'versions', v_versions,
    'audit_metadata', jsonb_build_object('read_model_source', 'activities_v2', 'compatibility_note', NULL)
  );
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
  v_storage_path text;
BEGIN
  v_activity_id := public.admin_v2_stable_uuid('activity:system', NEW.num);
  v_storage_path := NULLIF(btrim(NEW.illustration_path), '');
  IF v_storage_path IS NOT NULL THEN
    v_asset_id := public.admin_v2_stable_uuid('system_illustration_asset', v_storage_path);
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
    illustration_asset_id, illustration_source, illustration_path, illustration_storage_bucket,
    illustration_storage_path, illustration_alt, family_id, perspective, tone, category, scene,
    tags, min_age, max_age, seasonal, seal_recommendation, published_at, legacy_level_num, created_at, updated_at
  )
  VALUES (
    v_version_id, v_activity_id, v_version_no,
    CASE WHEN COALESCE(NEW.active, true) THEN 'published' ELSE 'unpublished' END,
    NEW.title, COALESCE(NEW.why, ''), COALESCE(NEW.how, ''), COALESCE(NEW.record, ''),
    CASE WHEN NEW.suggest IN ('text','photo','video','voice') THEN NEW.suggest ELSE 'photo' END,
    ARRAY['text','photo','video','voice']::text[], v_asset_id,
    CASE WHEN v_storage_path IS NOT NULL THEN 'system_asset' ELSE 'motif_fallback' END,
    v_storage_path, CASE WHEN v_storage_path IS NOT NULL THEN 'illustrations' ELSE NULL END,
    v_storage_path, NEW.title, NULL, NEW.perspective, NEW.tone, NEW.category, NEW.scene, NEW.tags,
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
      'illustration_storage_path', v_version.illustration_storage_path,
      'illustration_mime_type', v_version.illustration_mime_type,
      'illustration_width', v_version.illustration_width,
      'illustration_height', v_version.illustration_height,
      'illustration_alt', v_version.illustration_alt,
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

COMMIT;
