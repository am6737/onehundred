import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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
  level_suggest: string
  level_tone: string
  kid_id: string | null
  kid_name: string | null
  inviter_role: string
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
  const { levelNum, levelTitle, kidId, kidName, expiresDays = 7,
          levelWhy, levelHow, levelSuggest, levelTone, inviterRole } = body

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
      level_suggest: levelSuggest || 'photo',
      level_tone: levelTone || 'orange',
      kid_id: kidId || null,
      kid_name: kidName || null,
      inviter_role: inviterRole || '',
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
  return json({
    levelTitle: token.level_title,
    levelWhy: token.level_why,
    levelHow: token.level_how,
    levelSuggest: token.level_suggest,
    levelTone: token.level_tone,
    kidName: token.kid_name,
    inviterRole: token.inviter_role,
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
    perspective: 'together',
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
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>邀记 — 一百件事</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Noto+Serif+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --cream:#FAF3E6;--paper:#FFFDF7;--sand:#F2E7D2;
  --ink:#3A332B;--ink-soft:#8B8175;--line:#ECE2D0;
  --accent:#DE8C57;--accent-soft:#F4D9BE;
  --green:#5E7C61;--pink:#D2929A;
  --r:22px;--rs:14px;
  --head:'ZCOOL KuaiLe',sans-serif;
  --body:'Noto Serif SC',serif;
}
body{background:var(--cream);color:var(--ink);font-family:var(--body);
  min-height:100dvh;display:flex;flex-direction:column;align-items:center;
  padding:0 20px 40px;-webkit-font-smoothing:antialiased}
.card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r);
  padding:28px 24px;width:100%;max-width:420px;margin-top:24px;
  box-shadow:0 8px 30px rgba(58,51,43,0.08)}
h1{font-family:var(--head);font-size:26px;line-height:1.4;margin:12px 0 6px;text-align:center}
h2{font-family:var(--head);font-size:20px;margin-bottom:16px}
.sub{color:var(--ink-soft);font-size:14px;text-align:center;line-height:1.6}
.brand{font-family:var(--head);font-size:13px;color:var(--accent);
  margin-top:20px;text-align:center;letter-spacing:1px}
.section{font-size:14px;color:var(--ink-soft);line-height:1.8;margin-top:12px}
.section-label{font-family:var(--head);font-size:13px;color:var(--accent);
  margin-bottom:6px;display:flex;align-items:center;gap:8px}
.section-label::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--accent)}
.btn{display:block;width:100%;padding:16px;border:none;border-radius:var(--rs);
  font-family:var(--head);font-size:17px;cursor:pointer;text-align:center;
  transition:transform 0.15s,opacity 0.15s}
.btn:active{transform:scale(0.97);opacity:0.85}
.btn-primary{background:var(--accent);color:#fff;margin-top:20px}
.btn-secondary{background:var(--sand);color:var(--ink);margin-top:12px}
.roles{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}
.role{padding:10px 18px;border-radius:var(--rs);border:1.5px solid var(--line);
  background:var(--paper);font-family:var(--body);font-size:15px;cursor:pointer;
  transition:all 0.15s;color:var(--ink)}
.role.active{border-color:var(--accent);background:var(--accent-soft);color:var(--ink)}
.role:active{transform:scale(0.95)}
input[type=text],textarea{width:100%;padding:14px 16px;border:1.5px solid var(--line);
  border-radius:var(--rs);font-family:var(--body);font-size:15px;color:var(--ink);
  background:var(--paper);outline:none;resize:vertical;
  transition:border-color 0.2s}
input[type=text]:focus,textarea:focus{border-color:var(--accent)}
textarea{min-height:100px}
.tabs{display:flex;gap:0;border:1.5px solid var(--line);border-radius:var(--rs);
  overflow:hidden;margin-bottom:20px}
.tab{flex:1;padding:12px 4px;text-align:center;font-size:13px;cursor:pointer;
  background:var(--paper);border:none;font-family:var(--body);color:var(--ink-soft);
  transition:all 0.15s}
.tab.active{background:var(--accent);color:#fff}
.capture-area{min-height:180px;border:2px dashed var(--line);border-radius:var(--r);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:12px;padding:24px;color:var(--ink-soft);cursor:pointer;
  transition:border-color 0.2s;position:relative;overflow:hidden}
.capture-area:hover{border-color:var(--accent)}
.capture-area img,.capture-area video{max-width:100%;max-height:280px;
  border-radius:var(--rs);object-fit:contain}
.capture-icon{font-size:40px;opacity:0.5}
.capture-text{font-size:14px}
.hidden{display:none!important}
.preview-wrap{text-align:center}
.field-label{font-size:13px;color:var(--ink-soft);margin:16px 0 6px;font-family:var(--head)}
.progress{width:100%;height:4px;background:var(--sand);border-radius:2px;overflow:hidden;margin:16px 0}
.progress-bar{height:100%;background:var(--accent);transition:width 0.3s;width:0%}
.done-icon{font-size:64px;text-align:center;margin:20px 0 10px}
.error-msg{color:#c0392b;font-size:14px;margin-top:12px;text-align:center}
.audio-controls{display:flex;flex-direction:column;align-items:center;gap:16px}
.rec-btn{width:72px;height:72px;border-radius:50%;border:3px solid var(--accent);
  background:var(--paper);cursor:pointer;display:flex;align-items:center;
  justify-content:center;transition:all 0.2s}
.rec-btn.recording{background:#e74c3c;border-color:#e74c3c}
.rec-btn.recording .rec-dot{background:#fff}
.rec-dot{width:24px;height:24px;border-radius:50%;background:var(--accent);
  transition:all 0.2s}
.rec-btn.recording .rec-dot{border-radius:4px;width:20px;height:20px}
.rec-time{font-family:var(--head);font-size:20px;color:var(--ink-soft)}
.audio-playback{width:100%;margin-top:8px}
.screen{display:none;width:100%;max-width:420px}
.screen.active{display:block}
@media(max-width:380px){
  .card{padding:22px 18px}
  h1{font-size:22px}
}
</style>
</head>
<body>

<!-- Screen: Landing -->
<div id="s-landing" class="screen active">
  <div style="text-align:center;margin-top:40px">
    <div style="font-size:48px">📖</div>
    <div class="brand">一百件事</div>
  </div>
  <div class="card">
    <div class="sub" id="inviterLine"></div>
    <h1 id="levelTitle"></h1>
    <div id="levelWhy" class="section hidden">
      <div class="section-label">为什么</div>
      <div id="levelWhyText"></div>
    </div>
    <div id="levelHow" class="section hidden">
      <div class="section-label">怎么做</div>
      <div id="levelHowText"></div>
    </div>
    <button class="btn btn-primary" onclick="goTo('s-identity')">开始记录</button>
  </div>
  <div id="landingError" class="error-msg hidden"></div>
</div>

<!-- Screen: Identity -->
<div id="s-identity" class="screen">
  <div class="card">
    <h2>你是谁？</h2>
    <div class="sub" style="text-align:left;margin-bottom:8px">选择你的身份，让记录更有温度</div>
    <div class="roles" id="roleList"></div>
    <input type="text" id="customRole" placeholder="或输入你的称呼" style="margin-top:4px">
    <button class="btn btn-primary" id="identityNext" onclick="confirmIdentity()">下一步</button>
  </div>
</div>

<!-- Screen: Capture -->
<div id="s-capture" class="screen">
  <div class="card">
    <h2>记录这一刻</h2>
    <div class="tabs" id="typeTabs"></div>
    <div id="capturePhoto" class="hidden">
      <div class="capture-area" id="photoArea" onclick="document.getElementById('photoInput').click()">
        <div class="capture-icon">📷</div>
        <div class="capture-text">轻点拍照或选择照片</div>
      </div>
      <input type="file" accept="image/*" capture="environment" id="photoInput" class="hidden">
      <button class="btn btn-secondary" onclick="document.getElementById('galleryInput').click()">从相册选择</button>
      <input type="file" accept="image/*" id="galleryInput" class="hidden">
    </div>
    <div id="captureVideo" class="hidden">
      <div class="capture-area" id="videoArea" onclick="document.getElementById('videoInput').click()">
        <div class="capture-icon">🎥</div>
        <div class="capture-text">轻点录像</div>
      </div>
      <input type="file" accept="video/*" capture="environment" id="videoInput" class="hidden">
    </div>
    <div id="captureAudio" class="hidden">
      <div class="audio-controls">
        <div class="rec-time" id="recTime">0:00</div>
        <button class="rec-btn" id="recBtn" onclick="toggleRecording()">
          <div class="rec-dot"></div>
        </button>
        <div class="capture-text" id="recHint">轻点开始录音</div>
        <audio id="audioPlayback" class="audio-playback hidden" controls></audio>
      </div>
    </div>
    <div id="captureText" class="hidden">
      <textarea id="textContent" placeholder="写下你想说的..." maxlength="10000"></textarea>
    </div>
    <div id="capturePreview" class="preview-wrap hidden"></div>
    <button class="btn btn-primary hidden" id="captureNext" onclick="goTo('s-details')">下一步</button>
    <button class="btn btn-secondary hidden" id="recapture" onclick="resetCapture()">重新拍摄</button>
  </div>
</div>

<!-- Screen: Details (caption + place) -->
<div id="s-details" class="screen">
  <div class="card">
    <h2>补充一下</h2>
    <div class="field-label">说点什么（选填）</div>
    <textarea id="captionInput" placeholder="这一刻的感受..." maxlength="300"></textarea>
    <div class="field-label">在哪里（选填）</div>
    <input type="text" id="placeInput" placeholder="例如：家里客厅" maxlength="40">
    <button class="btn btn-primary" onclick="submitRecord()">提交记录</button>
  </div>
</div>

<!-- Screen: Submitting -->
<div id="s-submitting" class="screen">
  <div class="card" style="text-align:center">
    <h2>正在上传...</h2>
    <div class="progress"><div class="progress-bar" id="progressBar"></div></div>
    <div class="sub" id="uploadStatus">准备中</div>
  </div>
</div>

<!-- Screen: Done -->
<div id="s-done" class="screen">
  <div class="card" style="text-align:center">
    <div class="done-icon">🎉</div>
    <h1>记录已保存！</h1>
    <div class="sub" style="margin-top:12px">这份记忆已经安全送达，<br>感谢你参与这件温暖的小事</div>
    <div class="brand" style="margin-top:32px">—— 一百件事 ——</div>
  </div>
</div>

<!-- Screen: Error -->
<div id="s-error" class="screen">
  <div class="card" style="text-align:center">
    <div style="font-size:48px;margin-bottom:16px">😔</div>
    <h2 id="errorTitle">链接已失效</h2>
    <div class="sub" id="errorDesc">这个邀请链接已过期或已被停用</div>
  </div>
</div>

<script>
const TOKEN = '${token}'
const API = '${apiBase}'
const ROLES = ['妈妈','爸爸','爷爷','奶奶','外公','外婆']

let state = {
  info: null,
  role: '',
  type: 'photo',
  file: null,
  audioBlob: null,
  textContent: '',
  memoryId: 'm' + Date.now(),
}

// ── Init ──
async function init() {
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
    if (data.inviterRole) {
      document.getElementById('inviterLine').textContent = data.inviterRole + ' 邀请你一起记录'
    } else {
      document.getElementById('inviterLine').textContent = '有人邀请你一起记录'
    }
    if (data.kidName) {
      document.getElementById('inviterLine').textContent += '\\n关于 ' + data.kidName + ' 的这件事'
    }
    if (data.levelWhy) {
      document.getElementById('levelWhy').classList.remove('hidden')
      document.getElementById('levelWhyText').textContent = data.levelWhy
    }
    if (data.levelHow) {
      document.getElementById('levelHow').classList.remove('hidden')
      document.getElementById('levelHowText').textContent = data.levelHow
    }
    state.type = data.levelSuggest || 'photo'
  } catch (e) {
    document.getElementById('errorDesc').textContent = '网络错误，请稍后重试'
    goTo('s-error')
  }
}

function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(screenId).classList.add('active')
  if (screenId === 's-identity') setupRoles()
  if (screenId === 's-capture') setupCapture()
  window.scrollTo(0, 0)
}

// ── Identity ──
function setupRoles() {
  const list = document.getElementById('roleList')
  list.innerHTML = ''
  ROLES.forEach(r => {
    const el = document.createElement('div')
    el.className = 'role'
    el.textContent = r
    el.onclick = () => {
      document.querySelectorAll('.role').forEach(x => x.classList.remove('active'))
      el.classList.add('active')
      state.role = r
      document.getElementById('customRole').value = ''
    }
    list.appendChild(el)
  })
  document.getElementById('customRole').oninput = function() {
    if (this.value.trim()) {
      document.querySelectorAll('.role').forEach(x => x.classList.remove('active'))
      state.role = this.value.trim()
    }
  }
}

function confirmIdentity() {
  if (!state.role) {
    alert('请选择或输入你的身份')
    return
  }
  goTo('s-capture')
}

// ── Capture ──
const TYPES = [
  { key: 'photo', label: '📷 拍照' },
  { key: 'video', label: '🎥 录像' },
  { key: 'audio', label: '🎙 录音' },
  { key: 'text',  label: '✏️ 写字' },
]

let mediaRecorder = null
let audioChunks = []
let recTimer = null
let recSeconds = 0

function setupCapture() {
  const tabs = document.getElementById('typeTabs')
  tabs.innerHTML = ''
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  TYPES.forEach(t => {
    if (t.key === 'audio' && !canRecord) return
    const el = document.createElement('button')
    el.className = 'tab' + (t.key === state.type ? ' active' : '')
    el.textContent = t.label
    el.onclick = () => {
      state.type = t.key
      tabs.querySelectorAll('.tab').forEach(x => x.classList.remove('active'))
      el.classList.add('active')
      showCapturePanel()
    }
    tabs.appendChild(el)
  })
  showCapturePanel()
}

function showCapturePanel() {
  ['capturePhoto','captureVideo','captureAudio','captureText','capturePreview'].forEach(id =>
    document.getElementById(id).classList.add('hidden'))
  document.getElementById('captureNext').classList.add('hidden')
  document.getElementById('recapture').classList.add('hidden')

  const panel = 'capture' + state.type.charAt(0).toUpperCase() + state.type.slice(1)
  document.getElementById(panel).classList.remove('hidden')

  if (state.type === 'text') {
    document.getElementById('captureNext').classList.remove('hidden')
  }
}

// Photo / Gallery
document.getElementById('photoInput').onchange =
document.getElementById('galleryInput').onchange = function(e) {
  const file = e.target.files[0]
  if (!file) return
  state.file = file
  showImagePreview(file)
}

function showImagePreview(file) {
  const preview = document.getElementById('capturePreview')
  const reader = new FileReader()
  reader.onload = (e) => {
    preview.innerHTML = '<img src="' + e.target.result + '">'
    preview.classList.remove('hidden')
    document.getElementById('capturePhoto').classList.add('hidden')
    document.getElementById('captureNext').classList.remove('hidden')
    document.getElementById('recapture').classList.remove('hidden')
  }
  reader.readAsDataURL(file)
}

// Video
document.getElementById('videoInput').onchange = function(e) {
  const file = e.target.files[0]
  if (!file) return
  state.file = file
  const preview = document.getElementById('capturePreview')
  const url = URL.createObjectURL(file)
  preview.innerHTML = '<video src="' + url + '" controls style="max-width:100%;border-radius:14px"></video>'
  preview.classList.remove('hidden')
  document.getElementById('captureVideo').classList.add('hidden')
  document.getElementById('captureNext').classList.remove('hidden')
  document.getElementById('recapture').classList.remove('hidden')
}

// Audio recording
function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
    return
  }
  audioChunks = []
  recSeconds = 0
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data) }
    mediaRecorder.onstop = () => {
      clearInterval(recTimer)
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' })
      state.audioBlob = blob
      const url = URL.createObjectURL(blob)
      const audio = document.getElementById('audioPlayback')
      audio.src = url
      audio.classList.remove('hidden')
      document.getElementById('recBtn').classList.remove('recording')
      document.getElementById('recHint').textContent = '录音完成'
      document.getElementById('captureNext').classList.remove('hidden')
      document.getElementById('recapture').classList.remove('hidden')
    }
    mediaRecorder.start()
    document.getElementById('recBtn').classList.add('recording')
    document.getElementById('recHint').textContent = '轻点停止'
    recTimer = setInterval(() => {
      recSeconds++
      const m = Math.floor(recSeconds / 60)
      const s = recSeconds % 60
      document.getElementById('recTime').textContent = m + ':' + (s < 10 ? '0' : '') + s
    }, 1000)
  }).catch(() => {
    alert('无法访问麦克风，请检查浏览器权限')
  })
}

function resetCapture() {
  state.file = null
  state.audioBlob = null
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  }
  document.getElementById('capturePreview').innerHTML = ''
  document.getElementById('capturePreview').classList.add('hidden')
  document.getElementById('audioPlayback').classList.add('hidden')
  document.getElementById('recTime').textContent = '0:00'
  document.getElementById('recBtn').classList.remove('recording')
  document.getElementById('recHint').textContent = '轻点开始录音'
  recSeconds = 0
  showCapturePanel()
}

// ── Submit ──
async function submitRecord() {
  if (state.type === 'text') {
    state.textContent = document.getElementById('textContent').value.trim()
    if (!state.textContent) { alert('请输入文字内容'); return }
  }
  if (state.type === 'photo' && !state.file) { alert('请先拍照或选择照片'); return }
  if (state.type === 'video' && !state.file) { alert('请先录制视频'); return }
  if (state.type === 'audio' && !state.audioBlob) { alert('请先录音'); return }

  goTo('s-submitting')
  const bar = document.getElementById('progressBar')
  const status = document.getElementById('uploadStatus')

  try {
    // Upload media file
    if (state.type === 'photo' || state.type === 'video') {
      status.textContent = '正在上传文件...'
      bar.style.width = '20%'
      await uploadFile(state.file, state.file.type)
      bar.style.width = '70%'
    } else if (state.type === 'audio') {
      status.textContent = '正在上传录音...'
      bar.style.width = '20%'
      const mimeType = state.audioBlob.type || 'audio/webm'
      await uploadFile(state.audioBlob, mimeType)
      bar.style.width = '70%'
    } else {
      bar.style.width = '50%'
    }

    // Submit memory record
    status.textContent = '正在保存记录...'
    const caption = state.type === 'text'
      ? state.textContent
      : (document.getElementById('captionInput').value.trim() || '')
    const place = document.getElementById('placeInput')?.value.trim() || ''

    const submitBody = {
      memoryId: state.memoryId,
      role: state.role,
      type: state.type,
      caption,
      place: place || null,
      shots: state.type === 'photo' ? 1 : null,
      duration: state.type === 'audio' ? formatDuration(recSeconds) : null,
    }

    const res = await fetch(API + '/submit/' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitBody),
    })
    const result = await res.json()
    if (result.error) throw new Error(result.error)

    bar.style.width = '100%'
    status.textContent = '完成！'
    setTimeout(() => goTo('s-done'), 500)
  } catch (e) {
    status.textContent = ''
    const errEl = document.createElement('div')
    errEl.className = 'error-msg'
    errEl.textContent = '上传失败：' + (e.message || '请稍后重试')
    document.querySelector('#s-submitting .card').appendChild(errEl)
    const retryBtn = document.createElement('button')
    retryBtn.className = 'btn btn-primary'
    retryBtn.textContent = '重试'
    retryBtn.onclick = () => submitRecord()
    document.querySelector('#s-submitting .card').appendChild(retryBtn)
  }
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
