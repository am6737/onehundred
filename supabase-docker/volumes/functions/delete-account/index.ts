import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function bearer(req: Request) {
  const value = req.headers.get('authorization') || ''
  if (!value.startsWith('Bearer ')) throw new Error('unauthorized')
  return value.slice(7)
}

function appleIdentitySub(user: any): string | null {
  const identity = (user.identities || []).find((item: any) => item.provider === 'apple')
  return identity?.identity_data?.sub || identity?.id || null
}

async function appleClientSecret() {
  const teamId = Deno.env.get('APPLE_TEAM_ID') || ''
  const keyId = Deno.env.get('APPLE_KEY_ID') || ''
  const clientId = Deno.env.get('APPLE_CLIENT_ID') || ''
  const privateKey = (Deno.env.get('APPLE_PRIVATE_KEY') || '').replace(/\\n/g, '\n')
  if (!teamId || !keyId || !clientId || !privateKey) throw new Error('apple_revoke_not_configured')

  const key = await jose.importPKCS8(privateKey, 'ES256')
  const now = Math.floor(Date.now() / 1000)
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key)
}

async function revokeAppleToken(code: string, expectedSub: string) {
  const clientId = Deno.env.get('APPLE_CLIENT_ID') || ''
  const secret = await appleClientSecret()
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    code,
    grant_type: 'authorization_code',
  })
  const exchange = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  const tokens = await exchange.json()
  if (!exchange.ok) throw new Error(`apple_token_exchange_failed:${tokens.error || exchange.status}`)

  const claims = jose.decodeJwt(tokens.id_token || '')
  if (!claims.sub || claims.sub !== expectedSub) throw new Error('apple_identity_mismatch')
  const token = tokens.refresh_token || tokens.access_token
  const tokenTypeHint = tokens.refresh_token ? 'refresh_token' : 'access_token'
  if (!token) throw new Error('apple_revoke_token_missing')

  const revoke = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      token,
      token_type_hint: tokenTypeHint,
    }),
  })
  if (!revoke.ok) throw new Error(`apple_token_revoke_failed:${revoke.status}`)
}

async function removeMemoryFiles(admin: any, familyId: string, memoryIds: string[]) {
  for (const memoryId of memoryIds) {
    const dir = `${familyId}/${memoryId}`
    while (true) {
      const { data, error } = await admin.storage.from('memories').list(dir, { limit: 1000 })
      if (error) throw new Error(`memory_list_failed:${error.message}`)
      const paths = (data || []).filter((item: any) => item.id).map((item: any) => `${dir}/${item.name}`)
      if (!paths.length) break
      const { error: removeError } = await admin.storage.from('memories').remove(paths)
      if (removeError) throw new Error(`memory_remove_failed:${removeError.message}`)
    }
  }
}

async function cleanupStorage(admin: any, manifest: any) {
  const familyId = typeof manifest?.familyId === 'string' ? manifest.familyId : ''
  const memoryIds = Array.isArray(manifest?.memoryIds) ? manifest.memoryIds : []
  const illustrationPaths = Array.isArray(manifest?.illustrationPaths)
    ? manifest.illustrationPaths.filter(
      (path: unknown) => typeof path === 'string' && !/^https?:\/\//i.test(path as string),
    )
    : []

  if (familyId && memoryIds.length) await removeMemoryFiles(admin, familyId, memoryIds)
  if (illustrationPaths.length) {
    const { error } = await admin.storage.from('illustrations').remove(illustrationPaths)
    if (error) throw new Error(`illustration_remove_failed:${error.message}`)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const accessToken = bearer(req)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: userData, error: userError } = await admin.auth.getUser(accessToken)
    if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)
    const user = userData.user
    const body = await req.json().catch(() => ({}))

    const appleSub = appleIdentitySub(user)
    if (appleSub) {
      if (!body.appleAuthorizationCode) return json({ error: 'apple_reauthentication_required' }, 400)
      await revokeAppleToken(body.appleAuthorizationCode, appleSub)
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: cleanupManifest, error: deleteError } = await userClient.rpc('delete_own_account')
    if (deleteError) throw new Error(`account_delete_failed:${deleteError.message}`)

    let cleanupCompleted = true
    try {
      await cleanupStorage(admin, cleanupManifest)
    } catch (cleanupError) {
      cleanupCompleted = false
      console.error('delete-account storage cleanup failed', cleanupError, cleanupManifest)
    }
    return json({ deleted: true, cleanupCompleted })
  } catch (error) {
    console.error('delete-account failed', error)
    return json({ error: error instanceof Error ? error.message : 'delete_failed' }, 500)
  }
})
