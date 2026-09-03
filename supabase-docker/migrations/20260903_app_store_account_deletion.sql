-- App Store privacy compliance: in a shared family, remove content authored by the
-- departing account instead of retaining it with a null author. Family-level child
-- profiles remain available to the other guardians, but lose the deleted author link.

DROP FUNCTION IF EXISTS public.delete_own_account();

CREATE FUNCTION public.delete_own_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  family_id_to_delete uuid;
  shared_family boolean := false;
  memory_ids text[] := ARRAY[]::text[];
  illustration_paths text[] := ARRAY[]::text[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '28000';
  END IF;

  SELECT fm.family_id INTO family_id_to_delete
  FROM public.family_members fm
  WHERE fm.user_id = uid
  LIMIT 1;

  IF family_id_to_delete IS NOT NULL THEN
    SELECT count(*) > 1 INTO shared_family
    FROM public.family_members fm
    WHERE fm.family_id = family_id_to_delete;

    SELECT COALESCE(array_agg(m.id::text), ARRAY[]::text[]) INTO memory_ids
    FROM public.memories m
    WHERE m.family_id = family_id_to_delete
      AND (NOT shared_family OR m.user_id = uid);

    SELECT COALESCE(array_agg(c.illustration_path), ARRAY[]::text[]) INTO illustration_paths
    FROM public.custom_levels c
    WHERE c.family_id = family_id_to_delete
      AND c.illustration_path IS NOT NULL
      AND (NOT shared_family OR c.user_id = uid);
  END IF;

  -- User-created records and custom activities are personal content even when shared.
  -- Their Storage paths are returned for best-effort cleanup after the DB transaction commits.
  DELETE FROM public.memories WHERE user_id = uid;
  DELETE FROM public.custom_levels WHERE user_id = uid;

  UPDATE public.families f
  SET created_by = (
    SELECT fm.user_id
    FROM public.family_members fm
    WHERE fm.family_id = f.id AND fm.user_id <> uid
    ORDER BY fm.joined_at ASC
    LIMIT 1
  )
  WHERE f.created_by = uid
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = f.id AND fm.user_id <> uid
    );

  DELETE FROM auth.users WHERE id = uid;

  RETURN jsonb_build_object(
    'familyId', family_id_to_delete,
    'memoryIds', to_jsonb(memory_ids),
    'illustrationPaths', to_jsonb(illustration_paths)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM public;
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
