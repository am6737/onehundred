-- Allow system administrators to temporarily disable the stable daily recommendation cap.

INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'daily_recommendation_limit',
  true,
  'Keep each child daily recommendation set stable and capped at 10 items.'
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.feature_flags FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_v2_get_feature_flag(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_flag public.feature_flags;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF NOT public.admin_v2_has_role(ARRAY['content_editor','content_reviewer','family_support','system_admin']) THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;

  SELECT * INTO v_flag
  FROM public.feature_flags
  WHERE key = p_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'feature_flag_not_found';
  END IF;

  RETURN jsonb_build_object(
    'key', v_flag.key,
    'enabled', v_flag.enabled,
    'description', v_flag.description,
    'updated_at', v_flag.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_v2_update_feature_flag(p_key text, p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_flag public.feature_flags;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;
  IF NOT public.admin_v2_has_role(ARRAY['system_admin']) THEN
    RAISE EXCEPTION 'not_allowed' USING errcode = '42501';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'feature_flag_enabled_required';
  END IF;

  UPDATE public.feature_flags
  SET enabled = p_enabled,
      updated_at = now()
  WHERE key = p_key
  RETURNING * INTO v_flag;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'feature_flag_not_found';
  END IF;

  INSERT INTO public.admin_audit_log
    (admin_user_id, action, target_type, target_id, details)
  VALUES
    (v_actor, 'feature_flag.update', 'feature_flag', p_key, jsonb_build_object('enabled', p_enabled));

  RETURN jsonb_build_object(
    'key', v_flag.key,
    'enabled', v_flag.enabled,
    'description', v_flag.description,
    'updated_at', v_flag.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_v2_get_feature_flag(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_v2_update_feature_flag(text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_v2_get_feature_flag(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_v2_update_feature_flag(text, boolean) TO authenticated;

-- Preserve the existing stable/capped implementation as an internal helper.
DO $$
BEGIN
  IF to_regprocedure('public.get_limited_daily_recommended_levels(text)') IS NULL THEN
    ALTER FUNCTION public.get_daily_recommended_levels(text)
      RENAME TO get_limited_daily_recommended_levels;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.get_limited_daily_recommended_levels(text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_daily_recommended_levels(p_kid_id text DEFAULT NULL)
RETURNS SETOF public.levels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  fid uuid := public.my_family_id();
  normalized_kid_id text := NULLIF(p_kid_id, 'all');
  age_years integer;
  current_season text;
  limit_enabled boolean;
BEGIN
  SELECT COALESCE((
    SELECT enabled
    FROM public.feature_flags
    WHERE key = 'daily_recommendation_limit'
  ), true)
  INTO limit_enabled;

  IF limit_enabled THEN
    RETURN QUERY
    SELECT * FROM public.get_limited_daily_recommended_levels(p_kid_id);
    RETURN;
  END IF;

  IF fid IS NULL THEN
    RAISE EXCEPTION 'no_family';
  END IF;

  IF normalized_kid_id IS NOT NULL THEN
    SELECT GREATEST(
      0,
      EXTRACT(year FROM age(current_date, make_date(k.birth_year, k.birth_month, 1)))::integer
    )
    INTO age_years
    FROM public.kids k
    WHERE k.id = normalized_kid_id AND k.family_id = fid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'kid_not_found';
    END IF;
  END IF;

  current_season := CASE
    WHEN EXTRACT(month FROM current_date) BETWEEN 3 AND 5 THEN 'spring'
    WHEN EXTRACT(month FROM current_date) BETWEEN 6 AND 8 THEN 'summer'
    WHEN EXTRACT(month FROM current_date) BETWEEN 9 AND 11 THEN 'autumn'
    ELSE 'winter'
  END;

  RETURN QUERY
  SELECT l.*
  FROM public.levels l
  WHERE l.active
    AND (age_years IS NULL OR age_years BETWEEN l.min_age AND l.max_age)
    AND ('all' = ANY(l.seasons) OR current_season = ANY(l.seasons))
    AND NOT EXISTS (
      SELECT 1
      FROM public.memories m
      WHERE m.family_id = fid
        AND m.level_num = l.num
        AND (
          normalized_kid_id IS NULL
          OR m.kid_id = normalized_kid_id
          OR m.kid_id = 'all'
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_level_recommendations skipped
      WHERE skipped.family_id = fid
        AND skipped.kid_id IS NOT DISTINCT FROM normalized_kid_id
        AND skipped.level_num = l.num
        AND skipped.status = 'skipped'
        AND skipped.recommendation_date >= current_date - 90
    )
  ORDER BY random()
  LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_recommended_levels(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_recommended_levels(text) TO authenticated;
