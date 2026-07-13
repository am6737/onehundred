-- ════════════════════════════════════════════════════════════
-- 智能推送 v2 — 文案扩容 + 轮播 + 「那年今天」回忆唤起
--
-- 背景（现状痛点）：
--   1. 每个场景只有 1 条果果文案 → 用户反复收到同一句 → 觉得腻。
--   2. 触发点写死（距上次记录 3/7/14 天），且首个非免打扰小时（≈08:00）扎堆发送
--      → 像固定定时器、可预测、无惊喜。
--   3. 前三优先级全是「你没记录」的内疚 nag，正向内容稀少。
--
-- 本迁移只动「内容层」：
--   • 为每个既有场景（squirrel/果果）补 2 条变体（sort_order 1、2），
--     配合 send-pet-notifications 的 pickTemplate() 做「最近用过的不重复」轮播。
--   • 新增正向场景 on_this_day（那年今天）：把 N 年前今天的旧记录翻出来,
--     以怀旧唤起替代内疚 nag，打破「全是催记录」的单调。
--
-- 调度层（个性化发送时段、轮播选取、on_this_day 匹配）在 Edge Function 里实现，
-- 无需改本表结构。notification_log 已有 template_id 列，轮播直接读它的发送历史。
--
-- 幂等：可重复执行（ON CONFLICT DO UPDATE）。
-- ════════════════════════════════════════════════════════════

-- ── 既有 7 场景：补充果果变体（sort_order 1、2），凑够每场景 3 条以支持轮播 ──
-- 语气延续既有果果：温柔、收着/守护/期待，句尾多用「呢/呀」，中文不堆坚果比喻；英文用 Pip。
INSERT INTO public.notification_templates (scene, species, lang, title, body, sort_order) VALUES
-- gentle_remind（3 天没记录 · 撒娇）
('gentle_remind', 'squirrel', 'zh', '果果', '好几天没有新记录啦，今天有没有哪个小瞬间，想留下来呀？', 1),
('gentle_remind', 'squirrel', 'en', 'Pip',  'A few quiet days here — was there a small moment today worth keeping?', 1),
('gentle_remind', 'squirrel', 'zh', '果果', '果果在这儿等着呢，随便一件小事都好，今天想记点什么吗？', 2),
('gentle_remind', 'squirrel', 'en', 'Pip',  'Pip''s right here. Even one little thing counts — anything to jot down today?', 2),
-- growth_nudge（7 天没记录 · 委屈）
('growth_nudge', 'squirrel', 'zh', '果果', '一周过去了，孩子说不定又悄悄变了样，果果好想记下来呀', 1),
('growth_nudge', 'squirrel', 'en', 'Pip',  'A whole week slipped by — the little one may have quietly changed. Pip would love to note it', 1),
('growth_nudge', 'squirrel', 'zh', '果果', '这一周，总有几个想留住的瞬间吧？说给果果听听嘛', 2),
('growth_nudge', 'squirrel', 'en', 'Pip',  'There must''ve been a moment or two worth keeping this week. Tell Pip about it?', 2),
-- loss_hint（14 天没记录 · 着急/损失厌恶）
('loss_hint', 'squirrel', 'zh', '果果', '有阵子没记啦…有些小事，过了这段日子，真的就慢慢想不起来了呢', 1),
('loss_hint', 'squirrel', 'en', 'Pip',  'It''s been a while… some little things really do slip away once the moment passes', 1),
('loss_hint', 'squirrel', 'zh', '果果', '果果一直帮你们守着这些回忆，可有些细节，不写下来会淡掉的…', 2),
('loss_hint', 'squirrel', 'en', 'Pip',  'Pip''s been keeping these memories safe, but some details fade if they''re never written down…', 2),
-- milestone（快解锁 · {{done}}/{{remain}} · 期待）
('milestone', 'squirrel', 'zh', '果果', '已经 {{done}} 件啦！再记 {{remain}} 件，就又能解锁一样新东西咯', 1),
('milestone', 'squirrel', 'en', 'Pip',  '{{done}} done already! {{remain}} more and something new unlocks', 1),
('milestone', 'squirrel', 'zh', '果果', '记满 {{done}} 件了呢，离下一个小惊喜只差 {{remain}} 件啦', 2),
('milestone', 'squirrel', 'en', 'Pip',  '{{done}} moments kept — just {{remain}} to go before the next little surprise', 2),
-- capsule（时间胶囊将启 · {{days}} · 期待）
('capsule', 'squirrel', 'zh', '果果', '那封写给未来的信，还有 {{days}} 天就要打开啦，果果有点小激动呢', 1),
('capsule', 'squirrel', 'en', 'Pip',  'That letter to the future opens in {{days}} days — Pip''s a little excited', 1),
('capsule', 'squirrel', 'zh', '果果', '再等 {{days}} 天，当初封存的那份心意就要和你们重逢咯', 2),
('capsule', 'squirrel', 'en', 'Pip',  'Just {{days}} days until the wish you sealed away comes back to you', 2),
-- family_activity（家人新记录 · {{who}} · 惊喜）
('family_activity', 'squirrel', 'zh', '果果', '{{who}}刚添了一条新记录，快去看看是什么呀', 1),
('family_activity', 'squirrel', 'en', 'Pip',  '{{who}} just added something new — go take a peek', 1),
('family_activity', 'squirrel', 'zh', '果果', '{{who}}留下了一个新瞬间，一起去看看吧', 2),
('family_activity', 'squirrel', 'en', 'Pip',  '{{who}} captured a new moment — let''s go see together', 2),
-- streak（连续记录 · {{days}} · 开心）
('streak', 'squirrel', 'zh', '果果', '连着 {{days}} 天都有记录啦，这份坚持，果果都看在眼里呢', 1),
('streak', 'squirrel', 'en', 'Pip',  '{{days}} days in a row — Pip''s noticed every bit of it', 1),
('streak', 'squirrel', 'zh', '果果', '{{days}} 天不间断，你们把日子过得好用心呀', 2),
('streak', 'squirrel', 'en', 'Pip',  '{{days}} days without a gap — what a lovingly kept little streak', 2)
ON CONFLICT (scene, species, lang, sort_order)
  DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

-- ── 新场景：on_this_day（那年今天 · 怀旧 · {{when}}）──
-- 触发：存在「N 年前的今天（365k±3 天）」且当前可见（未被封存锁住）的旧记录。
-- 定位：正向再互动 —— 用真实回忆把人拉回来，比内疚 nag 更温柔也更有效；置于场景优先级最顶。
-- {{when}} 由 Edge Function 按接收设备语言本地化填入（如「一年前的今天」/「a year ago today」）。
INSERT INTO public.notification_templates (scene, species, lang, title, body, sort_order) VALUES
('on_this_day', 'squirrel', 'zh', '果果', '{{when}}，你们也记下了一件小事。要不要回去看看当时的样子？', 0),
('on_this_day', 'squirrel', 'en', 'Pip',  '{{when}}, you kept a little moment. Want to see how it looked back then?', 0),
('on_this_day', 'squirrel', 'zh', '果果', '{{when}}，有一个瞬间被你们留住了。果果帮你翻出来啦', 1),
('on_this_day', 'squirrel', 'en', 'Pip',  '{{when}}, a moment was saved. Pip dug it back up for you', 1),
('on_this_day', 'squirrel', 'zh', '果果', '还记得{{when}}记下的那条吗？它一直都在呢', 2),
('on_this_day', 'squirrel', 'en', 'Pip',  '{{when}} — remember what you saved? It''s been here all along', 2)
ON CONFLICT (scene, species, lang, sort_order)
  DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;
