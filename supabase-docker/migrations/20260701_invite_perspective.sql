-- 邀记回填真实视角：此前 yaoji submit 把 memory.perspective 硬编码成 'together'，
-- 导致 parent/child 事项邀记做完后在首页删不掉、年度回顾视角占比也被算歪。
-- 给 invite_tokens 存下事项真实 perspective，submit 时据此写 memory。
-- 默认 'together' 只是给历史行兜底，新建 token 会带真实值。
ALTER TABLE public.invite_tokens
  ADD COLUMN IF NOT EXISTS perspective TEXT NOT NULL DEFAULT 'together';
