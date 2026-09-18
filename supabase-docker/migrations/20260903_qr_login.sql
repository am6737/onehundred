-- Short-lived, server-only challenges for signing in one device from another.
CREATE TABLE IF NOT EXISTS public.qr_login_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_token_hash TEXT NOT NULL UNIQUE,
  poll_token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved')),
  approved_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  login_token_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 minutes'),
  approved_at TIMESTAMPTZ,
  CHECK (
    (status = 'pending' AND approved_user_id IS NULL AND login_token_hash IS NULL)
    OR
    (status = 'approved' AND approved_user_id IS NOT NULL AND login_token_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS qr_login_challenges_expires_at_idx
  ON public.qr_login_challenges (expires_at);

ALTER TABLE public.qr_login_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qr_login_challenges FROM anon, authenticated;
GRANT ALL ON public.qr_login_challenges TO service_role;

COMMENT ON TABLE public.qr_login_challenges IS
  'Two-minute QR sign-in challenges. Only the qr-login Edge Function may access this table.';
