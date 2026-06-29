-- Persist when an invite-record link has been opened, so the app does not
-- show the same QR code as waiting again after the browser is closed.
ALTER TABLE public.invite_tokens
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
