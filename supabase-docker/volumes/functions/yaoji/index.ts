import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const PUBLIC_URL = Deno.env.get('SUPABASE_PUBLIC_URL') || SUPABASE_URL
const JWT_SECRET = Deno.env.get('JWT_SECRET')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-memory-id',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function genToken(len = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => chars[b % chars.length]).join('')
}

async function getUidFromJwt(req: Request): Promise<string> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) throw new Error('missing_auth')
  const token = auth.slice(7)
  const secret = new TextEncoder().encode(JWT_SECRET)
  const { payload } = await jose.jwtVerify(token, secret)
  if (!payload.sub) throw new Error('invalid_token')
  return payload.sub
}

async function getUserFamilyId(userId: string): Promise<string> {
  const { data } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .limit(1)
    .single()
  if (!data) throw new Error('no_family')
  return data.family_id
}

interface TokenRow {
  id: string
  family_id: string
  created_by: string
  level_num: string
  level_title: string
  level_why: string
  level_how: string
  level_record: string
  level_suggest: string
  level_tone: string
  perspective: string
  kid_id: string | null
  kid_name: string | null
  inviter_role: string
  illustration_path: string | null
  opened_at: string | null
  expires_at: string
  is_active: boolean
}

async function validateToken(tokenId: string): Promise<TokenRow> {
  const { data, error } = await admin
    .from('invite_tokens')
    .select('*')
    .eq('id', tokenId)
    .single()
  if (error || !data) throw new Error('invalid_token')
  if (!data.is_active) throw new Error('inactive_token')
  if (new Date(data.expires_at) < new Date()) throw new Error('expired_token')
  return data as TokenRow
}

// ── Handlers ──

async function handleCreate(req: Request): Promise<Response> {
  let uid: string
  try { uid = await getUidFromJwt(req) } catch { return json({ error: 'unauthorized' }, 401) }

  let familyId: string
  try { familyId = await getUserFamilyId(uid) } catch { return json({ error: 'no_family' }, 400) }

  const body = await req.json()
  const { levelNum, levelTitle, kidId, kidName, expiresDays = 1,
          levelWhy, levelHow, levelRecord, levelSuggest, levelTone,
          perspective, inviterRole, illustrationPath } = body

  if (!levelNum || !levelTitle) return json({ error: 'missing_fields' }, 400)

  let tokenId: string
  for (let i = 0; i < 5; i++) {
    tokenId = genToken()
    const { error } = await admin.from('invite_tokens').insert({
      id: tokenId,
      family_id: familyId,
      created_by: uid,
      level_num: levelNum,
      level_title: levelTitle,
      level_why: levelWhy || '',
      level_how: levelHow || '',
      level_record: levelRecord || '',
      level_suggest: levelSuggest || 'photo',
      level_tone: levelTone || 'orange',
      perspective: perspective || 'together',
      kid_id: kidId || null,
      kid_name: kidName || null,
      inviter_role: inviterRole || '',
      illustration_path: illustrationPath || null,
      expires_at: new Date(Date.now() + expiresDays * 86400000).toISOString(),
    })
    if (!error) {
      const url = `${PUBLIC_URL}/functions/v1/yaoji/page/${tokenId}`
      return json({ token: tokenId, url, expiresAt: new Date(Date.now() + expiresDays * 86400000).toISOString() })
    }
    if (!error.message.includes('duplicate')) return json({ error: error.message }, 500)
  }
  return json({ error: 'token_generation_failed' }, 500)
}

async function handleInfo(tokenId: string): Promise<Response> {
  let token: TokenRow
  try { token = await validateToken(tokenId) } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }
  if (!token.opened_at) {
    await admin
      .from('invite_tokens')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', tokenId)
      .is('opened_at', null)
  }

  // Resolve illustration URL: full URL stays as-is, bucket path uses PUBLIC_URL
  let illustrationUrl: string | null = null
  const illoPath = token.illustration_path
  if (illoPath) {
    if (/^https?:\/\//i.test(illoPath)) {
      illustrationUrl = illoPath
    } else {
      illustrationUrl = `${PUBLIC_URL}/storage/v1/object/public/illustrations/${illoPath}`
    }
  }

  return json({
    levelNum: token.level_num,
    levelTitle: token.level_title,
    levelWhy: token.level_why,
    levelHow: token.level_how,
    levelRecord: token.level_record,
    levelSuggest: token.level_suggest,
    levelTone: token.level_tone,
    kidName: token.kid_name,
    inviterRole: token.inviter_role,
    illustrationUrl,
  })
}

async function handleUpload(req: Request, tokenId: string): Promise<Response> {
  let token: TokenRow
  try { token = await validateToken(tokenId) } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }

  const memoryId = req.headers.get('x-memory-id')
  if (!memoryId) return json({ error: 'missing x-memory-id header' }, 400)

  const contentType = req.headers.get('content-type') || 'application/octet-stream'
  const bytes = new Uint8Array(await req.arrayBuffer())
  if (!bytes.length) return json({ error: 'empty_body' }, 400)
  if (bytes.length > 50 * 1024 * 1024) return json({ error: 'file_too_large' }, 413)

  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
    'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/ogg': 'ogg',
    'audio/wav': 'wav', 'audio/x-m4a': 'm4a',
  }
  const ext = extMap[contentType] || 'bin'

  const isVideo = contentType.startsWith('video/')
  const isAudio = contentType.startsWith('audio/')
  const prefix = isVideo ? 'video' : isAudio ? 'audio' : 'photo'

  // Count existing files of this type to determine index
  const { data: existing } = await admin.storage
    .from('memories')
    .list(`${token.family_id}/${memoryId}`)
  const idx = existing
    ? existing.filter(f => f.name.startsWith(prefix)).length
    : 0

  const filename = `${prefix}_${idx}.${ext}`
  const path = `${token.family_id}/${memoryId}/${filename}`

  const { error } = await admin.storage
    .from('memories')
    .upload(path, bytes, { contentType, upsert: false })

  if (error) return json({ error: error.message }, 500)
  return json({ path, filename, memoryId })
}

async function handleSubmit(req: Request, tokenId: string): Promise<Response> {
  let token: TokenRow
  try { token = await validateToken(tokenId) } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }

  const body = await req.json()
  const { memoryId, role, type, caption, place, shots, duration, date } = body
  if (!memoryId || !role || !type) return json({ error: 'missing_fields' }, 400)

  const memory = {
    id: memoryId,
    family_id: token.family_id,
    user_id: token.created_by,
    kid_id: token.kid_id || 'all',
    level_num: token.level_num,
    perspective: token.perspective || 'together',
    type,
    duration: duration || null,
    shots: shots || null,
    date: date || new Date().toISOString().slice(0, 10),
    place: place || null,
    title: token.level_title,
    caption: caption || '',
    transcript: null,
    tone: token.level_tone,
    sealed: false,
    seal_until: null,
    seal_label: null,
    invite_token_id: token.id,
    invited_role: role,
  }

  const { error } = await admin.from('memories').insert(memory)
  if (error) return json({ error: error.message }, 500)

  await admin.from('invite_tokens').update({ is_active: false }).eq('id', tokenId)

  // 邀记提交后通知家人：已改由 memories 的 DB 触发器 + outbox 统一投递
  // （上方已插入 memories 行，invite_token_id 非空→不排除任何人，invited_role 即 {{who}}）。
  // 故此处不再直接调 send-pet-notifications。

  return json({ success: true, memoryId })
}

async function handleDeactivate(req: Request): Promise<Response> {
  let uid: string
  try { uid = await getUidFromJwt(req) } catch { return json({ error: 'unauthorized' }, 401) }

  let familyId: string
  try { familyId = await getUserFamilyId(uid) } catch { return json({ error: 'no_family' }, 400) }

  const body = await req.json()
  const { tokenId } = body
  if (!tokenId) return json({ error: 'missing_fields' }, 400)

  const { error } = await admin
    .from('invite_tokens')
    .update({ is_active: false })
    .eq('id', tokenId)
    .eq('family_id', familyId)

  if (error) return json({ error: error.message }, 500)
  return json({ success: true })
}

// ── HTML Page ──

function renderPage(tokenId: string): Response {
  const html = buildHtml(tokenId)
  return new Response(html, {
    headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function buildHtml(token: string): string {
  const apiBase = `${PUBLIC_URL}/functions/v1/yaoji`
  const realtimeUrl = PUBLIC_URL
  const anonKey = ANON_KEY
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>邀记 — 一百件事</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Noto+Serif+SC:wght@400;700&family=Ma+Shan+Zheng&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --cream:#FAF3E6;--paper:#FFFDF7;--sand:#F2E7D2;
  --ink:#3A332B;--ink-soft:#8B8175;--line:#ECE2D0;
  --accent:#DE8C57;--accent-soft:#F4D9BE;--accent-ink:#7A4A24;
  --tone-soft:#F4D9BE;--tone-deep:#DE8C57;
  --r:30px;
  --head:'ZCOOL KuaiLe',sans-serif;
  --body:'Noto Serif SC',serif;
  --hand:'Ma Shan Zheng',cursive;
}
html{background:var(--cream)}
body{background:var(--cream);color:var(--ink);font-family:var(--body);
  min-height:100dvh;margin:0;-webkit-font-smoothing:antialiased;
  display:flex;flex-direction:column;align-items:center}

/* ── Screens ── */
.screen{display:none;width:100%;max-width:480px;min-height:100dvh;
  animation:fadeUp 0.3s ease}
.screen.active{display:flex;flex-direction:column}
/* Record screen is an app-shell: clamp to one viewport so only the
   middle area scrolls and the page itself can't be dragged */
#s-record.active{height:100dvh;overflow:hidden}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.hidden{display:none!important}

/* ══════════════════════════════════════
   Landing — matches app LevelDetail:
   full-bleed scroll, hero → title → sections → sticky bottom
   ══════════════════════════════════════ */
#s-landing{padding:0;position:relative}
#s-landing .land-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;
  padding:0 26px 140px}

/* Hero — 34% viewport, rounded, tone bg, centered icon */
.hero{width:100%;height:34vh;min-height:220px;border-radius:var(--r);
  overflow:hidden;position:relative;
  display:flex;align-items:center;justify-content:center;
  border:1px solid var(--line);margin-top:12px;
  box-shadow:0 10px 30px rgba(58,51,43,0.16)}
.hero-icon{font-size:80px;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.1));
  transition:opacity 0.3s}
.hero-img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
.hero-badge{position:absolute;left:14px;top:14px;display:flex;align-items:center;gap:6px;
  padding:5px 11px;border-radius:999px;background:rgba(255,253,247,0.86);
  font-family:var(--head);font-size:12px;color:var(--accent)}
.hero-badge-dot{width:6px;height:6px;border-radius:50%;background:var(--accent)}

/* Title */
.land-title{font-family:var(--head);font-size:30px;line-height:42px;
  color:var(--ink);margin-top:20px}

/* Kicker sections — identical to app SectionBlock */
.kicker{margin-top:28px}
.kicker-row{display:flex;align-items:center;margin-bottom:12px}
.kicker-dot{width:7px;height:7px;border-radius:999px;background:var(--accent);
  margin-right:10px;flex-shrink:0}
.kicker-label{font-family:var(--head);font-size:15px;color:var(--accent);letter-spacing:0.5px}
.kicker-body{font-family:var(--body);font-size:17px;line-height:34px;color:var(--ink)}

/* Suggest chip — matches app suggestCard */
.suggest-card{margin-top:24px;display:flex;align-items:center;padding:16px 18px;
  border-radius:20px;background:var(--paper);border:1px solid var(--line)}
.suggest-icon{width:44px;height:44px;border-radius:14px;display:flex;
  align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
.suggest-text{margin-left:12px}
.suggest-label{font-family:var(--body);font-size:13px;color:var(--ink-soft)}
.suggest-value{font-family:var(--head);font-size:17px;color:var(--ink);margin-top:2px}

/* Invite line */
.invite-line{font-family:var(--body);font-size:14px;color:var(--ink-soft);
  margin-top:20px;text-align:center;display:flex;align-items:center;
  justify-content:center;gap:6px}

/* Sticky bottom bar — matches app */
.bottom-bar{position:fixed;left:0;right:0;bottom:0;z-index:10;
  display:flex;justify-content:center}
.bottom-bar-inner{width:100%;max-width:480px;
  padding:0 22px 0;padding-bottom:max(16px,env(safe-area-inset-bottom));
  background:var(--cream);position:relative}
.bottom-fade{position:absolute;left:0;right:0;top:-40px;height:40px;
  background:linear-gradient(to bottom,transparent,var(--cream));pointer-events:none}
.bottom-buttons{display:flex;gap:12px;padding-top:6px}
.btn,.card-btn,.tab,.role,.back-btn,.capture-area,.rec-btn{-webkit-tap-highlight-color:transparent}
.btn{display:block;padding:15px;border:none;border-radius:999px;
  font-family:var(--head);font-size:17px;cursor:pointer;text-align:center;
  transition:transform 0.15s,opacity 0.15s}
.btn:active{transform:scale(0.97);opacity:0.85}
.btn-primary{background:var(--accent);color:#fff;flex:1;
  box-shadow:0 10px 24px rgba(222,140,87,0.35)}
.btn-secondary{background:var(--sand);color:var(--ink);
  padding-left:18px;padding-right:18px}

/* ══════════════════════════════════════
   Inner screens (identity / capture / details)
   — card based, with top-bar
   ══════════════════════════════════════ */
.inner-screen{padding:0 16px 40px}
.top-bar{position:relative;display:flex;align-items:center;justify-content:center;
  height:50px;flex-shrink:0}
.back-btn{position:absolute;left:0;top:4px;width:42px;height:42px;border-radius:21px;
  background:var(--paper);border:1px solid var(--line);display:flex;
  align-items:center;justify-content:center;cursor:pointer;
  box-shadow:0 4px 12px rgba(58,51,43,0.06)}
.back-btn:active{transform:scale(0.93)}
.back-btn svg{width:18px;height:18px}
.top-bar-title{font-family:var(--head);font-size:15px;color:var(--ink-soft)}
.card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r);
  padding:28px 24px;width:100%;margin-top:16px;
  box-shadow:0 12px 36px rgba(58,51,43,0.08)}
h2{font-family:var(--head);font-size:22px;color:var(--ink);margin-bottom:4px}
.sub{color:var(--ink-soft);font-size:14px;line-height:1.7}

/* Roles */
.roles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0 0}
.role{padding:12px 0;border-radius:999px;border:1.5px solid var(--line);
  background:var(--paper);font-family:var(--body);font-size:15px;cursor:pointer;
  transition:all 0.2s;color:var(--ink);text-align:center;
  -webkit-tap-highlight-color:transparent}
.role.active{border-color:var(--accent);background:var(--accent-soft);color:var(--ink);
  box-shadow:0 4px 14px rgba(222,140,87,0.2)}
.role:active{transform:scale(0.95)}
.or-divider{display:flex;align-items:center;gap:12px;margin:18px 0 14px;color:var(--ink-soft)}
.or-divider::before,.or-divider::after{content:'';flex:1;height:1px;background:var(--line)}
.or-divider span{font-family:var(--body);font-size:13px;flex-shrink:0}

/* Inputs */
input[type=text],textarea{width:100%;padding:14px 18px;border:1.5px solid var(--line);
  border-radius:16px;font-family:var(--body);font-size:15px;color:var(--ink);
  background:var(--paper);outline:none;resize:vertical;
  transition:border-color 0.2s,box-shadow 0.2s}
input[type=text]:focus,textarea:focus{border-color:var(--accent);
  box-shadow:0 0 0 3px rgba(222,140,87,0.12)}
textarea{min-height:110px}

/* Tabs */
.tabs{display:flex;gap:8px;margin-bottom:22px;flex-wrap:wrap}
.tab{padding:10px 16px;border-radius:999px;font-size:13px;cursor:pointer;
  background:var(--paper);border:1.5px solid var(--line);font-family:var(--body);
  color:var(--ink-soft);transition:all 0.2s;white-space:nowrap;
  display:inline-flex;align-items:center;gap:5px}
.tab svg{vertical-align:middle;flex-shrink:0}
.tab.active{background:var(--accent);color:#fff;border-color:var(--accent);
  box-shadow:0 6px 16px rgba(222,140,87,0.3)}

/* Modality cards (matches app modalityBtn) */
.mod-btn{display:flex;align-items:center;padding:22px 20px;border-radius:22px;
  background:var(--paper);border:1.5px solid var(--line);margin-bottom:16px;
  cursor:pointer;transition:transform 0.15s;-webkit-tap-highlight-color:transparent}
.mod-btn:active{transform:scale(0.98)}
.mod-btn.rec{border-color:var(--accent)}
.mod-icon{width:54px;height:54px;border-radius:16px;display:flex;
  align-items:center;justify-content:center;margin-right:18px;flex-shrink:0}
.mod-text{flex:1;min-width:0}
.mod-label{font-family:var(--head);font-size:17px;color:var(--ink)}
.mod-sub{font-family:var(--body);font-size:13px;color:var(--ink-soft);margin-top:3px}
.mod-badge{padding:5px 10px;border-radius:999px;font-family:var(--head);
  font-size:12px;color:var(--accent);flex-shrink:0;margin-left:8px}

/* Capture */
.capture-area{min-height:280px;border:2px dashed rgba(58,51,43,0.18);border-radius:24px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:10px;padding:28px;color:var(--ink);cursor:pointer;
  background:var(--tone-soft);position:relative;overflow:hidden;
  -webkit-tap-highlight-color:transparent}
.capture-icon{color:var(--ink);opacity:0.7}
.capture-text{font-size:16px;font-family:var(--body);font-weight:600}
.preview-wrap{text-align:center}
.preview-wrap img,.preview-wrap video{border-radius:20px;max-width:100%;max-height:300px}
/* Multi-photo grid (matches app multi-select) */
.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.photo-thumb{position:relative;aspect-ratio:1;border-radius:16px;overflow:hidden;
  border:1.5px solid var(--line)}
.photo-thumb img{width:100%;height:100%;object-fit:cover;display:block;border-radius:0;max-height:none}
.photo-rm{position:absolute;top:5px;right:5px;width:24px;height:24px;border-radius:12px;
  background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;
  font-size:18px;line-height:1;cursor:pointer}
.photo-add{aspect-ratio:1;border-radius:16px;border:2px dashed rgba(58,51,43,0.25);
  display:flex;align-items:center;justify-content:center;font-size:34px;color:var(--ink-soft);
  cursor:pointer;background:var(--tone-soft);-webkit-tap-highlight-color:transparent}
.photo-count{margin-top:12px;font-family:var(--body);font-size:13px;color:var(--ink-soft)}
.card-btn{display:block;width:100%;padding:16px;border:none;border-radius:999px;
  font-family:var(--head);font-size:17px;cursor:pointer;text-align:center;
  transition:transform 0.15s,opacity 0.15s}
.card-btn:active{transform:scale(0.97);opacity:0.85}
.card-btn-primary{background:var(--accent);color:#fff;margin-top:24px;
  box-shadow:0 10px 24px rgba(222,140,87,0.35)}
.card-btn-secondary{background:var(--sand);color:var(--ink);margin-top:12px}

/* Audio */
.audio-controls{display:flex;flex-direction:column;align-items:center;
  padding:30px 0 10px}
.audio-bars{display:flex;align-items:flex-end;height:64px;gap:4px}
.audio-bar{width:4px;border-radius:4px;background:var(--accent);transition:height 0.3s,opacity 0.3s}
.rec-time{font-family:monospace;font-size:30px;color:var(--ink);letter-spacing:1px;
  margin-top:26px}
.rec-btn{width:74px;height:74px;border-radius:50%;border:none;
  background:var(--accent);cursor:pointer;display:flex;align-items:center;
  justify-content:center;margin-top:20px;
  box-shadow:0 8px 24px rgba(222,140,87,0.35);
  -webkit-tap-highlight-color:transparent}
.rec-btn:active{transform:scale(0.93)}
.rec-btn.recording{background:#E74C3C;box-shadow:0 8px 24px rgba(231,76,60,0.4)}
.rec-hint{font-size:12px;color:var(--ink-soft);margin-top:12px;text-align:center}
.rec-done-row{display:flex;align-items:center;justify-content:center;gap:14px;
  margin-top:20px}
.rec-pill{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;
  border-radius:999px;border:none;font-family:var(--head);font-size:15px;
  cursor:pointer;-webkit-tap-highlight-color:transparent}
.rec-pill:active{transform:scale(0.95)}
.rec-pill-primary{background:var(--accent);color:#fff;min-width:110px;justify-content:center}
.rec-pill-secondary{background:var(--paper);color:var(--ink);border:1px solid var(--line);min-width:110px;justify-content:center}
.rec-pill svg{flex-shrink:0}

/* Section labels (matches app sectionLabel) */
.sec-label{display:flex;align-items:center;gap:7px;margin-top:24px;margin-bottom:10px;
  font-family:var(--body);font-size:13px;color:var(--ink-soft)}
.sec-label-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;
  color:var(--accent)}
/* Place chips */
.place-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.place-chip{padding:8px 13px;border-radius:999px;border:1px solid var(--line);
  background:var(--paper);font-family:var(--body);font-size:13px;color:var(--ink);
  cursor:pointer;transition:all 0.15s;-webkit-tap-highlight-color:transparent}
.place-chip.active{background:var(--accent);border-color:var(--accent);color:#FFFDF7}
.place-chip:active{transform:scale(0.95)}
/* Text starter chips — matches app RecordFlow starter chips */
.starter-hint{font-family:var(--body);font-size:13px;color:var(--ink-soft);margin-bottom:9px;padding-left:2px}
.starter-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.starter-chip{padding:9px 13px;border-radius:14px;border:1px solid var(--line);
  background:var(--paper);font-family:var(--body);font-size:13.5px;line-height:18px;color:var(--ink);
  cursor:pointer;transition:transform 0.15s;-webkit-tap-highlight-color:transparent}
.starter-chip:active{transform:scale(0.97)}

.capture-alt{display:inline-block;font-family:var(--body);font-size:13px;color:var(--ink-soft);
  text-align:center;padding:10px 0;cursor:pointer;-webkit-tap-highlight-color:transparent;
  text-decoration:underline;text-underline-offset:3px}

/* Action sheet */
.sheet-mask{position:fixed;inset:0;background:rgba(0,0,0,0.25);z-index:100;
  display:flex;align-items:flex-end;justify-content:center;
  animation:sheetFadeIn 0.2s ease}
@keyframes sheetFadeIn{from{opacity:0}to{opacity:1}}
.sheet-body{width:100%;max-width:480px;padding:0 12px 12px;
  animation:sheetSlideUp 0.25s ease}
@keyframes sheetSlideUp{from{transform:translateY(40px)}to{transform:translateY(0)}}
.sheet-group{background:var(--paper);border-radius:16px;overflow:hidden}
.sheet-btn{display:block;width:100%;padding:16px;border:none;background:none;
  font-family:var(--body);font-size:17px;color:var(--accent);cursor:pointer;
  text-align:center;-webkit-tap-highlight-color:transparent}
.sheet-btn:active{background:var(--sand)}
.sheet-btn+.sheet-btn{border-top:1px solid var(--line)}
.sheet-cancel{margin-top:8px;background:var(--paper);border-radius:16px}
.sheet-cancel .sheet-btn{font-family:var(--head);color:var(--ink)}

/* Loader */
.loader-wrap{display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding-top:38vh}
.loader-dots{display:flex;gap:8px;margin-bottom:28px}
.loader-dots span{width:8px;height:8px;border-radius:50%;
  background:var(--accent);opacity:0.25;animation:dotPulse 1.2s ease-in-out infinite}
.loader-dots span:nth-child(2){animation-delay:0.2s}
.loader-dots span:nth-child(3){animation-delay:0.4s}
@keyframes dotPulse{0%,100%{opacity:0.2;transform:scale(0.85)}
  50%{opacity:1;transform:scale(1.15)}}
.loader-file{font-family:var(--body);font-size:14px;color:var(--ink-soft);
  text-align:center;line-height:1.6}

/* Done — memory detail style */
#s-done{padding:0;position:relative}
.done-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 26px 60px}
.done-hero{width:100%;height:34vh;min-height:220px;border-radius:var(--r);
  overflow:hidden;position:relative;
  display:flex;align-items:center;justify-content:center;
  border:1px solid var(--line);margin-top:12px;
  box-shadow:0 10px 30px rgba(58,51,43,0.16)}
.done-hero img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
.done-hero video{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
.done-hero .hero-icon{font-size:80px;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.1))}
.done-hero .hero-badge{position:absolute;left:14px;top:14px;display:flex;align-items:center;gap:6px;
  padding:5px 11px;border-radius:999px;background:rgba(255,253,247,0.86);
  font-family:var(--head);font-size:12px;color:var(--accent)}
.done-hero .hero-badge-dot{width:7px;height:7px;border-radius:50%;background:var(--accent)}
.done-body{padding:24px 2px 0}
.done-seq{display:inline-block;padding:5px 11px;border-radius:999px;background:var(--tone-soft);
  font-family:var(--head);font-size:13px;color:var(--accent-ink)}
.done-title{font-family:var(--head);font-size:28px;line-height:39px;
  color:var(--ink);margin-top:16px}
.done-caption-wrap{position:relative;margin-top:22px;padding-top:8px}
.done-quote{position:absolute;top:-14px;left:-6px;
  font-family:var(--head);font-size:64px;color:var(--tone-soft);line-height:64px}
.done-caption{font-family:var(--hand);font-size:24px;line-height:47px;color:var(--ink)}
.done-meta{margin-top:28px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.done-meta span{font-family:var(--body);font-size:14px;color:var(--ink-soft)}
.done-meta .dot{opacity:0.4}
.done-brand{margin-top:40px;text-align:center}
.brand{font-family:var(--head);font-size:12px;color:var(--accent);
  letter-spacing:1.5px;opacity:0.8}
@keyframes celebPop{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}

/* Error */
.error-msg{color:#c0392b;font-size:14px;margin-top:12px;text-align:center}

@media(max-width:380px){
  .card{padding:22px 18px}
  .land-title{font-size:26px;line-height:36px}
  .hero{min-height:180px}
  .kicker-body{font-size:15px;line-height:30px}
}
</style>
</head>
<body>

<!-- ═══════ Screen: Landing (matches app LevelDetail) ═══════ -->
<div id="s-landing" class="screen active">
  <div class="land-scroll">
    <!-- Hero -->
    <div class="hero" id="heroArea">
      <img class="hero-img hidden" id="heroImg" alt="">
      <div class="hero-icon" id="heroIcon">📖</div>
      <div class="hero-badge"><div class="hero-badge-dot"></div>一百件事</div>
    </div>

    <!-- Title -->
    <h1 class="land-title" id="levelTitle"></h1>

    <!-- Inviter line -->
    <div class="invite-line" id="inviterLine"></div>

    <!-- Section: Why -->
    <div id="levelWhy" class="kicker hidden">
      <div class="kicker-row">
        <div class="kicker-dot"></div>
        <span class="kicker-label">为什么值得做</span>
      </div>
      <div class="kicker-body" id="levelWhyText"></div>
    </div>

    <!-- Section: How -->
    <div id="levelHow" class="kicker hidden">
      <div class="kicker-row">
        <div class="kicker-dot"></div>
        <span class="kicker-label">可以怎么做</span>
      </div>
      <div class="kicker-body" id="levelHowText"></div>
    </div>

    <!-- Section: Record -->
    <div id="levelRecord" class="kicker hidden">
      <div class="kicker-row">
        <div class="kicker-dot"></div>
        <span class="kicker-label">记录些什么</span>
      </div>
      <div class="kicker-body" id="levelRecordText"></div>
    </div>

    <!-- Suggest chip -->
    <div class="suggest-card" id="suggestCard" class="hidden">
      <div class="suggest-icon" id="suggestIcon"></div>
      <div class="suggest-text">
        <div class="suggest-label">这一关最适合</div>
        <div class="suggest-value" id="suggestValue"></div>
      </div>
    </div>
  </div>

  <!-- Sticky bottom bar (matches app) -->
  <div class="bottom-bar" id="landingBar">
    <div class="bottom-bar-inner">
      <div class="bottom-fade"></div>
      <div class="bottom-buttons">
        <button class="btn btn-primary" onclick="goTo('s-identity')">开始记录</button>
      </div>
    </div>
  </div>

  <div id="landingError" class="error-msg hidden"></div>
</div>

<!-- ═══════ Screen: Identity ═══════ -->
<div id="s-identity" class="screen inner-screen">
  <div class="top-bar">
    <div class="back-btn" onclick="goTo('s-landing')">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
    </div>
    <span class="top-bar-title">选择身份</span>
  </div>
  <div class="card">
    <h2>你是谁？</h2>
    <div class="sub" style="margin-bottom:4px">选择你的身份，让记录更有温度</div>
    <div class="roles" id="roleList"></div>
    <div class="or-divider"><span>或</span></div>
    <input type="text" id="customRole" placeholder="输入你的称呼">
    <button class="card-btn card-btn-primary" onclick="confirmIdentity()">下一步</button>
  </div>
</div>

<!-- ═══════ Screen: Choose modality (matches app RecordFlow step 0) ═══════ -->
<div id="s-capture" class="screen inner-screen">
  <div class="top-bar">
    <div class="back-btn" onclick="goTo('s-identity')">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
    </div>
    <span class="top-bar-title">记录一下</span>
  </div>
  <div style="padding:14px 8px 40px">
    <h2 id="capTitle" style="font-size:21px;margin-bottom:8px"></h2>
    <div class="sub" id="capRecord" style="margin-bottom:28px;font-size:14px;line-height:24px"></div>
    <div id="modalityList"></div>
  </div>
</div>

<!-- ═══════ Screen: Capture + details (matches app RecordFlow step 1) ═══════ -->
<div id="s-record" class="screen" style="padding:0">
  <div class="top-bar" style="margin:8px 16px 0;flex-shrink:0">
    <div class="back-btn" onclick="backFromRecord()">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
    </div>
    <span class="top-bar-title" id="recordTopTitle">记录一下</span>
  </div>
  <div style="flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 24px 130px">
    <!-- Capture area -->
    <div id="capturePhoto" class="hidden">
      <div class="capture-area" id="photoArea" onclick="showPhotoSheet()">
        <div class="capture-icon" id="photoIcon"></div>
        <div class="capture-text">轻点拍照或选择照片</div>
      </div>
      <input type="file" accept="image/*" capture="environment" id="photoInput" class="hidden">
      <input type="file" accept="image/*" multiple id="galleryInput" class="hidden">
    </div>
    <div id="captureVideo" class="hidden">
      <div class="capture-area" id="videoArea" onclick="showVideoSheet()">
        <div class="capture-icon" id="videoIcon"></div>
        <div class="capture-text">轻点录像</div>
      </div>
      <input type="file" accept="video/*" capture="environment" id="videoInput" class="hidden">
      <input type="file" accept="video/*" id="videoGalleryInput" class="hidden">
    </div>
    <div id="captureAudio" class="hidden">
      <div class="audio-controls">
        <div class="audio-bars" id="audioBars"></div>
        <div class="rec-time" id="recTime">0:00</div>
      </div>
      <!-- Ready state -->
      <div id="recReady" style="display:flex;flex-direction:column;align-items:center">
        <button class="rec-btn" onclick="startRecording()">
          <span id="recMicIcon"></span>
        </button>
        <div class="rec-hint">准备好了就开始 · 轻点录音</div>
      </div>
      <!-- Recording state -->
      <div id="recActive" style="display:none;flex-direction:column;align-items:center">
        <button class="rec-btn" onclick="stopRecording()">
          <div style="width:26px;height:26px;border-radius:5px;background:#FFFDF7"></div>
        </button>
        <div class="rec-hint">正在录音 · 轻点结束</div>
      </div>
      <!-- Done state -->
      <div id="recDone" style="display:none;text-align:center">
        <div class="rec-done-row">
          <button class="rec-pill rec-pill-primary" id="playBtn" onclick="togglePlayback()">
            <span id="playIcon"></span>
            <span id="playLabel">播放</span>
          </button>
          <button class="rec-pill rec-pill-secondary" onclick="reRecord()">
            <span id="rerecIcon"></span>
            重录
          </button>
        </div>
        <div class="rec-hint">听一听 · 不满意可以重录</div>
        <audio id="audioPlayback" class="hidden"></audio>
      </div>
    </div>
    <div id="captureText" class="hidden">
      <div id="textStarters" class="hidden">
        <div class="starter-hint">不知从哪写起？轻点一句，帮你起个头</div>
        <div class="starter-chips" id="starterChips"></div>
      </div>
      <textarea id="textContent" placeholder="写下你想说的..." maxlength="10000" style="min-height:180px"></textarea>
    </div>
    <div id="capturePreview" class="preview-wrap hidden"></div>
    <div class="hidden" id="recaptureWrap" style="text-align:center;margin-top:10px">
      <span class="capture-alt" onclick="resetCapture()">重新选择</span>
    </div>

    <!-- Caption (photo/video only) -->
    <div id="captionSection" class="hidden">
      <div class="sec-label">
        <div class="sec-label-icon" id="captionIcon"></div>
        <span>配一句话</span>
      </div>
      <textarea id="captionInput" placeholder="这一刻的感受..." maxlength="300" style="min-height:70px"></textarea>
    </div>

    <!-- Place -->
    <div class="sec-label" style="margin-top:24px">
      <div class="sec-label-icon" id="placeIcon"></div>
      <span>在哪儿？</span>
    </div>
    <input type="text" id="placeInput" placeholder="输入地点" maxlength="40">
    <div class="place-chips" id="placeChips"></div>
  </div>

  <!-- Sticky bottom submit -->
  <div class="bottom-bar" id="recordBar">
    <div class="bottom-bar-inner">
      <div class="bottom-fade"></div>
      <div class="bottom-buttons">
        <button class="btn btn-primary" id="submitBtn" onclick="submitRecord()">就这样，收好它</button>
      </div>
    </div>
  </div>
</div>

<!-- ═══════ Screen: Submitting ═══════ -->
<div id="s-submitting" class="screen inner-screen">
  <div class="loader-wrap">
    <div class="loader-dots"><span></span><span></span><span></span></div>
    <div class="loader-file" id="loaderFile"></div>
  </div>
</div>

<!-- ═══════ Screen: Done (memory detail) ═══════ -->
<div id="s-done" class="screen">
  <div class="done-scroll">
    <div class="done-hero" id="doneHero">
      <div class="hero-icon" id="doneHeroIcon">📖</div>
      <div class="hero-badge"><div class="hero-badge-dot"></div>一百件事</div>
    </div>
    <div class="done-body">
      <div class="done-seq" id="doneSeq"></div>
      <div class="done-title" id="doneTitle"></div>
      <div class="done-caption-wrap" id="doneCaptionWrap" style="display:none">
        <span class="done-quote">"</span>
        <div class="done-caption" id="doneCaption"></div>
      </div>
      <div class="done-meta" id="doneMeta"></div>
      <div class="done-brand"><div class="brand">—— 一百件事 ——</div></div>
    </div>
  </div>
</div>

<!-- ═══════ Screen: Error ═══════ -->
<div id="s-error" class="screen inner-screen">
  <div class="card" style="text-align:center;padding:40px 24px;margin-top:20vh">
    <div style="font-size:52px;margin-bottom:20px">😔</div>
    <h2 id="errorTitle">链接已失效</h2>
    <div class="sub" id="errorDesc" style="margin-top:8px">这个邀请链接已过期或已被停用</div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script>
const TOKEN = '${token}'
const API = '${apiBase}'
const SB_URL = '${realtimeUrl}'
const SB_KEY = '${anonKey}'

// Realtime broadcast
let _channel = null
let _ready = false
let _queue = []
function initBroadcast() {
  try {
    if (!SB_URL || !SB_KEY) return
    const sb = supabase.createClient(SB_URL, SB_KEY)
    _channel = sb.channel('invite:' + TOKEN)
    _channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        _ready = true
        _queue.forEach(s => {
          const payload = { status: s, token: TOKEN }
          if (s === 'done' && state.memoryId) payload.memoryId = state.memoryId
          _channel.send({ type: 'broadcast', event: 'status', payload })
        })
        _queue = []
      }
    })
  } catch(e) { console.warn('broadcast init:', e) }
}
function broadcast(s) {
  try {
    if (_ready && _channel) {
      const payload = { status: s, token: TOKEN }
      if (s === 'done' && state.memoryId) payload.memoryId = state.memoryId
      _channel.send({ type: 'broadcast', event: 'status', payload })
    } else {
      _queue.push(s)
    }
  } catch {}
}
initBroadcast()
let _lastStatus = ''
const _origBroadcast = broadcast
broadcast = function(s) { _lastStatus = s; _origBroadcast(s) }
document.addEventListener('visibilitychange', () => {
  // Do not downgrade to waiting when the browser is hidden/closed: once opened,
  // the app should keep treating this QR code as already used.
  if (!document.hidden && (!_lastStatus || _lastStatus === 'waiting')) broadcast('viewed')
})
const ROLES = ['妈妈','爸爸','爷爷','奶奶','外公','外婆']
const TONE_MAP = {
  orange: {soft:'#F4D9BE',deep:'#DE8C57'},
  green: {soft:'#D6E0CE',deep:'#5E7C61'},
  pink: {soft:'#F0D6D6',deep:'#D2929A'},
}
const TONE_INK = {
  orange: '#7A4A24',
  green: '#395239',
  pink: '#7C4248',
}
const SVG_ICONS = {
  mic: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>',
  camera: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  video: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="14" rx="2"/><path d="M16 10l6-3v10l-6-3"/></svg>',
  pen: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="M15 5l4 4"/></svg>',
}
const SUG_MAP = {
  voice: {icon:'mic',label:'用语音录下来'},
  photo: {icon:'camera',label:'拍一张照片'},
  video: {icon:'video',label:'录一段视频'},
  text:  {icon:'pen',label:'写下来'},
}

let state = {
  info: null,
  role: '',
  type: 'photo',
  file: null,
  photos: [],
  audioBlob: null,
  textContent: '',
  memoryId: crypto.randomUUID(),
}

// ── Init ──
async function init() {
  initAudioBars()
  try {
    const res = await fetch(API + '/info/' + TOKEN)
    const data = await res.json()
    if (data.error) {
      const msgs = {
        expired_token: '这个邀请链接已过期',
        inactive_token: '这个邀请链接已被停用',
        invalid_token: '无效的邀请链接',
      }
      document.getElementById('errorTitle').textContent = '无法打开'
      document.getElementById('errorDesc').textContent = msgs[data.error] || '链接无效'
      goTo('s-error')
      return
    }
    state.info = data
    document.getElementById('levelTitle').textContent = data.levelTitle

    // Inviter line
    const inv = document.getElementById('inviterLine')
    if (data.inviterRole) {
      inv.textContent = data.inviterRole + ' 邀请你一起记录'
    } else {
      inv.textContent = '有人邀请你一起记录'
    }
    if (data.kidName) {
      inv.textContent += ' · 关于 ' + data.kidName
    }

    if (data.levelWhy) {
      document.getElementById('levelWhy').classList.remove('hidden')
      document.getElementById('levelWhyText').textContent = data.levelWhy
    }
    if (data.levelHow) {
      document.getElementById('levelHow').classList.remove('hidden')
      document.getElementById('levelHowText').textContent = data.levelHow
    }
    if (data.levelRecord) {
      document.getElementById('levelRecord').classList.remove('hidden')
      document.getElementById('levelRecordText').textContent = data.levelRecord
    }
    state.type = data.levelSuggest || 'photo'

    // Tone colors
    const tn = TONE_MAP[data.levelTone] || TONE_MAP.orange
    document.documentElement.style.setProperty('--tone-soft', tn.soft)
    document.documentElement.style.setProperty('--tone-deep', tn.deep)
    document.getElementById('heroArea').style.background = tn.soft

    // Illustration: show real image if available, hide emoji fallback
    if (data.illustrationUrl) {
      const img = document.getElementById('heroImg')
      img.onload = () => {
        img.classList.remove('hidden')
        document.getElementById('heroIcon').style.display = 'none'
      }
      img.src = data.illustrationUrl
    }

    // Suggest chip
    const sug = SUG_MAP[data.levelSuggest]
    if (sug) {
      const card = document.getElementById('suggestCard')
      card.style.display = 'flex'
      const iconEl = document.getElementById('suggestIcon')
      iconEl.innerHTML = SVG_ICONS[sug.icon] || ''
      iconEl.style.background = tn.soft
      iconEl.style.color = TONE_INK[data.levelTone] || TONE_INK.orange
      document.getElementById('suggestValue').textContent = sug.label
    } else {
      document.getElementById('suggestCard').style.display = 'none'
    }
    broadcast('viewed')
  } catch (e) {
    document.getElementById('errorDesc').textContent = '网络错误，请稍后重试'
    goTo('s-error')
  }
}

function goTo(screenId) {
  // Show/hide sticky bottom bars
  document.getElementById('landingBar').style.display = screenId === 's-landing' ? 'flex' : 'none'
  document.getElementById('recordBar').style.display = screenId === 's-record' ? 'flex' : 'none'

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(screenId).classList.add('active')
  if (screenId === 's-identity') setupRoles()
  if (screenId === 's-capture') setupModality()
  if (screenId === 's-record') { showCapturePanel(); updateSubmitBtn() }
  window.scrollTo({top:0, behavior:'smooth'})
}

// ── Identity ──
function setupRoles() {
  const list = document.getElementById('roleList')
  const input = document.getElementById('customRole')
  list.innerHTML = ''
  ROLES.forEach(r => {
    const el = document.createElement('div')
    el.className = 'role' + (state.role === r ? ' active' : '')
    el.textContent = r
    el.onclick = () => {
      document.querySelectorAll('.role').forEach(x => x.classList.remove('active'))
      el.classList.add('active')
      state.role = r
      input.value = r
      updateIdentityBtn()
    }
    list.appendChild(el)
  })
  input.oninput = function() {
    const v = this.value.trim()
    document.querySelectorAll('.role').forEach(x => x.classList.remove('active'))
    if (v) {
      document.querySelectorAll('.role').forEach(x => {
        if (x.textContent === v) x.classList.add('active')
      })
      state.role = v
    } else {
      state.role = ''
    }
    updateIdentityBtn()
  }
  if (state.role) input.value = state.role
  updateIdentityBtn()
}

function updateIdentityBtn() {
  const btn = document.querySelector('#s-identity .card-btn-primary')
  if (state.role) {
    btn.style.opacity = '1'
    btn.style.pointerEvents = 'auto'
  } else {
    btn.style.opacity = '0.4'
    btn.style.pointerEvents = 'none'
  }
}

function confirmIdentity() {
  if (!state.role) return
  broadcast('recording')
  goTo('s-capture')
}

// ── Capture ──
const TYPES = [
  { key: 'voice', icon: 'mic', label: '录一段语音', sub: '最省事，最珍贵' },
  { key: 'photo', icon: 'camera', label: '拍/选一张照片', sub: '留住此刻的样子' },
  { key: 'video', icon: 'video', label: '拍/选一段视频', sub: '连声音和动作一起留住' },
  { key: 'text',  icon: 'pen', label: '写几句话', sub: '安静地写下来' },
]
const TYPE_TOP_TITLE = {voice:'录音',photo:'拍照',video:'录像',text:'写字'}

let mediaRecorder = null
let audioChunks = []
let recTimer = null
let recSeconds = 0

function setupModality() {
  const info = state.info || {}
  document.getElementById('capTitle').textContent = info.levelTitle || ''
  document.getElementById('capRecord').textContent = info.levelRecord || ''
  const list = document.getElementById('modalityList')
  list.innerHTML = ''
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  const tn = TONE_MAP[info.levelTone] || TONE_MAP.orange
  const tnInk = TONE_INK[info.levelTone] || TONE_INK.orange
  const suggest = info.levelSuggest || 'photo'
  // Map browser type keys: voice→audio for capture panel
  TYPES.forEach(ty => {
    if (ty.key === 'voice' && !canRecord) return
    const isRec = (ty.key === suggest) || (ty.key === 'voice' && suggest === 'voice') || (ty.key === 'photo' && suggest === 'photo')
    const realRec = ty.key === suggest
    const btn = document.createElement('div')
    btn.className = 'mod-btn' + (realRec ? ' rec' : '')
    const iconBg = realRec ? 'var(--accent)' : tn.soft
    const iconColor = realRec ? '#FFFDF7' : tnInk
    btn.innerHTML =
      '<div class="mod-icon" style="background:' + iconBg + ';color:' + iconColor + '">' +
        SVG_ICONS[ty.icon] +
      '</div>' +
      '<div class="mod-text">' +
        '<div class="mod-label">' + ty.label + '</div>' +
        '<div class="mod-sub">' + ty.sub + '</div>' +
      '</div>' +
      (realRec ? '<div class="mod-badge" style="background:' + tn.soft + '">推荐</div>' : '')
    btn.onclick = () => startCapture(ty.key)
    list.appendChild(btn)
  })
}

function startCapture(key) {
  // voice maps to audio capture panel
  state.type = key === 'voice' ? 'audio' : key
  document.getElementById('recordTopTitle').textContent = TYPE_TOP_TITLE[key] || '记录'
  goTo('s-record')
}

function showCapturePanel() {
  ['capturePhoto','captureVideo','captureAudio','captureText','capturePreview'].forEach(id =>
    document.getElementById(id).classList.add('hidden'))
  document.getElementById('recaptureWrap').classList.add('hidden')

  const panel = 'capture' + state.type.charAt(0).toUpperCase() + state.type.slice(1)
  document.getElementById(panel).classList.remove('hidden')

  // Text input updates submit button + toggles starter chips
  document.getElementById('textContent').oninput = function() { updateSubmitBtn(); toggleStarters() }

  // Text starter chips (normal memory only — web invites are never sealed)
  setupTextStarters()

  // Show caption section for photo/video, hide for audio/text
  const cs = document.getElementById('captionSection')
  if (state.type === 'photo' || state.type === 'video') {
    cs.classList.remove('hidden')
  } else {
    cs.classList.add('hidden')
  }

  // Set SVG icons
  const penSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="M15 5l4 4"/></svg>'
  const pinSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'
  document.getElementById('captionIcon').innerHTML = penSvg
  document.getElementById('placeIcon').innerHTML = pinSvg

  // Place chips
  setupPlaceChips()

  // Set capture area icons
  const camSvg = SVG_ICONS.camera.replace(/width="22"/g,'width="30"').replace(/height="22"/g,'height="30"')
  const vidSvg = SVG_ICONS.video.replace(/width="22"/g,'width="28"').replace(/height="22"/g,'height="28"')
  document.getElementById('photoIcon').innerHTML = camSvg
  document.getElementById('videoIcon').innerHTML = vidSvg

  // Audio icons
  const micWhite = SVG_ICONS.mic.replace(/stroke="currentColor"/g,'stroke="#FFFDF7"').replace(/width="22"/g,'width="32"').replace(/height="22"/g,'height="32"')
  document.getElementById('recMicIcon').innerHTML = micWhite
  const playSvg = '<svg width="13" height="16" viewBox="0 0 13 16" fill="#fff"><path d="M0 0l13 8-13 8z"/></svg>'
  document.getElementById('playIcon').innerHTML = playSvg
  const micSmall = SVG_ICONS.mic.replace(/width="22"/g,'width="16"').replace(/height="22"/g,'height="16"')
  document.getElementById('rerecIcon').innerHTML = micSmall
  showRecState('ready')
}

function backFromRecord() {
  resetCapture()
  goTo('s-capture')
}

function initAudioBars() {
  const container = document.getElementById('audioBars')
  if (!container) return
  const heights = [14,28,20,40,26,52,34,46,22,38,30,50,24,44,18,36,28,48,20,32,16]
  heights.forEach(h => {
    const bar = document.createElement('div')
    bar.className = 'audio-bar'
    bar.style.height = (h * 0.45) + 'px'
    bar.style.opacity = '0.3'
    bar.dataset.base = h
    container.appendChild(bar)
  })
}

function animateBars(active) {
  const bars = document.querySelectorAll('.audio-bar')
  bars.forEach((bar, i) => {
    const base = parseInt(bar.dataset.base)
    if (active) {
      bar.style.height = (base * (0.55 + 0.45 * Math.abs(Math.sin((recSeconds + i) * 0.9)))) + 'px'
      bar.style.opacity = '0.85'
    } else {
      bar.style.height = (base * 0.45) + 'px'
      bar.style.opacity = '0.3'
    }
  })
}

// Place chips
const PLACES = ['家里','小区楼下','公园','幼儿园','路上']
// App RecordFlow normalStarter1..4 — tap to seed the opening line
const NORMAL_STARTERS = ['今天，我们一起','我永远会记得那一刻——','TA 听完之后，','最让我心头一软的是']
function setupTextStarters() {
  const container = document.getElementById('starterChips')
  const input = document.getElementById('textContent')
  container.innerHTML = ''
  NORMAL_STARTERS.forEach(s => {
    const chip = document.createElement('div')
    chip.className = 'starter-chip'
    chip.textContent = s
    chip.onclick = () => {
      input.value = s
      input.focus()
      updateSubmitBtn()
      toggleStarters()
    }
    container.appendChild(chip)
  })
  toggleStarters()
}
function toggleStarters() {
  const wrap = document.getElementById('textStarters')
  const input = document.getElementById('textContent')
  wrap.classList.toggle('hidden', input.value.trim().length > 0)
}
function setupPlaceChips() {
  const container = document.getElementById('placeChips')
  const input = document.getElementById('placeInput')
  container.innerHTML = ''
  PLACES.forEach(p => {
    const chip = document.createElement('div')
    chip.className = 'place-chip' + (input.value === p ? ' active' : '')
    chip.textContent = p
    chip.onclick = () => {
      input.value = p
      container.querySelectorAll('.place-chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
    }
    container.appendChild(chip)
  })
  input.oninput = function() {
    container.querySelectorAll('.place-chip').forEach(c => {
      c.classList.toggle('active', c.textContent === this.value)
    })
  }
}

// Action sheets
function showActionSheet(options) {
  const mask = document.createElement('div')
  mask.className = 'sheet-mask'
  const body = document.createElement('div')
  body.className = 'sheet-body'
  const group = document.createElement('div')
  group.className = 'sheet-group'
  options.forEach(opt => {
    const btn = document.createElement('button')
    btn.className = 'sheet-btn'
    btn.textContent = opt.label
    btn.onclick = () => { mask.remove(); opt.action() }
    group.appendChild(btn)
  })
  body.appendChild(group)
  const cancel = document.createElement('div')
  cancel.className = 'sheet-cancel'
  const cancelBtn = document.createElement('button')
  cancelBtn.className = 'sheet-btn'
  cancelBtn.textContent = '取消'
  cancelBtn.onclick = () => mask.remove()
  cancel.appendChild(cancelBtn)
  body.appendChild(cancel)
  mask.onclick = (e) => { if (e.target === mask) mask.remove() }
  mask.appendChild(body)
  document.body.appendChild(mask)
}

function showPhotoSheet() {
  showActionSheet([
    { label: '拍照', action: () => document.getElementById('photoInput').click() },
    { label: '从相册选择', action: () => document.getElementById('galleryInput').click() },
  ])
}

function showVideoSheet() {
  showActionSheet([
    { label: '拍摄视频', action: () => document.getElementById('videoInput').click() },
    { label: '从相册选择', action: () => document.getElementById('videoGalleryInput').click() },
  ])
}

// Max photos per record — keep in sync with app RecordFlow MAX_SHOTS
const MAX_SHOTS = 6

// Cache one object URL per File so re-renders don't leak
function photoUrl(f) { if (!f._url) f._url = URL.createObjectURL(f); return f._url }

// Camera (single) and album (multiple) both append into state.photos
document.getElementById('photoInput').onchange =
document.getElementById('galleryInput').onchange = function(e) {
  const picked = Array.from(e.target.files || [])
  e.target.value = '' // allow re-picking the same file / reopening
  if (!picked.length) return
  const room = MAX_SHOTS - state.photos.length
  state.photos = state.photos.concat(picked.slice(0, Math.max(0, room)))
  renderPhotoGrid()
}

function renderPhotoGrid() {
  const preview = document.getElementById('capturePreview')
  if (!state.photos.length) {
    preview.innerHTML = ''
    preview.classList.add('hidden')
    document.getElementById('capturePhoto').classList.remove('hidden')
    updateSubmitBtn()
    return
  }
  const tiles = state.photos.map((f, i) =>
    '<div class="photo-thumb"><img src="' + photoUrl(f) + '">' +
    '<div class="photo-rm" onclick="removePhoto(' + i + ')">&times;</div></div>'
  )
  if (state.photos.length < MAX_SHOTS) {
    tiles.push('<div class="photo-add" onclick="showPhotoSheet()">+</div>')
  }
  preview.innerHTML = '<div class="photo-grid">' + tiles.join('') + '</div>' +
    '<div class="photo-count">' + state.photos.length + ' / ' + MAX_SHOTS + ' 张</div>'
  preview.classList.remove('hidden')
  document.getElementById('capturePhoto').classList.add('hidden')
  document.getElementById('recaptureWrap').classList.add('hidden')
  updateSubmitBtn()
}

function removePhoto(i) {
  const f = state.photos[i]
  if (f && f._url) { URL.revokeObjectURL(f._url); f._url = null }
  state.photos.splice(i, 1)
  renderPhotoGrid()
}

document.getElementById('videoInput').onchange =
document.getElementById('videoGalleryInput').onchange = function(e) {
  const file = e.target.files[0]
  if (!file) return
  state.file = file
  const preview = document.getElementById('capturePreview')
  const url = URL.createObjectURL(file)
  preview.innerHTML = '<div style="width:100%;height:280px;border-radius:24px;overflow:hidden;border:2px solid var(--accent);background:#1a1a1a"><video src="' + url + '" controls style="width:100%;height:100%;object-fit:cover"></video></div>'
  preview.classList.remove('hidden')
  document.getElementById('captureVideo').classList.add('hidden')
  document.getElementById('recaptureWrap').classList.remove('hidden')
  updateSubmitBtn()
}

let audioPlaybackUrl = null

function showRecState(s) {
  const ready = document.getElementById('recReady')
  const active = document.getElementById('recActive')
  const done = document.getElementById('recDone')
  ready.style.display = s === 'ready' ? 'flex' : 'none'
  active.style.display = s === 'active' ? 'flex' : 'none'
  done.style.display = s === 'done' ? 'block' : 'none'
}

function startRecording() {
  audioChunks = []
  recSeconds = 0
  document.getElementById('recTime').textContent = '0:00'
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data) }
    mediaRecorder.onstop = () => {
      clearInterval(recTimer)
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' })
      state.audioBlob = blob
      audioPlaybackUrl = URL.createObjectURL(blob)
      const audio = document.getElementById('audioPlayback')
      audio.src = audioPlaybackUrl
      showRecState('done')
      animateBars(false)
      updateSubmitBtn()
    }
    mediaRecorder.start()
    showRecState('active')
    recTimer = setInterval(() => {
      recSeconds++
      const m = Math.floor(recSeconds / 60)
      const s = recSeconds % 60
      document.getElementById('recTime').textContent = m + ':' + (s < 10 ? '0' : '') + s
      animateBars(true)
    }, 1000)
  }).catch(() => {
    showRecState('ready')
  })
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  }
}

let isAudioPlaying = false
function setPlayingUI(playing) {
  isAudioPlaying = playing
  const label = document.getElementById('playLabel')
  const icon = document.getElementById('playIcon')
  const pauseSvg = '<svg width="13" height="16" viewBox="0 0 13 16" fill="#fff"><rect x="0" y="0" width="4" height="16" rx="1"/><rect x="9" y="0" width="4" height="16" rx="1"/></svg>'
  const playSvg = '<svg width="13" height="16" viewBox="0 0 13 16" fill="#fff"><path d="M0 0l13 8-13 8z"/></svg>'
  icon.innerHTML = playing ? pauseSvg : playSvg
  label.textContent = playing ? '播放中' : '播放'
  document.querySelectorAll('.audio-bar').forEach(bar => {
    bar.style.opacity = playing ? '0.8' : '0.32'
  })
}

function togglePlayback() {
  const audio = document.getElementById('audioPlayback')
  if (isAudioPlaying) {
    audio.pause()
    setPlayingUI(false)
  } else {
    audio.play()
    setPlayingUI(true)
  }
  audio.onended = () => setPlayingUI(false)
}

function reRecord() {
  state.audioBlob = null
  isAudioPlaying = false
  if (audioPlaybackUrl) { URL.revokeObjectURL(audioPlaybackUrl); audioPlaybackUrl = null }
  document.getElementById('audioPlayback').pause()
  recSeconds = 0
  document.getElementById('recTime').textContent = '0:00'
  animateBars(false)
  startRecording()
}

function resetCapture() {
  state.file = null
  state.photos.forEach(f => { if (f._url) URL.revokeObjectURL(f._url) })
  state.photos = []
  state.audioBlob = null
  isAudioPlaying = false
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  }
  if (audioPlaybackUrl) { URL.revokeObjectURL(audioPlaybackUrl); audioPlaybackUrl = null }
  document.getElementById('capturePreview').innerHTML = ''
  document.getElementById('capturePreview').classList.add('hidden')
  document.getElementById('recaptureWrap').classList.add('hidden')
  document.getElementById('recTime').textContent = '0:00'
  recSeconds = 0
  animateBars(false)
  showCapturePanel()
}

function isCaptureReady() {
  if (state.type === 'text') return document.getElementById('textContent').value.trim().length > 0
  if (state.type === 'photo') return state.photos.length > 0
  if (state.type === 'video') return !!state.file
  if (state.type === 'audio') return !!state.audioBlob
  return false
}

function updateSubmitBtn() {
  const btn = document.getElementById('submitBtn')
  if (isCaptureReady()) {
    btn.style.opacity = '1'
    btn.style.pointerEvents = 'auto'
    btn.style.background = 'var(--accent)'
    btn.style.color = '#fff'
  } else {
    btn.style.opacity = '0.6'
    btn.style.pointerEvents = 'none'
    btn.style.background = 'var(--sand)'
    btn.style.color = 'var(--ink-soft)'
  }
}

function fileDesc() {
  if (state.type === 'photo') return state.photos.length + ' 张照片'
  if (state.type === 'video') return '1 段视频'
  if (state.type === 'audio') return '1 段录音'
  return '文字记录'
}

async function submitRecord() {
  if (state.type === 'text') {
    state.textContent = document.getElementById('textContent').value.trim()
    if (!state.textContent) return
  }
  if (state.type === 'photo' && !state.photos.length) return
  if (state.type === 'video' && !state.file) return
  if (state.type === 'audio' && !state.audioBlob) return

  broadcast('uploading')
  goTo('s-submitting')
  const desc = document.getElementById('loaderFile')
  desc.textContent = fileDesc()

  try {
    if (state.type === 'photo') {
      for (let i = 0; i < state.photos.length; i++) {
        await uploadFile(state.photos[i], state.photos[i].type || 'image/jpeg')
      }
    } else if (state.type === 'video') {
      await uploadFile(state.file, state.file.type)
    } else if (state.type === 'audio') {
      const mimeType = state.audioBlob.type || 'audio/webm'
      await uploadFile(state.audioBlob, mimeType)
    }

    const caption = state.type === 'text'
      ? state.textContent
      : (document.getElementById('captionInput').value.trim() || '')
    const place = document.getElementById('placeInput')?.value.trim() || ''

    const submitBody = {
      memoryId: state.memoryId,
      role: state.role,
      type: state.type === 'audio' ? 'voice' : state.type,
      caption,
      place: place || null,
      shots: state.type === 'photo' ? state.photos.length : null,
      duration: state.type === 'audio' ? formatDuration(recSeconds) : null,
    }

    const res = await fetch(API + '/submit/' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitBody),
    })
    const result = await res.json()
    if (result.error) throw new Error(result.error)

    broadcast('done')
    populateDoneScreen()
    setTimeout(() => goTo('s-done'), 400)
  } catch (e) {
    const wrap = document.querySelector('#s-submitting .loader-wrap')
    wrap.innerHTML = '<div style="text-align:center">' +
      '<div style="font-size:44px;margin-bottom:16px">😔</div>' +
      '<div style="font-family:var(--head);font-size:18px;color:var(--ink);margin-bottom:6px">上传失败</div>' +
      '<div class="loader-file">' + (e.message || '请稍后重试') + '</div>' +
      '<button class="btn-primary" style="margin-top:24px;padding:12px 40px;border:none;' +
      'border-radius:14px;font-family:var(--head);font-size:16px;cursor:pointer" ' +
      'onclick="submitRecord()">重试</button></div>'
  }
}

function populateDoneScreen() {
  const info = state.info || {}
  const tn = TONE_MAP[info.levelTone] || TONE_MAP.orange

  // Hero: show captured media or fall back to illustration
  const hero = document.getElementById('doneHero')
  hero.style.background = tn.soft
  const heroIcon = document.getElementById('doneHeroIcon')

  const heroFile = state.type === 'photo' ? state.photos[0]
    : state.type === 'video' ? state.file : null
  if (heroFile) {
    const url = URL.createObjectURL(heroFile)
    if (state.type === 'photo') {
      const img = document.createElement('img')
      img.src = url
      img.onload = () => { heroIcon.style.display = 'none' }
      hero.appendChild(img)
    } else {
      const vid = document.createElement('video')
      vid.src = url
      vid.autoplay = true
      vid.loop = true
      vid.muted = true
      vid.playsInline = true
      vid.setAttribute('playsinline', '')
      vid.onloadeddata = () => { heroIcon.style.display = 'none' }
      hero.appendChild(vid)
    }
  } else if (info.illustrationUrl) {
    const img = document.createElement('img')
    img.onload = () => { heroIcon.style.display = 'none' }
    img.src = info.illustrationUrl
    hero.appendChild(img)
  }

  // Title
  document.getElementById('doneTitle').textContent = info.levelTitle || ''

  // Caption
  const caption = state.type === 'text'
    ? (document.getElementById('textContent')?.value?.trim() || '')
    : (document.getElementById('captionInput')?.value?.trim() || '')
  if (caption) {
    document.getElementById('doneCaptionWrap').style.display = ''
    document.getElementById('doneCaption').textContent = caption
  }

  // Sequence badge: 第 N 件事
  const seq = document.getElementById('doneSeq')
  if (info.levelNum) {
    seq.textContent = '第 ' + info.levelNum + ' 件事'
    seq.style.background = tn.soft
    seq.style.color = TONE_INK[info.levelTone] || TONE_INK.orange
  }

  // Metadata: date · place · role
  const meta = document.getElementById('doneMeta')
  const today = new Date()
  const dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0')
  const place = document.getElementById('placeInput')?.value?.trim() || ''
  const parts = [dateStr, place, state.role ? (state.role + '记录') : null].filter(Boolean)
  meta.innerHTML = parts.map((p, i) =>
    (i > 0 ? '<span class="dot">·</span>' : '') + '<span>' + p + '</span>'
  ).join('')
}

async function uploadFile(fileOrBlob, contentType) {
  const arrayBuffer = await fileOrBlob.arrayBuffer()
  const res = await fetch(API + '/upload/' + TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'x-memory-id': state.memoryId,
    },
    body: arrayBuffer,
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m + ':' + (s < 10 ? '0' : '') + s
}

init()
</script>
</body>
</html>`
}

// ── Router ──

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  // After main dispatcher strips service name, parts[0] = 'yaoji'
  // So action = parts[1], param = parts[2]
  const action = parts[1] || ''
  const param = parts[2] || ''

  try {
    switch (action) {
      case 'create':
        if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
        return await handleCreate(req)

      case 'info':
        if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)
        if (!param) return json({ error: 'missing_token' }, 400)
        return await handleInfo(param)

      case 'upload':
        if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
        if (!param) return json({ error: 'missing_token' }, 400)
        return await handleUpload(req, param)

      case 'submit':
        if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
        if (!param) return json({ error: 'missing_token' }, 400)
        return await handleSubmit(req, param)

      case 'deactivate':
        if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
        return await handleDeactivate(req)

      case 'page':
        if (!param) return json({ error: 'missing_token' }, 400)
        return renderPage(param)

      default:
        return json({ error: 'not_found' }, 404)
    }
  } catch (e) {
    console.error('yaoji error:', e)
    return json({ error: 'internal_error' }, 500)
  }
})
