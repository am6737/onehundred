// ════════════════════════════════════════════════════════════
// send-pet-notifications — 宠物拟人化通知调度
//
// 由 pg_cron 每小时调用（见 migrations/20260623_pet_notifications.sql 第 6 节）。
// 自动扫描各家庭记录状态 → 匹配场景 → 防重 → 按吉祥物（果果/squirrel）+ 设备 lang 选模板
// → 调 DooPush /push/single 发送 → 写 notification_log。
//
// 需要的环境变量（Edge Function secrets）：
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY        —— 自建栈已注入
//   DOOPUSH_APP_ID, DOOPUSH_API_KEY                —— 与 app 的 EXPO_PUBLIC_DOOPUSH_* 一致
//   DOOPUSH_BASE_URL（可选，默认 https://doopush.com/api/v1）
// ════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DOOPUSH_APP_ID = Deno.env.get('DOOPUSH_APP_ID')!
const DOOPUSH_API_KEY = Deno.env.get('DOOPUSH_API_KEY')!
const DOOPUSH_BASE_URL = Deno.env.get('DOOPUSH_BASE_URL') || 'https://doopush.com/api/v1'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// 共享密钥存 DB app_config（非容器 env，改代码热加载即可、无需重启）。首次读后按 isolate 缓存。
let _sharedSecret: string | null = null
async function getSharedSecret(): Promise<string> {
  if (_sharedSecret !== null) return _sharedSecret
  const { data } = await admin.from('app_config').select('value').eq('key', 'notify_secret').maybeSingle()
  _sharedSecret = data?.value ?? ''
  return _sharedSecret
}

const DAY_MS = 24 * 60 * 60 * 1000

// 频率 → 天数阈值（见通知方案 5.3）
const FREQ_THRESHOLDS: Record<string, { gentle: number; growth: number; loss: number }> = {
  gentle: { gentle: 5, growth: 10, loss: 21 },
  normal: { gentle: 3, growth: 7, loss: 14 },
  frequent: { gentle: 2, growth: 5, loss: 10 },
}

type Lang = 'zh' | 'en'

interface Template { id: number; scene: string; species: string; lang: string; title: string; body: string }
interface Memory { created_at: string; kid_id: string; level_num: string; user_id: string; sealed: boolean; seal_until: string | null }
interface Device { device_id: string; token: string | null; lang: string; user_id: string; tz_offset: number }
interface SceneMatch {
  scene: string
  species: string
  kidId: string
  vars: Record<string, string | number>
  who?: string // family_activity：记录者角色/称呼的「原始值」，发送时按接收者语言本地化
  excludeUserId?: string // family_activity：不发给记录者本人
}

function interpolate(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''))
}

// 家庭成员角色在 DB 里以中文规范标识符存储（'爸爸'/'妈妈'…，见 src/data ROLES 与 src/i18n role.*）。
// 通知按「接收者设备语言」渲染，所以 {{who}} 也必须翻到接收者语言，否则会出现「爸爸 just recorded…」这种混排。
// 自定义称呼（custom_role / 邀记自填）是自由文本，无法翻译，原样透传。
const ROLE_LABELS: Record<string, Record<Lang, string>> = {
  '爸爸': { zh: '爸爸', en: 'Dad' },
  '妈妈': { zh: '妈妈', en: 'Mom' },
  '爷爷': { zh: '爷爷', en: 'Grandpa' },
  '奶奶': { zh: '奶奶', en: 'Grandma' },
  '外公': { zh: '外公', en: 'Grandpa' },
  '外婆': { zh: '外婆', en: 'Grandma' },
  '其他': { zh: '家人', en: 'Family' },
}

// 把发送者角色（可能是规范角色，也可能是自定义称呼）本地化到接收者语言。
function localizeWho(who: string, lang: Lang): string {
  const w = (who || '').trim()
  if (!w) return ''
  return ROLE_LABELS[w]?.[lang] ?? w // 命中规范角色→按语言翻译；自定义称呼→原样
}

function daysBetween(a: number, b: number): number {
  return Math.floor((a - b) / DAY_MS)
}

// 连续记录天数：从今天/昨天往回数有记录的连续自然日（UTC 近似）。
function computeStreak(dates: string[]): number {
  const days = new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10)))
  let streak = 0
  const cur = new Date()
  const todayKey = cur.toISOString().slice(0, 10)
  const yest = new Date(cur.getTime() - DAY_MS).toISOString().slice(0, 10)
  if (!days.has(todayKey) && !days.has(yest)) return 0
  if (!days.has(todayKey)) cur.setTime(cur.getTime() - DAY_MS)
  while (days.has(cur.toISOString().slice(0, 10))) {
    streak++
    cur.setTime(cur.getTime() - DAY_MS)
  }
  return streak
}

// 设备本地分钟数（tzOffset = JS getTimezoneOffset，UTC−本地）。
function deviceLocalMinutes(nowUtcMs: number, tzOffsetMin: number): number {
  const local = new Date(nowUtcMs - tzOffsetMin * 60000)
  return local.getUTCHours() * 60 + local.getUTCMinutes()
}

function inQuietHours(localMin: number, start: string, end: string): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
  }
  const s = toMin(start)
  const e = toMin(end)
  return s <= e ? localMin >= s && localMin < e : localMin >= s || localMin < e // 跨午夜
}

async function processFamily(
  familyId: string,
  wardrobe: { at: number }[],
  templates: Template[],
): Promise<string> {
  const { data: prefRow } = await admin
    .from('notification_preferences').select('*').eq('family_id', familyId).maybeSingle()
  const pref = prefRow ?? { enabled: true, notify_family: true, frequency: 'normal', quiet_start: '22:00:00', quiet_end: '08:00:00' }
  if (!pref.enabled) return 'disabled'

  const now = new Date()

  // 全局：每家每天最多 1 条
  const { data: dayLogs } = await admin
    .from('notification_log').select('id')
    .eq('family_id', familyId)
    .gte('sent_at', new Date(now.getTime() - DAY_MS).toISOString()).limit(1)
  if (dayLogs && dayLogs.length > 0) return 'rate_limited_day'

  const { data: kids } = await admin.from('kids').select('id, name').eq('family_id', familyId)
  if (!kids || kids.length === 0) return 'no_kids'
  const primary = kids[0]

  const { data: mems } = await admin
    .from('memories').select('created_at, kid_id, level_num, user_id, sealed, seal_until')
    .eq('family_id', familyId).order('created_at', { ascending: false })
  const memories = (mems ?? []) as Memory[]

  // 单一吉祥物：果果（squirrel）。旧的 per-kid 宠物种类已废弃，统一用 squirrel。
  const sp = (_kidId: string) => 'squirrel'

  // ── 指标 ──
  const th = FREQ_THRESHOLDS[pref.frequency] ?? FREQ_THRESHOLDS.normal
  const lastAt = memories[0] ? new Date(memories[0].created_at).getTime() : null
  const daysSince = lastAt != null ? daysBetween(now.getTime(), lastAt) : Infinity // 家庭级（任意孩子）
  const streak = computeStreak(memories.map((m) => m.created_at)) // 家庭级

  const sortedWardrobe = [...wardrobe].sort((a, b) => a.at - b.at)
  const memsForKid = (id: string) => memories.filter((m) => m.kid_id === id || m.kid_id === 'all')

  // 每孩子：里程碑剩余 / 最近时间胶囊
  const perKid = kids.map((k) => {
    const done = new Set(memsForKid(k.id).map((m) => m.level_num)).size
    const next = sortedWardrobe.find((w) => done < w.at)
    const remain = next ? next.at - done : 0
    let capDays = Infinity
    for (const m of memsForKid(k.id)) {
      if (m.sealed && m.seal_until) {
        const d = daysBetween(new Date(m.seal_until).getTime(), now.getTime())
        if (d >= 0 && d < capDays) capDays = d
      }
    }
    return { kid: k, done, remain, capDays }
  })

  // 家人 24h 内的新记录（who 保留原始值，发送时按接收者设备语言翻译）
  const recent = memories.find((m) => now.getTime() - new Date(m.created_at).getTime() < DAY_MS)
  let whoRaw = ''
  if (recent) {
    const { data: prof } = await admin
      .from('profiles').select('role, custom_role').eq('id', recent.user_id).maybeSingle()
    whoRaw = (prof?.custom_role || '').trim() || prof?.role || ''
  }

  // ── 场景匹配（优先级从高到低，每次只发一条）──
  const match = ((): SceneMatch | null => {
    if (daysSince >= th.loss) return { scene: 'loss_hint', species: sp(primary.id), kidId: primary.id, vars: {} }
    if (daysSince >= th.growth) return { scene: 'growth_nudge', species: sp(primary.id), kidId: primary.id, vars: {} }
    if (daysSince >= th.gentle) return { scene: 'gentle_remind', species: sp(primary.id), kidId: primary.id, vars: {} }
    const ms = perKid.find((p) => p.remain > 0 && p.remain <= 3)
    if (ms) return { scene: 'milestone', species: sp(ms.kid.id), kidId: ms.kid.id, vars: { done: ms.done, remain: ms.remain } }
    const cap = perKid.filter((p) => p.capDays <= 30).sort((a, b) => a.capDays - b.capDays)[0]
    if (cap) return { scene: 'capsule', species: sp(cap.kid.id), kidId: cap.kid.id, vars: { days: cap.capDays } }
    if (streak >= 3) return { scene: 'streak', species: sp(primary.id), kidId: primary.id, vars: { days: streak } }
    if (recent && whoRaw && pref.notify_family !== false) return { scene: 'family_activity', species: sp(recent.kid_id), kidId: recent.kid_id, vars: {}, who: whoRaw, excludeUserId: recent.user_id }
    return null
  })()
  if (!match) return 'no_scene'

  // 同场景 48h 内不重复
  const { data: sceneLog } = await admin
    .from('notification_log').select('id')
    .eq('family_id', familyId).eq('scene', match.scene)
    .gte('sent_at', new Date(now.getTime() - 2 * DAY_MS).toISOString()).limit(1)
  if (sceneLog && sceneLog.length > 0) return `dup_${match.scene}`

  // 收件设备：family_members → push_devices
  const { data: members } = await admin
    .from('family_members').select('user_id').eq('family_id', familyId)
  const userIds = (members ?? []).map((m) => m.user_id)
  if (userIds.length === 0) return 'no_members'
  const { data: devicesRaw } = await admin
    .from('push_devices').select('device_id, token, lang, user_id, tz_offset').in('user_id', userIds)
  const devices = (devicesRaw ?? []) as Device[]
  if (devices.length === 0) return 'no_devices'

  const tplFor = (lang: Lang): Template | null =>
    templates.find((t) => t.scene === match.scene && t.species === match.species && t.lang === lang) ??
    templates.find((t) => t.scene === match.scene && t.species === match.species && t.lang === 'zh') ??
    null

  let sent = 0
  let usedTemplateId: number | null = null
  for (const dev of devices) {
    // 无 token 的设备（如 SQL 造的测试假设备）无法推送，跳过
    if (!dev.token) continue
    // family_activity 不发给记录者本人
    if (match.excludeUserId && dev.user_id === match.excludeUserId) continue
    // 按设备本地时区跳过免打扰时段
    const localMin = deviceLocalMinutes(now.getTime(), dev.tz_offset ?? 0)
    if (inQuietHours(localMin, pref.quiet_start, pref.quiet_end)) continue

    const lang: Lang = dev.lang === 'en' ? 'en' : 'zh'
    const tpl = tplFor(lang)
    if (!tpl) continue
    usedTemplateId = tpl.id
    // {{who}} 按本设备语言翻译；其余变量（done/remain/days）与语言无关
    const vars = match.who != null ? { ...match.vars, who: localizeWho(match.who, lang) } : match.vars
    const title = interpolate(tpl.title, vars)
    const content = interpolate(tpl.body, vars)
    const ok = await sendDooPush(dev.token, title, content, { scene: match.scene, kidId: match.kidId })
    if (ok) sent++
  }

  if (sent > 0) {
    await admin.from('notification_log').insert({
      kid_id: match.kidId, family_id: familyId, scene: match.scene, template_id: usedTemplateId,
    })
    return `sent_${match.scene}_${sent}`
  }
  return `nosend_${match.scene}` // 全部设备处于免打扰/被排除 → 下一小时再试
}

// 注意：DooPush 的 device_id 字段填的是设备 token（与控制台 /config/test 一致），
// 不是 push_devices.device_id 那个内部数字 id；填数字 id 会 400「找不到指定的设备」。
async function sendDooPush(
  deviceToken: string, title: string, content: string, data: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch(`${DOOPUSH_BASE_URL}/apps/${DOOPUSH_APP_ID}/push/single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': DOOPUSH_API_KEY },
      body: JSON.stringify({
        title,
        content,
        device_id: deviceToken,
        payload: { action: 'open_page', data: JSON.stringify(data) },
      }),
    })
    if (!res.ok) {
      console.warn('[doopush] send failed', res.status, await res.text())
      return false
    }
    return true
  } catch (e) {
    console.warn('[doopush] send error', e)
    return false
  }
}

// ── 预览模式（仅测试用）──
// 绕过场景匹配/防重/限流，把模板逐条发到指定设备，用于预览全部文案。
// body: { preview:true, family_id?|device_token?, lang?='zh', species?='squirrel' }
//   - 给 family_id：解析该家庭所有设备 token；或直接给 device_token。
//   - species 省略 → 默认果果（squirrel）；显式给定可预览旧的 bear/dog/cat 参考文案。
async function previewTemplates(body: any, templates: Template[]): Promise<Response> {
  const lang: Lang = body.lang === 'en' ? 'en' : 'zh'
  const species: string | null = body.species ?? 'squirrel' // 默认果果
  const vars = { done: 5, remain: 2, days: 3, who: lang === 'en' ? 'Dad' : '爸爸' }

  let tokens: string[] = []
  if (typeof body.device_token === 'string' && body.device_token) {
    tokens = [body.device_token]
  } else if (body.family_id) {
    const { data: members } = await admin
      .from('family_members').select('user_id').eq('family_id', body.family_id)
    const userIds = (members ?? []).map((m: any) => m.user_id)
    if (userIds.length > 0) {
      const { data: devs } = await admin
        .from('push_devices').select('token').in('user_id', userIds)
      tokens = (devs ?? []).map((d: any) => d.token).filter((t: any): t is string => !!t)
    }
  }
  if (tokens.length === 0) {
    return new Response(
      JSON.stringify({ ok: false, error: 'no target: pass device_token or family_id with a tokened device' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const tpls = templates
    .filter((t) => t.lang === lang && (species == null || t.species === species))
    .sort((a, b) => a.scene.localeCompare(b.scene))

  const sent: string[] = []
  for (const token of tokens) {
    for (const tpl of tpls) {
      const ok = await sendDooPush(
        token, interpolate(tpl.title, vars), interpolate(tpl.body, vars),
        { scene: tpl.scene, kidId: 'preview' },
      )
      if (ok) sent.push(`${tpl.species}/${tpl.scene}`)
      await new Promise((r) => setTimeout(r, 250)) // 间隔，避免被合并/限流
    }
  }
  return new Response(JSON.stringify({ ok: true, preview: true, lang, count: sent.length, sent }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}

// ── 事件驱动：有人刚记了一件事 → 立即给其他家人发 family_activity ──
// 由 client(insertMemory) / yaoji(邀记提交) 在记录落库后即时调用，绕过场景优先级与每日限流，
// 只保留必要护栏：enabled & notify_family 偏好、免打扰、排除记录者本人。
// 手动记一件事 / 邀记提交都是真人主动行为，不做冷却限流——每记一条都推。
// 但仍写 notification_log：让定时巡检的"每天最多 1 条 / 同场景 48h 去重"知道这家今天已活跃，
// 不会再叠加多余的 gentle 提醒或重复的 family_activity。
// body: { event:'memory_created', family_id, kid_id?, who?, actor_user_id?, exclude_user_id? }
//   - who 缺省时按 actor_user_id 的 profile 角色推导（普通记录路径）
//   - 邀记路径显式传 who=被邀请角色，且不排除任何人（被邀请人无账号，inviter 也该收到）

function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

// ── 单条测试（开发者工具）──
// 把指定 scene 的真实模板（按 species + lang 选，sample 变量代入）发到目标设备，
// 绕过所有护栏（场景匹配/防重/限流/免打扰/偏好），用于一键验证某种通知的样子与点击路由。
// body: { event:'test', scene, device_token?, family_id?, actor_user_id?, lang?='zh', species?='squirrel', kid_id? }
//   - 优先 device_token（开发者工具直接传本机 DooPush token，最可靠）；
//   - 否则按 actor_user_id 取该用户设备，或退而取 family_id 全家设备。
async function sendTest(body: any, templates: Template[]): Promise<Response> {
  const scene: string = body.scene
  if (!scene) return jsonResp({ ok: false, error: 'scene required' }, 400)
  const lang: Lang = body.lang === 'en' ? 'en' : 'zh'
  const species: string = body.species || 'squirrel'
  const vars = { done: 5, remain: 2, days: 3, who: lang === 'en' ? 'Dad' : '爸爸' }

  // 目标设备 token
  let tokens: string[] = []
  if (typeof body.device_token === 'string' && body.device_token) {
    tokens = [body.device_token]
  } else if (body.actor_user_id) {
    const { data: devs } = await admin.from('push_devices').select('token').eq('user_id', body.actor_user_id)
    tokens = (devs ?? []).map((d: any) => d.token).filter((t: any): t is string => !!t)
  } else if (body.family_id) {
    const { data: members } = await admin
      .from('family_members').select('user_id').eq('family_id', body.family_id)
    const userIds = (members ?? []).map((m: any) => m.user_id)
    if (userIds.length > 0) {
      const { data: devs } = await admin.from('push_devices').select('token').in('user_id', userIds)
      tokens = (devs ?? []).map((d: any) => d.token).filter((t: any): t is string => !!t)
    }
  }
  if (tokens.length === 0) {
    return jsonResp({ ok: false, error: 'no target device (pass device_token, or register push first)' }, 400)
  }

  const tpl =
    templates.find((t) => t.scene === scene && t.species === species && t.lang === lang) ??
    templates.find((t) => t.scene === scene && t.species === species && t.lang === 'zh') ??
    templates.find((t) => t.scene === scene && t.lang === lang) ??
    templates.find((t) => t.scene === scene) ?? null
  if (!tpl) return jsonResp({ ok: false, error: `no template for scene=${scene}` }, 404)

  const title = interpolate(tpl.title, vars)
  const content = interpolate(tpl.body, vars)
  let sent = 0
  let lastErr = ''
  for (const token of tokens) {
    const r = await sendDooPushVerbose(token, title, content, { scene, kidId: body.kid_id || 'test' })
    if (r.ok) sent++
    else lastErr = `DooPush ${r.status}${r.detail ? ': ' + r.detail : ''}`
  }
  return jsonResp({
    ok: sent > 0, scene, title, content, targets: tokens.length, sent,
    error: sent === 0 ? (lastErr || 'no push sent') : undefined,
  })
}

// 与 sendDooPush 相同，但把失败的 HTTP 状态/响应体带回来，供开发者工具显示
// （区分 DooPush 限流 429 / 无效 token / token 不属于该 DooPush 应用 等）。
async function sendDooPushVerbose(
  deviceToken: string, title: string, content: string, data: Record<string, string>,
): Promise<{ ok: boolean; status: number; detail?: string }> {
  try {
    const res = await fetch(`${DOOPUSH_BASE_URL}/apps/${DOOPUSH_APP_ID}/push/single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': DOOPUSH_API_KEY },
      body: JSON.stringify({
        title, content, device_id: deviceToken,
        payload: { action: 'open_page', data: JSON.stringify(data) },
      }),
    })
    if (!res.ok) return { ok: false, status: res.status, detail: (await res.text()).slice(0, 300) }
    return { ok: true, status: res.status }
  } catch (e) {
    return { ok: false, status: 0, detail: String(e) }
  }
}

// 核心投递：给定一条 outbox 任务，用指定 scene 的模板向「其它家人」推送。返回实际发出的设备数。
// scene = 'family_activity'（记录回忆）或 'custom_level_added'（新增家庭事项）等；extraVars 供 {{title}} 之类。
// 语义：良性跳过（关通知 / 无 kid / 无 who / 无收件人 / 免打扰）→ 返回 0，视为已完成、不重试；
//       只有「发送前」的意外错误（DB 查询失败等）才抛出，交给 drain 退避重试
//       —— 因 sendDooPush 自身吞错返回 bool、从不抛，故抛错时必然一台都没发，重试不会重复推送。
async function runFamilyNotification(
  job: { family_id: string; kid_id: string | null; actor_user_id: string | null; who: string | null; payload?: any },
  scene: string,
  templates: Template[],
  extraVars: Record<string, string> = {},
): Promise<number> {
  const familyId = job.family_id

  const { data: prefRow } = await admin
    .from('notification_preferences').select('*').eq('family_id', familyId).maybeSingle()
  const pref = prefRow ?? { enabled: true, notify_family: true, quiet_start: '22:00:00', quiet_end: '08:00:00' }
  if (!pref.enabled || pref.notify_family === false) return 0

  const now = new Date()

  // 解析真实 kid（notification_log.kid_id 有 NOT NULL+FK，不能写 'all'）
  const { data: kids } = await admin.from('kids').select('id').eq('family_id', familyId)
  if (!kids || kids.length === 0) return 0
  const rawKidId: string = job.kid_id || 'all'
  const kidId = rawKidId !== 'all' && kids.some((k) => k.id === rawKidId) ? rawKidId : kids[0].id
  const species = 'squirrel' // 单一吉祥物：果果

  // who：邀记路径带被邀请人角色/自定义称呼；否则按记录者 profile 推导。
  // 保留原始值，发送时按每台接收设备语言翻译（规范角色→接收者语言，自定义称呼原样）。
  let whoRaw = (job.who ?? '').trim()
  if (!whoRaw && job.actor_user_id) {
    const { data: prof } = await admin
      .from('profiles').select('role, custom_role').eq('id', job.actor_user_id).maybeSingle()
    whoRaw = (prof?.custom_role || '').trim() || prof?.role || ''
  }
  if (!whoRaw) return 0

  const excludeUserId = job.actor_user_id

  // 收件设备：family_members → push_devices
  const { data: members } = await admin
    .from('family_members').select('user_id').eq('family_id', familyId)
  const userIds = (members ?? []).map((m) => m.user_id)
  if (userIds.length === 0) return 0
  const { data: devicesRaw } = await admin
    .from('push_devices').select('device_id, token, lang, user_id, tz_offset').in('user_id', userIds)
  const devices = (devicesRaw ?? []) as Device[]

  const tplFor = (lang: Lang): Template | null =>
    templates.find((t) => t.scene === scene && t.species === species && t.lang === lang) ??
    templates.find((t) => t.scene === scene && t.species === species && t.lang === 'zh') ?? null

  let sent = 0
  let usedTemplateId: number | null = null
  for (const dev of devices) {
    if (!dev.token) continue
    if (excludeUserId && dev.user_id === excludeUserId) continue
    const localMin = deviceLocalMinutes(now.getTime(), dev.tz_offset ?? 0)
    if (inQuietHours(localMin, pref.quiet_start, pref.quiet_end)) continue
    const lang: Lang = dev.lang === 'en' ? 'en' : 'zh'
    const tpl = tplFor(lang)
    if (!tpl) continue
    usedTemplateId = tpl.id
    const vars = { who: localizeWho(whoRaw, lang), ...extraVars } // {{who}} 按设备语言翻译；extraVars（如 title）原样
    const ok = await sendDooPush(
      dev.token, interpolate(tpl.title, vars), interpolate(tpl.body, vars),
      { scene, kidId },
    )
    if (ok) sent++
  }

  if (sent > 0) {
    await admin.from('notification_log').insert({
      kid_id: kidId, family_id: familyId, scene, template_id: usedTemplateId,
    })
  }
  return sent
}

// drain：由 DB 触发器即时 kick（~1-3s）+ 每分钟 cron 兜底 调用。
// 原子领取一批 outbox 任务（SKIP LOCKED + 卡死重领），逐条投递并回写状态（done / 退避重试 / dead）。
async function drainOutbox(templates: Template[]): Promise<Response> {
  const { data: jobs, error } = await admin.rpc('claim_notification_jobs', { p_limit: 20 })
  if (error) return jsonResp({ ok: false, error: error.message }, 500)
  let done = 0
  for (const job of (jobs ?? []) as any[]) {
    try {
      // 按事件分派场景：新增家庭事项 vs 记录回忆
      const sent = job.event === 'custom_level_added'
        ? await runFamilyNotification(job, 'custom_level_added', templates, { title: String(job.payload?.title ?? '') })
        : await runFamilyNotification(job, 'family_activity', templates)
      await admin.rpc('complete_notification_job', { p_id: job.id, p_ok: true, p_sent: sent, p_error: null })
      done++
    } catch (e) {
      await admin.rpc('complete_notification_job', {
        p_id: job.id, p_ok: false, p_sent: 0, p_error: String((e as Error)?.message ?? e).slice(0, 500),
      })
    }
  }
  return jsonResp({ ok: true, claimed: (jobs ?? []).length, done })
}

Deno.serve(async (req: Request) => {
  try {
    // 顶层共享密钥校验：cron / yaoji / 客户端 必须带正确的 X-Notify-Secret 头。
    // 覆盖全部分支（memory_created / test / preview / 定时扫描）。密钥未配置则一律拒绝（fail-closed）。
    const secret = await getSharedSecret()
    const provided = req.headers.get('x-notify-secret') ?? ''
    if (!secret || provided !== secret) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }
    const body = await req.json().catch(() => ({} as any))
    const { data: templates } = await admin.from('notification_templates').select('*')

    if (body?.preview) {
      return await previewTemplates(body, (templates ?? []) as Template[])
    }

    if (body?.event === 'test') {
      return await sendTest(body, (templates ?? []) as Template[])
    }

    if (body?.event === 'drain') {
      return await drainOutbox((templates ?? []) as Template[])
    }

    if (body?.event === 'memory_created') {
      // 已改为 DB 触发器 + outbox 投递（见 migrations/20260702_notification_outbox.sql）。
      // 保留为 no-op：兼容尚未重建、仍会直发 memory_created 的旧客户端，避免与触发器重复推送。
      // 新客户端已不再调用本事件。
      return jsonResp({ ok: true, skipped: 'handled_by_trigger' })
    }

    const { data: wardrobe } = await admin.from('wardrobe').select('at').order('at')
    const { data: families } = await admin.from('families').select('id')

    // 随机 jitter：每个家庭分配 0-120 秒随机延迟，模拟真人感（设计文档 §4.2）。
    // 按 jitter 排序后依次等差值，总耗时 ≤ 120 秒而非 N × 120 秒。
    const withJitter = (families ?? []).map((f) => ({ ...f, jitter: Math.random() * 120_000 }))
    withJitter.sort((a, b) => a.jitter - b.jitter)
    const results: Record<string, string> = {}
    let elapsed = 0
    for (const fam of withJitter) {
      const wait = Math.max(0, fam.jitter - elapsed)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      elapsed = fam.jitter
      try {
        results[fam.id] = await processFamily(fam.id, wardrobe ?? [], (templates ?? []) as Template[])
      } catch (e) {
        results[fam.id] = `error: ${(e as Error).message}`
      }
    }
    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
