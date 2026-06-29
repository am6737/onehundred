-- ════════════════════════════════════════════════════════════
-- 去除 notification_templates 里的 emoji（仅清 emoji，保留文案）
--
-- 背景：仓库的种子 SQL（migrations/20260623_pet_notifications.sql 与
--   volumes/db/init/schema.sql）模板值本就不含 emoji。若线上推送里出现 emoji，
--   说明是后来在 Studio 里手动改过 DB 的模板行。本脚本只针对线上 DB。
--
-- 用法：Studio SQL Editor 粘贴执行（先跑 ① 看有没有，有再跑 ②，最后 ③ 复核）。幂等。
--
-- emoji 字符类用「字面字符范围」而非 \u/\U 转义——避免某些 PG 版本不认转义时
-- 把 'F''E''0' 等字母误删、损坏文案。各范围边界字符：
--   🀀-🫿 = U+1F000–U+1FAFF（主表情 / 符号 / 旗帜 / 扩展-A）
--   ☀-➿  = U+2600–U+27BF（杂项符号 + Dingbats）
--   ⬀-⯿  = U+2B00–U+2BFF（杂项符号与箭头，如 ⭐）
--   ⌀-⏿  = U+2300–U+23FF（技术符号，如 ⏰⌚）
-- ════════════════════════════════════════════════════════════

-- ① 检测：当前哪些模板含 emoji（应当为空；有行就是手动写进 DB 的）
SELECT id, scene, species, lang, title, body
FROM public.notification_templates
WHERE title ~ '[🀀-🫿☀-➿⬀-⯿⌀-⏿]'
   OR body  ~ '[🀀-🫿☀-➿⬀-⯿⌀-⏿]'
ORDER BY scene, species, lang;

-- ② 清理：去掉 emoji，再把残留的多余空格收敛、去首尾空格
UPDATE public.notification_templates
SET title = btrim(regexp_replace(
      regexp_replace(title, '[🀀-🫿☀-➿⬀-⯿⌀-⏿]', '', 'g'), '\s{2,}', ' ', 'g')),
    body  = btrim(regexp_replace(
      regexp_replace(body,  '[🀀-🫿☀-➿⬀-⯿⌀-⏿]', '', 'g'), '\s{2,}', ' ', 'g'))
WHERE title ~ '[🀀-🫿☀-➿⬀-⯿⌀-⏿]'
   OR body  ~ '[🀀-🫿☀-➿⬀-⯿⌀-⏿]';

-- ③ 复核：再跑一次 ① 应当返回 0 行。
