import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'qr_login_failed'
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

async function hashToken(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function bearer(req: Request) {
  const value = req.headers.get('authorization') || ''
  return value.startsWith('Bearer ') ? value.slice(7) : ''
}

async function createChallenge() {
  await admin
    .from('qr_login_challenges')
    .delete()
    .lt('expires_at', new Date().toISOString())

  const scanToken = randomToken()
  const pollToken = randomToken()
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from('qr_login_challenges')
    .insert({
      scan_token_hash: await hashToken(scanToken),
      poll_token_hash: await hashToken(pollToken),
      expires_at: expiresAt,
    })
    .select('id')
    .single()
  if (error) throw error

  return json({
    id: data.id,
    pollToken,
    expiresAt,
    qrValue: `moments100://qr-login?challenge=${encodeURIComponent(data.id)}&token=${encodeURIComponent(scanToken)}`,
  })
}

async function findChallenge(challengeId: string, tokenColumn: string, token: string) {
  const { data, error } = await admin
    .from('qr_login_challenges')
    .select('*')
    .eq('id', challengeId)
    .eq(tokenColumn, await hashToken(token))
    .maybeSingle()
  if (error) throw error
  return data
}

async function pollChallenge(body: any) {
  const challenge = await findChallenge(body.challengeId, 'poll_token_hash', body.pollToken)
  if (!challenge) return json({ error: 'invalid_challenge' }, 404)
  if (new Date(challenge.expires_at).getTime() <= Date.now()) return json({ status: 'expired' })
  if (challenge.status === 'approved') {
    return json({ status: 'approved', tokenHash: challenge.login_token_hash })
  }
  return json({ status: 'pending' })
}

async function loginEmailFor(user: any) {
  if (user.email) return user.email
  const { data: profile, error } = await admin
    .from('profiles')
    .select('generated_email')
    .eq('id', user.id)
    .single()
  if (error || !profile?.generated_email) throw new Error('login_email_unavailable')

  const { data, error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    email: profile.generated_email,
    email_confirm: true,
  })
  if (updateError || !data.user?.email) throw updateError || new Error('login_email_unavailable')
  return data.user.email
}

async function approveChallenge(req: Request, body: any) {
  const accessToken = bearer(req)
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken)
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)
  if (userData.user.is_anonymous) return json({ error: 'permanent_account_required' }, 403)

  const challenge = await findChallenge(body.challengeId, 'scan_token_hash', body.scanToken)
  if (!challenge) return json({ error: 'invalid_challenge' }, 404)
  if (challenge.status !== 'pending' || new Date(challenge.expires_at).getTime() <= Date.now()) {
    return json({ error: 'expired_challenge' }, 410)
  }

  const email = await loginEmailFor(userData.user)
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError || !linkData.properties?.hashed_token) {
    throw linkError || new Error('login_token_unavailable')
  }

  const { data: updated, error: updateError } = await admin
    .from('qr_login_challenges')
    .update({
      status: 'approved',
      approved_user_id: userData.user.id,
      login_token_hash: linkData.properties.hashed_token,
      approved_at: new Date().toISOString(),
    })
    .eq('id', challenge.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (updateError) throw updateError
  if (!updated) return json({ error: 'challenge_already_used' }, 409)
  return json({ approved: true })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    if (body.action === 'create') return await createChallenge()
    if (body.action === 'poll') return await pollChallenge(body)
    if (body.action === 'approve') return await approveChallenge(req, body)
    return json({ error: 'invalid_action' }, 400)
  } catch (error) {
    console.error('qr-login failed', error)
    return json({ error: errorMessage(error) }, 500)
  }
})
