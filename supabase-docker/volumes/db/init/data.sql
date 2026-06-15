-- 定点照片：给 custom_levels 加 recurring / spot_note / reminder_text
ALTER TABLE public.custom_levels ADD COLUMN IF NOT EXISTS recurring TEXT DEFAULT NULL;
ALTER TABLE public.custom_levels ADD COLUMN IF NOT EXISTS spot_note TEXT NOT NULL DEFAULT '';
ALTER TABLE public.custom_levels ADD COLUMN IF NOT EXISTS reminder_text TEXT NOT NULL DEFAULT '';
