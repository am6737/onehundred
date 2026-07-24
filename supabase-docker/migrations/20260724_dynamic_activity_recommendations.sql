-- 动态事项推荐：平台候选库不限数量；每个孩子每天最多获得 10 条稳定推荐。
-- 同一家庭成员共享当天结果，重复刷新不会获得更多事项。

BEGIN;

ALTER TABLE public.levels
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '综合',
  ADD COLUMN IF NOT EXISTS scene text NOT NULL DEFAULT '均可',
  ADD COLUMN IF NOT EXISTS min_age smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_age smallint NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS seasons text[] NOT NULL DEFAULT ARRAY['all']::text[],
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS quality_score smallint NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_ref text;

ALTER TABLE public.levels DROP CONSTRAINT IF EXISTS levels_age_range_check;
ALTER TABLE public.levels
  ADD CONSTRAINT levels_age_range_check
  CHECK (min_age >= 0 AND max_age >= min_age AND max_age <= 18);

ALTER TABLE public.levels DROP CONSTRAINT IF EXISTS levels_quality_score_check;
ALTER TABLE public.levels
  ADD CONSTRAINT levels_quality_score_check
  CHECK (quality_score BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS idx_levels_recommendation_pool
  ON public.levels (active, min_age, max_age, quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_levels_seasons_gin
  ON public.levels USING gin (seasons);
CREATE INDEX IF NOT EXISTS idx_levels_tags_gin
  ON public.levels USING gin (tags);

-- 首批候选事项沿用原始数据的年龄、季节、场景和分类元数据。
UPDATE public.levels AS l SET
  category = v.category,
  scene = v.scene,
  min_age = v.min_age,
  max_age = v.max_age,
  seasons = v.seasons,
  tags = v.tags,
  source_ref = v.source_ref
FROM (
  VALUES
    ('01', '家庭回忆', '室内', 4, 12, ARRAY['all']::text[], ARRAY['家庭回忆','室内']::text[], 'source-json:2'),
    ('06', '家庭回忆', '均可', 3, 12, ARRAY['all']::text[], ARRAY['家庭回忆','均可']::text[], 'source-json:159'),
    ('10', '家庭回忆', '室内', 4, 12, ARRAY['all']::text[], ARRAY['家庭回忆','室内']::text[], 'source-json:298'),
    ('16', '家庭仪式', '室内', 3, 12, ARRAY['all']::text[], ARRAY['家庭仪式','室内']::text[], 'source-json:341'),
    ('20', '家庭回忆', '室内', 5, 12, ARRAY['all']::text[], ARRAY['家庭回忆','室内']::text[], 'source-json:301'),
    ('22', '家庭回忆', '室内', 5, 12, ARRAY['all']::text[], ARRAY['家庭回忆','室内']::text[], 'source-json:161'),
    ('24', '亲子陪伴', '室内', 4, 12, ARRAY['all']::text[], ARRAY['亲子陪伴','室内']::text[], 'source-json:303'),
    ('26', '亲子陪伴', '均可', 3, 12, ARRAY['all']::text[], ARRAY['亲子陪伴','均可']::text[], 'source-json:315'),
    ('28', '亲子陪伴', '室内', 4, 12, ARRAY['all']::text[], ARRAY['亲子陪伴','室内']::text[], 'source-json:240'),
    ('30', '亲子陪伴', '室内', 6, 12, ARRAY['all']::text[], ARRAY['亲子陪伴','室内']::text[], 'source-json:38'),
    ('32', '家庭仪式', '室内', 5, 12, ARRAY['all']::text[], ARRAY['家庭仪式','室内']::text[], 'source-json:42'),
    ('33', '家庭仪式', '均可', 3, 12, ARRAY['all']::text[], ARRAY['家庭仪式','均可']::text[], 'source-json:166'),
    ('34', '家庭仪式', '均可', 5, 12, ARRAY['all']::text[], ARRAY['家庭仪式','均可']::text[], 'source-json:170'),
    ('35', '创意手工', '室内', 4, 12, ARRAY['all']::text[], ARRAY['创意手工','室内']::text[], 'source-json:157'),
    ('36', '生活实践', '室内', 4, 12, ARRAY['all']::text[], ARRAY['生活实践','室内']::text[], 'source-json:164'),
    ('37', '知识学习', '室内', 3, 12, ARRAY['all']::text[], ARRAY['知识学习','室内']::text[], 'source-json:207'),
    ('38', '知识学习', '室内', 7, 12, ARRAY['all']::text[], ARRAY['知识学习','室内']::text[], 'source-json:337'),
    ('39', '知识学习', '室内', 4, 12, ARRAY['all']::text[], ARRAY['知识学习','室内']::text[], 'source-json:310'),
    ('40', '艺术欣赏', '室内', 5, 12, ARRAY['all']::text[], ARRAY['艺术欣赏','室内']::text[], 'source-json:212'),
    ('41', '艺术欣赏', '室内', 3, 12, ARRAY['all']::text[], ARRAY['艺术欣赏','室内']::text[], 'source-json:308'),
    ('42', '艺术欣赏', '均可', 5, 12, ARRAY['all']::text[], ARRAY['艺术欣赏','均可']::text[], 'source-json:336'),
    ('43', '亲子陪伴', '室内', 4, 12, ARRAY['all']::text[], ARRAY['亲子陪伴','室内']::text[], 'source-json:296'),
    ('44', '知识学习', '室内', 5, 12, ARRAY['all']::text[], ARRAY['知识学习','室内']::text[], 'source-json:306'),
    ('45', '知识学习', '室内', 6, 12, ARRAY['all']::text[], ARRAY['知识学习','室内']::text[], 'source-json:149'),
    ('46', '自然探索', '均可', 5, 12, ARRAY['all']::text[], ARRAY['自然探索','均可']::text[], 'source-json:265'),
    ('47', '创意手工', '户外', 5, 12, ARRAY['spring','summer','autumn']::text[], ARRAY['创意手工','户外']::text[], 'source-json:267'),
    ('48', '自然探索', '均可', 4, 12, ARRAY['autumn']::text[], ARRAY['自然探索','均可']::text[], 'source-json:249'),
    ('49', '自然探索', '均可', 5, 12, ARRAY['spring','summer']::text[], ARRAY['自然探索','均可']::text[], 'source-json:269'),
    ('50', '知识学习', '室内', 6, 12, ARRAY['all']::text[], ARRAY['知识学习','室内']::text[], 'source-json:288'),
    ('51', '自然探索', '均可', 4, 12, ARRAY['spring','summer']::text[], ARRAY['自然探索','均可']::text[], 'source-json:277'),
    ('52', '自然探索', '户外', 4, 12, ARRAY['spring','summer','autumn']::text[], ARRAY['自然探索','户外']::text[], 'source-json:181'),
    ('53', '自然探索', '户外', 5, 12, ARRAY['spring','summer','autumn']::text[], ARRAY['自然探索','户外']::text[], 'source-json:263'),
    ('54', '知识学习', '室内', 5, 12, ARRAY['all']::text[], ARRAY['知识学习','室内']::text[], 'source-json:266'),
    ('55', '自然探索', '户外', 3, 10, ARRAY['spring','summer','autumn']::text[], ARRAY['自然探索','户外']::text[], 'source-json:186'),
    ('56', '社交能力', '均可', 7, 12, ARRAY['all']::text[], ARRAY['社交能力','均可']::text[], 'source-json:196'),
    ('57', '社交能力', '均可', 5, 12, ARRAY['all']::text[], ARRAY['社交能力','均可']::text[], 'source-json:109'),
    ('58', '社交能力', '均可', 5, 12, ARRAY['all']::text[], ARRAY['社交能力','均可']::text[], 'source-json:346'),
    ('59', '社交能力', '均可', 3, 12, ARRAY['all']::text[], ARRAY['社交能力','均可']::text[], 'source-json:231'),
    ('60', '社交能力', '室内', 5, 12, ARRAY['all']::text[], ARRAY['社交能力','室内']::text[], 'source-json:230'),
    ('61', '安全教育', '户外', 3, 10, ARRAY['all']::text[], ARRAY['安全教育','户外']::text[], 'source-json:234'),
    ('62', '安全教育', '均可', 4, 12, ARRAY['all']::text[], ARRAY['安全教育','均可']::text[], 'source-json:237'),
    ('63', '安全教育', '室内', 3, 10, ARRAY['all']::text[], ARRAY['安全教育','室内']::text[], 'source-json:236'),
    ('64', '安全教育', '户外', 4, 10, ARRAY['all']::text[], ARRAY['安全教育','户外']::text[], 'source-json:241'),
    ('65', '安全教育', '室内', 3, 10, ARRAY['all']::text[], ARRAY['安全教育','室内']::text[], 'source-json:242'),
    ('66', '生活实践', '室内', 6, 12, ARRAY['all']::text[], ARRAY['生活实践','室内']::text[], 'source-json:105'),
    ('67', '生活实践', '均可', 7, 12, ARRAY['all']::text[], ARRAY['生活实践','均可']::text[], 'source-json:293'),
    ('68', '户外探险', '户外', 7, 12, ARRAY['spring','summer','autumn']::text[], ARRAY['户外探险','户外']::text[], 'source-json:254'),
    ('69', '生活实践', '户外', 5, 12, ARRAY['all']::text[], ARRAY['生活实践','户外']::text[], 'source-json:247'),
    ('70', '生活实践', '户外', 4, 12, ARRAY['all']::text[], ARRAY['生活实践','户外']::text[], 'source-json:108'),
    ('71', '财商启蒙', '室内', 7, 12, ARRAY['all']::text[], ARRAY['财商启蒙','室内']::text[], 'source-json:252'),
    ('72', '财商启蒙', '室内', 6, 12, ARRAY['winter','spring']::text[], ARRAY['财商启蒙','室内']::text[], 'source-json:115'),
    ('73', '财商启蒙', '户外', 4, 12, ARRAY['all']::text[], ARRAY['财商启蒙','户外']::text[], 'source-json:199'),
    ('74', '财商启蒙', '均可', 5, 12, ARRAY['all']::text[], ARRAY['财商启蒙','均可']::text[], 'source-json:203'),
    ('75', '财商启蒙', '室内', 6, 12, ARRAY['all']::text[], ARRAY['财商启蒙','室内']::text[], 'source-json:39'),
    ('76', '生活实践', '室内', 4, 12, ARRAY['all']::text[], ARRAY['生活实践','室内']::text[], 'source-json:106'),
    ('77', '生活实践', '室内', 4, 12, ARRAY['all']::text[], ARRAY['生活实践','室内']::text[], 'source-json:244'),
    ('78', '创意手工', '室内', 5, 12, ARRAY['all']::text[], ARRAY['创意手工','室内']::text[], 'source-json:162'),
    ('79', '生活实践', '室内', 5, 12, ARRAY['all']::text[], ARRAY['生活实践','室内']::text[], 'source-json:283'),
    ('80', '厨房美食', '室内', 4, 12, ARRAY['all']::text[], ARRAY['厨房美食','室内']::text[], 'source-json:101'),
    ('81', '厨房美食', '室内', 5, 12, ARRAY['all']::text[], ARRAY['厨房美食','室内']::text[], 'source-json:279'),
    ('82', '厨房美食', '室内', 3, 10, ARRAY['summer']::text[], ARRAY['厨房美食','室内']::text[], 'source-json:268'),
    ('83', '节日仪式', '室内', 4, 12, ARRAY['summer']::text[], ARRAY['节日仪式','室内']::text[], 'source-json:99'),
    ('84', '节日仪式', '室内', 5, 12, ARRAY['winter']::text[], ARRAY['节日仪式','室内']::text[], 'source-json:155'),
    ('85', '户外探险', '户外', 3, 12, ARRAY['spring','autumn']::text[], ARRAY['户外探险','户外']::text[], 'source-json:171'),
    ('86', '创意手工', '室内', 3, 10, ARRAY['all']::text[], ARRAY['创意手工','室内']::text[], 'source-json:117'),
    ('87', '户外探险', '户外', 4, 12, ARRAY['spring','autumn']::text[], ARRAY['户外探险','户外']::text[], 'source-json:132'),
    ('88', '户外探险', '户外', 6, 12, ARRAY['spring','summer','autumn']::text[], ARRAY['户外探险','户外']::text[], 'source-json:256'),
    ('89', '运动健身', '户外', 7, 12, ARRAY['spring','summer','autumn']::text[], ARRAY['运动健身','户外']::text[], 'source-json:262'),
    ('90', '运动健身', '室内', 3, 10, ARRAY['all']::text[], ARRAY['运动健身','室内']::text[], 'source-json:192'),
    ('91', '运动健身', '均可', 5, 12, ARRAY['all']::text[], ARRAY['运动健身','均可']::text[], 'source-json:221'),
    ('92', '运动健身', '室内', 4, 12, ARRAY['all']::text[], ARRAY['运动健身','室内']::text[], 'source-json:190'),
    ('93', '艺术欣赏', '均可', 3, 12, ARRAY['all']::text[], ARRAY['艺术欣赏','均可']::text[], 'source-json:128'),
    ('94', '运动健身', '户外', 5, 12, ARRAY['spring','summer','autumn']::text[], ARRAY['运动健身','户外']::text[], 'source-json:323'),
    ('95', '运动健身', '均可', 3, 10, ARRAY['all']::text[], ARRAY['运动健身','均可']::text[], 'source-json:324'),
    ('96', '艺术欣赏', '室内', 3, 12, ARRAY['all']::text[], ARRAY['艺术欣赏','室内']::text[], 'source-json:349'),
    ('97', '创意手工', '室内', 5, 12, ARRAY['all']::text[], ARRAY['创意手工','室内']::text[], 'source-json:338'),
    ('98', '创意手工', '室内', 5, 12, ARRAY['all']::text[], ARRAY['创意手工','室内']::text[], 'source-json:339'),
    ('99', '家庭回忆', '室内', 5, 12, ARRAY['all']::text[], ARRAY['家庭回忆','室内']::text[], 'source-json:340'),
    ('100', '创意手工', '户外', 4, 12, ARRAY['all']::text[], ARRAY['创意手工','户外']::text[], 'source-json:245')
) AS v(num, category, scene, min_age, max_age, seasons, tags, source_ref)
WHERE l.num = v.num;

CREATE TABLE IF NOT EXISTS public.daily_level_recommendations (
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  recommendation_date date NOT NULL DEFAULT current_date,
  kid_id text REFERENCES public.kids(id) ON DELETE CASCADE,
  level_num text NOT NULL REFERENCES public.levels(num) ON DELETE CASCADE,
  rank smallint NOT NULL CHECK (rank BETWEEN 1 AND 10),
  status text NOT NULL DEFAULT 'shown' CHECK (status IN ('shown','skipped','chosen')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (family_id, recommendation_date, kid_id, level_num),
  UNIQUE NULLS NOT DISTINCT (family_id, recommendation_date, kid_id, rank)
);

ALTER TABLE public.daily_level_recommendations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'shown';
ALTER TABLE public.daily_level_recommendations DROP CONSTRAINT IF EXISTS daily_level_recommendations_status_check;
ALTER TABLE public.daily_level_recommendations
  ADD CONSTRAINT daily_level_recommendations_status_check
  CHECK (status IN ('shown','skipped','chosen'));

CREATE INDEX IF NOT EXISTS idx_daily_level_recs_recent
  ON public.daily_level_recommendations (family_id, kid_id, recommendation_date DESC);

ALTER TABLE public.daily_level_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_level_recommendations_family_read" ON public.daily_level_recommendations;
CREATE POLICY "daily_level_recommendations_family_read"
  ON public.daily_level_recommendations FOR SELECT
  USING (family_id = public.my_family_id());

-- 历史记录详情只按已知编号读取，客户端不再有权限下载整个候选库。
CREATE OR REPLACE FUNCTION public.get_levels_by_nums(p_nums text[])
RETURNS SETOF public.levels
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT l.*
  FROM public.levels l
  WHERE l.num = ANY(COALESCE(p_nums, '{}'::text[]));
$$;

REVOKE ALL ON FUNCTION public.get_levels_by_nums(text[]) FROM public;
REVOKE ALL ON FUNCTION public.get_levels_by_nums(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_levels_by_nums(text[]) TO authenticated;

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
  today_date date := current_date;
  current_season text;
  existing_count integer;
BEGIN
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

  -- 同一家庭、孩子、日期串行生成，防止多设备同时突破 10 条。
  PERFORM pg_advisory_xact_lock(
    hashtextextended(fid::text || '|' || COALESCE(normalized_kid_id, 'all') || '|' || today_date::text, 0)
  );

  SELECT count(*) INTO existing_count
  FROM public.daily_level_recommendations r
  WHERE r.family_id = fid
    AND r.recommendation_date = today_date
    AND r.kid_id IS NOT DISTINCT FROM normalized_kid_id;

  -- 第一轮：年龄合适、季节合适、30 天内没推荐过；按质量和稳定日随机排序。
  IF existing_count < 10 THEN
    INSERT INTO public.daily_level_recommendations
      (family_id, recommendation_date, kid_id, level_num, rank)
    SELECT
      fid,
      today_date,
      normalized_kid_id,
      candidate.num,
      existing_count + row_number() OVER ()
    FROM (
      SELECT l.num
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
            AND skipped.recommendation_date >= today_date - 90
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.daily_level_recommendations recent
          WHERE recent.family_id = fid
            AND recent.kid_id IS NOT DISTINCT FROM normalized_kid_id
            AND recent.level_num = l.num
            AND recent.recommendation_date >= today_date - 30
        )
      ORDER BY
        l.quality_score DESC,
        md5(fid::text || '|' || COALESCE(normalized_kid_id, 'all') || '|' || today_date::text || '|' || l.num)
      LIMIT 10 - existing_count
    ) candidate
    ON CONFLICT DO NOTHING;
  END IF;

  -- 候选库较小时的保底：仍不重复当天、不推荐已完成事项；允许突破 30 天冷却或季节软条件。
  SELECT count(*) INTO existing_count
  FROM public.daily_level_recommendations r
  WHERE r.family_id = fid
    AND r.recommendation_date = today_date
    AND r.kid_id IS NOT DISTINCT FROM normalized_kid_id;

  IF existing_count < 10 THEN
    INSERT INTO public.daily_level_recommendations
      (family_id, recommendation_date, kid_id, level_num, rank)
    SELECT
      fid,
      today_date,
      normalized_kid_id,
      candidate.num,
      existing_count + row_number() OVER ()
    FROM (
      SELECT l.num
      FROM public.levels l
      WHERE l.active
        AND (age_years IS NULL OR age_years BETWEEN l.min_age AND l.max_age)
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
          FROM public.daily_level_recommendations today
          WHERE today.family_id = fid
            AND today.recommendation_date = today_date
            AND today.kid_id IS NOT DISTINCT FROM normalized_kid_id
            AND today.level_num = l.num
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.daily_level_recommendations skipped
          WHERE skipped.family_id = fid
            AND skipped.kid_id IS NOT DISTINCT FROM normalized_kid_id
            AND skipped.level_num = l.num
            AND skipped.status = 'skipped'
            AND skipped.recommendation_date >= today_date - 90
        )
      ORDER BY
        l.quality_score DESC,
        md5(fid::text || '|fallback|' || COALESCE(normalized_kid_id, 'all') || '|' || today_date::text || '|' || l.num)
      LIMIT 10 - existing_count
    ) candidate
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT l.*
  FROM public.daily_level_recommendations r
  JOIN public.levels l ON l.num = r.level_num
  WHERE r.family_id = fid
    AND r.recommendation_date = today_date
    AND r.kid_id IS NOT DISTINCT FROM normalized_kid_id
    AND r.status <> 'skipped'
  ORDER BY r.rank;
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_recommended_levels(text) FROM public;
REVOKE ALL ON FUNCTION public.get_daily_recommended_levels(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_daily_recommended_levels(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_level_recommendation(
  p_kid_id text,
  p_level_num text,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  fid uuid := public.my_family_id();
  normalized_kid_id text := NULLIF(p_kid_id, 'all');
BEGIN
  IF fid IS NULL THEN RAISE EXCEPTION 'no_family'; END IF;
  IF p_action NOT IN ('skipped','chosen') THEN RAISE EXCEPTION 'invalid_action'; END IF;

  UPDATE public.daily_level_recommendations
  SET status = p_action
  WHERE family_id = fid
    AND recommendation_date = current_date
    AND kid_id IS NOT DISTINCT FROM normalized_kid_id
    AND level_num = p_level_num;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_level_recommendation(text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.mark_level_recommendation(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_level_recommendation(text, text, text) TO authenticated;

-- 事项库不再允许 App 直接全表 SELECT；管理后台 service_role 不受 RLS 影响。
DROP POLICY IF EXISTS "levels_public_read" ON public.levels;

COMMIT;
