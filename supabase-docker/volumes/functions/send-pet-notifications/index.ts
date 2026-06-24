// ════════════════════════════════════════════════════════════
// send-pet-notifications — 宠物拟人化通知调度
//
// 由 pg_cron 每小时调用（见 migrations/20260623_pet_notifications.sql 第 6 节）。
// 自动扫描各家庭记录状态 → 匹配场景 → 防重 → 按宠物 species + 设备 lang 选模板
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
  excludeUserId?: string // family_activity：不发给记录者本人
}

function interpolate(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''))
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
  const pref = prefRow ?? { enabled: true, frequency: 'normal', quiet_start: '22:00:00', quiet_end: '08:00:00' }
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
  const kidIds = kids.map((k) => k.id)
  const primary = kids[0]

  const { data: mems } = await admin
    .from('memories').select('created_at, kid_id, level_num, user_id, sealed, seal_until')
    .eq('family_id', familyId).order('created_at', { ascending: false })
  const memories = (mems ?? []) as Memory[]

  const { data: mascotRows } = await admin
    .from('mascots').select('kid_id, species').in('kid_id', kidIds)
  const speciesByKid = new Map<string, string>((mascotRows ?? []).map((r) => [r.kid_id, r.species ?? 'bear']))
  const sp = (kidId: string) => speciesByKid.get(kidId) ?? 'bear'

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

  // 家人 24h 内的新记录
  const recent = memories.find((m) => now.getTime() - new Date(m.created_at).getTime() < DAY_MS)
  let who = ''
  if (recent) {
    const { data: prof } = await admin
      .from('profiles').select('role, custom_role').eq('id', recent.user_id).maybeSingle()
    who = prof?.custom_role || prof?.role || ''
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
    if (recent && who) return { scene: 'family_activity', species: sp(recent.kid_id), kidId: recent.kid_id, vars: { who }, excludeUserId: recent.user_id }
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
    const title = interpolate(tpl.title, match.vars)
    const content = interpolate(tpl.body, match.vars)
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
// body: { preview:true, family_id?|device_token?, lang?='zh', species?=全部 }
//   - 给 family_id：解析该家庭所有设备 token；或直接给 device_token。
//   - species 省略 → 发全部种类（bear/dog/cat）；给定则只发该种类。
async function previewTemplates(body: any, templates: Template[]): Promise<Response> {
  const lang: Lang = body.lang === 'en' ? 'en' : 'zh'
  const species: string | null = body.species ?? null // null → 全部种类
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

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({} as any))
    const { data: templates } = await admin.from('notification_templates').select('*')

    if (body?.preview) {
      return await previewTemplates(body, (templates ?? []) as Template[])
    }

    const { data: wardrobe } = await admin.from('wardrobe').select('at').order('at')
    const { data: families } = await admin.from('families').select('id')

    const results: Record<string, string> = {}
    for (const fam of families ?? []) {
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
