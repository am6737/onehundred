-- 任何登录方式（除邮箱登录外）都要自动生成一个可展示的邮箱，回填到「账户与安全」页。
-- 现象：游客登录后账户页看不到邮箱。根因：运行库早于 schema.sql 的 generated_email 版本——
--   profiles 无 generated_email 列，且 handle_new_user() 是旧版（只写 role/custom_role/family_extras，
--   完全不生成用户名/邮箱）。故这里：① 补列 ② 升级触发器 ③ 回填存量用户（当前多为游客）。
-- 邮箱格式参考多邻国：<prefix>.<uid10>@<prefix>.100moments.app
--   游客 guest.、手机 phone.、Apple apple.、微信 wx.、兜底 user.；邮箱登录直接用真实邮箱不另造。
--   uid10 = 用户 UUID 去连字符后前 10 位，天然唯一，触发器与回填用同一算法保证格式一致。

-- ① 补列：UNIQUE 允许多个 NULL，存量行先留空待 ③ 回填
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS generated_email TEXT UNIQUE;

-- ② 升级触发器：新用户注册即按登录方式生成 username + generated_email
--    改用 ON CONFLICT DO UPDATE 回填，兼容「行已存在但缺邮箱」的历史情形（幂等，不覆盖已有值）。
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _prefix TEXT;
  _short  TEXT;
  _uname  TEXT;
  _email  TEXT;
BEGIN
  _short := left(replace(NEW.id::text, '-', ''), 10);

  IF NEW.is_anonymous THEN
    _prefix := 'guest';
  ELSIF NEW.email IS NOT NULL AND (NEW.raw_app_meta_data->>'provider') = 'email' THEN
    _prefix := NULL;                          -- 邮箱登录：用真实邮箱，不另造
  ELSIF (NEW.raw_app_meta_data->>'provider') = 'apple' THEN
    _prefix := 'apple';
  ELSIF (NEW.raw_app_meta_data->>'provider') = 'wechat' THEN
    _prefix := 'wx';
  ELSIF NEW.phone IS NOT NULL THEN
    _prefix := 'phone';
  ELSE
    _prefix := 'user';
  END IF;

  IF _prefix IS NULL THEN
    _uname := split_part(NEW.email, '@', 1);
    _email := NEW.email;
  ELSE
    _uname := _prefix || '.' || _short;
    _email := _uname || '@' || _prefix || '.100moments.app';
  END IF;

  INSERT INTO public.profiles (id, username, generated_email)
  VALUES (NEW.id, _uname, _email)
  ON CONFLICT (id) DO UPDATE SET
    generated_email = COALESCE(public.profiles.generated_email, EXCLUDED.generated_email),
    username        = CASE WHEN COALESCE(public.profiles.username, '') = ''
                           THEN EXCLUDED.username ELSE public.profiles.username END;
  RETURN NEW;
END;
$$;

-- ③ 回填存量用户：凡 profiles 缺 generated_email 的，按其登录方式补上（含当前所有游客）
UPDATE public.profiles p
SET generated_email = sub.email,
    username = CASE WHEN COALESCE(p.username, '') = '' THEN sub.uname ELSE p.username END
FROM (
  SELECT u.id,
         CASE WHEN pfx.prefix IS NULL THEN split_part(u.email, '@', 1)
              ELSE pfx.prefix || '.' || left(replace(u.id::text, '-', ''), 10) END AS uname,
         CASE WHEN pfx.prefix IS NULL THEN u.email
              ELSE pfx.prefix || '.' || left(replace(u.id::text, '-', ''), 10)
                   || '@' || pfx.prefix || '.100moments.app' END AS email
  FROM auth.users u
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN u.is_anonymous THEN 'guest'
      WHEN u.email IS NOT NULL AND (u.raw_app_meta_data->>'provider') = 'email' THEN NULL
      WHEN (u.raw_app_meta_data->>'provider') = 'apple' THEN 'apple'
      WHEN (u.raw_app_meta_data->>'provider') = 'wechat' THEN 'wx'
      WHEN u.phone IS NOT NULL THEN 'phone'
      ELSE 'user'
    END AS prefix
  ) pfx
) sub
WHERE p.id = sub.id
  AND p.generated_email IS NULL
  AND sub.email IS NOT NULL;
