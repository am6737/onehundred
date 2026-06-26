-- ════════════════════════════════════════════════════════════
-- 宠物拟人化通知系统 — 数据库迁移
--
-- 应用方式（任选其一）：
--   • Supabase Studio → SQL Editor，整段粘贴执行
--   • psql "<postgres connection string>" -f 20260623_pet_notifications.sql
--
-- 本文件可重复执行（idempotent）。类型已按现有 schema 对齐：
--   kids.id = TEXT，families.id = UUID。
-- ════════════════════════════════════════════════════════════

-- ── 1. mascots 增加 species ──
ALTER TABLE public.mascots
  ADD COLUMN IF NOT EXISTS species TEXT NOT NULL DEFAULT 'bear';

DO $$ BEGIN
  ALTER TABLE public.mascots
    ADD CONSTRAINT mascots_species_chk CHECK (species IN ('bear', 'dog', 'cat'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.mascots.species IS '宠物种类：bear/dog/cat';

-- ── 2. notification_templates（全局参考文案，只读）──
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id          SERIAL PRIMARY KEY,
  scene       TEXT NOT NULL,        -- gentle_remind / growth_nudge / loss_hint / milestone / capsule / family_activity / streak
  species     TEXT NOT NULL,        -- bear / dog / cat
  lang        TEXT NOT NULL,        -- zh / en
  title       TEXT NOT NULL,        -- 通知标题（取宠物名）
  body        TEXT NOT NULL,        -- 正文，支持 {{done}} {{remain}} {{days}} {{who}}
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scene, species, lang, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_templates_lookup
  ON public.notification_templates (scene, species, lang);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "templates_read" ON public.notification_templates
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. notification_log（防重复 + 点击分析）──
CREATE TABLE IF NOT EXISTS public.notification_log (
  id           BIGSERIAL PRIMARY KEY,
  kid_id       TEXT NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  family_id    UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  scene        TEXT NOT NULL,
  template_id  INT REFERENCES public.notification_templates(id),
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  clicked      BOOLEAN NOT NULL DEFAULT false,
  clicked_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notif_log_kid
  ON public.notification_log (kid_id, sent_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "notif_log_family" ON public.notification_log
    FOR ALL USING (family_id = public.my_family_id())
    WITH CHECK (family_id = public.my_family_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. notification_preferences（每家庭一行）──
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  family_id    UUID PRIMARY KEY REFERENCES public.families(id) ON DELETE CASCADE,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  frequency    TEXT NOT NULL DEFAULT 'normal' CHECK (frequency IN ('gentle', 'normal', 'frequent')),
  quiet_start  TIME NOT NULL DEFAULT '22:00',
  quiet_end    TIME NOT NULL DEFAULT '08:00',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "notif_prefs_family" ON public.notification_preferences
    FOR ALL USING (family_id = public.my_family_id())
    WITH CHECK (family_id = public.my_family_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. 模板种子数据（7 场景 × 3 宠物 × 2 语言 = 42 行）──
-- title = 宠物名（团团/旺旺/咪咪 · Dango/Woof/Mimi）；body 来自通知方案文案。
INSERT INTO public.notification_templates (scene, species, lang, title, body) VALUES
-- 场景 1：gentle_remind（3 天没记录）
('gentle_remind', 'bear', 'zh', '团团', '团团翻了翻日记本，最近几页还是空白的呢'),
('gentle_remind', 'bear', 'en', 'Dango', 'Dango flipped through the journal… the last few pages are still blank'),
('gentle_remind', 'dog',  'zh', '旺旺', '旺旺好几天没看到新故事了！今天有什么好玩的吗？'),
('gentle_remind', 'dog',  'en', 'Woof', 'Woof hasn''t seen a new story in days! Anything fun happen today?'),
('gentle_remind', 'cat',  'zh', '咪咪', '咪咪才不关心你们有没有记录呢。才没有。'),
('gentle_remind', 'cat',  'en', 'Mimi', 'Mimi doesn''t care if you haven''t been recording. Not at all.'),
-- 场景 2：growth_nudge（7 天没记录）
('growth_nudge', 'bear', 'zh', '团团', '这一周宝宝一定又长大了一点吧…团团想听呀'),
('growth_nudge', 'bear', 'en', 'Dango', 'The little one must have grown a bit this week… Dango would love to hear about it'),
('growth_nudge', 'dog',  'zh', '旺旺', '一整周了！旺旺急死了！快来说说这周都干了什么！'),
('growth_nudge', 'dog',  'en', 'Woof', 'A whole week!! Woof is dying to know! What happened?!'),
('growth_nudge', 'cat',  'zh', '咪咪', '一周了哦。不过咪咪才不会催你呢。只是顺便提一下。'),
('growth_nudge', 'cat',  'en', 'Mimi', 'It''s been a week. Not that Mimi would rush you. Just mentioning it.'),
-- 场景 3：loss_hint（14 天没记录）
('loss_hint', 'bear', 'zh', '团团', '有些小事不记下来，真的会忘掉的呢…团团有点担心'),
('loss_hint', 'bear', 'en', 'Dango', 'Little moments can slip away if you don''t write them down… Dango is a bit worried'),
('loss_hint', 'dog',  'zh', '旺旺', '两周了！旺旺都快把之前的事忘了，你们也是吧？快记下来！'),
('loss_hint', 'dog',  'en', 'Woof', 'Two weeks!! Woof is already forgetting things, aren''t you too? Write them down!'),
('loss_hint', 'cat',  'zh', '咪咪', '两周没记了。记忆这种东西，丢了就丢了吧。…真的没关系吗？'),
('loss_hint', 'cat',  'en', 'Mimi', 'Two weeks with nothing. Memories fade, I guess. …Is that really fine though?'),
-- 场景 4：milestone（快解锁新装扮，{{done}}/{{remain}}）
('milestone', 'bear', 'zh', '团团', '已经记了 {{done}} 件事啦！再记 {{remain}} 件，团团就有新衣服穿了呀'),
('milestone', 'bear', 'en', 'Dango', '{{done}} things recorded! Just {{remain}} more and Dango gets a new outfit'),
('milestone', 'dog',  'zh', '旺旺', '哇 {{done}} 件了！！还差 {{remain}} 件旺旺就能换新衣服啦！冲冲冲！'),
('milestone', 'dog',  'en', 'Woof', 'Wow {{done}} done!! Just {{remain}} more for Woof''s new outfit! Let''s gooo!'),
('milestone', 'cat',  'zh', '咪咪', '{{done}} 件了。再来 {{remain}} 件的话…咪咪的新衣服就到了。随便你啦。'),
('milestone', 'cat',  'en', 'Mimi', '{{done}} done. {{remain}} more and… Mimi''s new outfit arrives. Whatever.'),
-- 场景 5：capsule（时间胶囊即将开启，{{days}}）
('capsule', 'bear', 'zh', '团团', '那封写给未来的信，还有 {{days}} 天就要自己出现了呢'),
('capsule', 'bear', 'en', 'Dango', 'That letter to the future will reveal itself in {{days}} days'),
('capsule', 'dog',  'zh', '旺旺', '还有 {{days}} 天！！那封信就要开了！旺旺好期待好期待！'),
('capsule', 'dog',  'en', 'Woof', '{{days}} days left!! The letter is about to open! Woof can''t wait!!'),
('capsule', 'cat',  'zh', '咪咪', '{{days}} 天后那封信会打开。咪咪没有在倒数哦。才没有。'),
('capsule', 'cat',  'en', 'Mimi', 'That letter opens in {{days}} days. Mimi is NOT counting down. Definitely not.'),
-- 场景 6：family_activity（家人记录了新内容，{{who}}）
('family_activity', 'bear', 'zh', '团团', '{{who}}刚刚记了一件新的事，一起去看看呀'),
('family_activity', 'bear', 'en', 'Dango', '{{who}} just recorded something new, let''s go see'),
('family_activity', 'dog',  'zh', '旺旺', '{{who}}记了新的了！！快去看快去看！'),
('family_activity', 'dog',  'en', 'Woof', '{{who}} added something new!! Go look go look!'),
('family_activity', 'cat',  'zh', '咪咪', '{{who}}记了一件事。咪咪看过了。还行吧。'),
('family_activity', 'cat',  'en', 'Mimi', '{{who}} recorded something. Mimi already saw it. It''s okay I guess.'),
-- 场景 7：streak（连续记录鼓励，{{days}}）
('streak', 'bear', 'zh', '团团', '连续 {{days}} 天都有记录了呢，团团好开心呀'),
('streak', 'bear', 'en', 'Dango', '{{days}} days in a row! Dango is so happy'),
('streak', 'dog',  'zh', '旺旺', '{{days}} 天连续记录！！旺旺骄傲得尾巴都摇断了！'),
('streak', 'dog',  'en', 'Woof', '{{days}} days straight!! Woof''s tail is wagging off!'),
('streak', 'cat',  'zh', '咪咪', '连续 {{days}} 天了…好吧，咪咪承认你们还挺厉害的。'),
('streak', 'cat',  'en', 'Mimi', '{{days}} days in a row… Fine, Mimi admits that''s impressive.')
ON CONFLICT (scene, species, lang, sort_order)
  DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

-- ── 6. 定时调度 ──
-- 已拆到独立迁移 migrations/20260626_schedule_pet_notifications.sql
-- （pg_cron + pg_net，每小时调 send-pet-notifications）。部署好 Edge Function 后执行它。
