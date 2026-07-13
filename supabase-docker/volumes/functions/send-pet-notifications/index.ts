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

// 频率 → 天数阈值。刻意调稀：家庭记忆是低频行为，不套 Duolingo 每日打卡那套催记录逻辑，
// 否则用户一打开就有「欠账」负罪感。首次温和提醒最早也要到「约 2 周」（normal），
// 升级阶梯（gentle→growth→loss）拉长到数周~数月，做「时不时陪伴」而非「经常性催促」。
const FREQ_THRESHOLDS: Record<string, { gentle: number; growth: number; loss: number }> = {
  gentle: { gentle: 21, growth: 45, loss: 90 }, // 少：更克制
  normal: { gentle: 14, growth: 30, loss: 60 }, // 适中（默认）：约每 2 周起
  frequent: { gentle: 10, growth: 21, loss: 45 }, // 多：仍无每日打卡感
}

// 提醒类场景（「你还没记录」的催促）。与正向惊喜场景区别对待：
// 这三类共享「提醒冷却」，保证偶发；正向场景（那年今天/里程碑/胶囊/连续/家人）不受此限。
const REMINDER_SCENES = ['gentle_remind', 'growth_nudge', 'loss_hint']

type Lang = 'zh' | 'en'

interface Template { id: number; scene: string; species: string; lang: string; title: string; body: string }
interface Memory { id: string; created_at: string; kid_id: string; level_num: string; user_id: string; sealed: boolean; seal_until: string | null }
interface Device { device_id: string; token: string | null; lang: string; user_id: string; tz_offset: number }
interface SceneMatch {
  scene: string
  species: string
  kidId: string
  vars: Record<string, string | number>
  who?: string // family_activity：记录者角色/称呼的「原始值」，发送时按接收者语言本地化
  excludeUserId?: string // family_activity：不发给记录者本人
  memId?: string // on_this_day：被翻出的旧记录 id，写入 payload 供点击深链
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

// 家庭本地小时（tzOffset = JS getTimezoneOffset，UTC−本地，分钟）。
function localHour(utcMs: number, tzOffsetMin: number): number {
  return new Date(utcMs - tzOffsetMin * 60000).getUTCHours()
}

// 从历史记录推断「习惯记录时段」（家庭本地小时的众数）。
// 现状：所有家庭都在免打扰结束的首个小时（≈08:00）扎堆收到提醒，像统一定时器；
// 改为在各家自己最活跃的时段附近推送，更贴近真人作息、天然错峰、更难被预测。
// 数据不足（<5 条）或众数落在夜间（<8 或 >20）→ 回退默认 19:00。
// 上界钳到 20：默认免打扰 22:00 前至少留 [sendHour..21] 两个可发小时，某小时 cron 失败也有补发机会。
const DEFAULT_SEND_HOUR = 19
function computeSendHour(memories: Memory[], tzOffsetMin: number): number {
  if (memories.length < 5) return DEFAULT_SEND_HOUR
  const hist = new Array(24).fill(0)
  for (const m of memories) hist[localHour(new Date(m.created_at).getTime(), tzOffsetMin)]++
  let peak = -1
  let best = -1
  for (let h = 0; h < 24; h++) {
    if (hist[h] > best) { best = hist[h]; peak = h }
  }
  if (peak < 8 || peak > 20) return DEFAULT_SEND_HOUR
  return peak
}

// {{when}} 本地化：「一年前的今天」/「A year ago today」等，句首适配大写。
const CN_NUM = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九']
const EN_NUM = ['zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
function formatWhen(years: number, lang: Lang): string {
  if (lang === 'en') {
    if (years === 1) return 'A year ago today'
    const n = years < EN_NUM.length ? EN_NUM[years] : String(years)
    return `${n} years ago today`
  }
  if (years === 1) return '一年前的今天'
  const n = years < CN_NUM.length ? CN_NUM[years] : String(years)
  return `${n}年前的今天`
}

type CtrMap = Map<number, { sent: number; clicks: number }>

// 模板选取（RDSA-lite）：先「避开最近用过的 (候选数−1) 条」保证轮播不重复（治腻），
// 再在剩余候选里按 CTR 加权随机 —— 分值 = 平滑点击率 (clicks+1)/(sent+2)（Beta(1,1) 先验，
// 未观测≈0.5）。高点击率文案更可能被选（利用），低分/新文案仍有机会（探索），数据多了自动收敛。
// 候选缺失当前语言 → 回退中文；仅 1 条 → 直接用。历史读 notification_log.template_id。
async function pickTemplate(
  familyId: string, scene: string, species: string, lang: Lang, templates: Template[], ctr: CtrMap,
): Promise<Template | null> {
  let candidates = templates.filter((t) => t.scene === scene && t.species === species && t.lang === lang)
  if (candidates.length === 0) {
    candidates = templates.filter((t) => t.scene === scene && t.species === species && t.lang === 'zh')
  }
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]
  const { data: recent } = await admin
    .from('notification_log').select('template_id')
    .eq('family_id', familyId).eq('scene', scene)
    .order('sent_at', { ascending: false }).limit(candidates.length - 1)
  const used = new Set((recent ?? []).map((r: any) => r.template_id).filter((x: any) => x != null))
  const fresh = candidates.filter((c) => !used.has(c.id))
  const pool = fresh.length > 0 ? fresh : candidates
  const scored = pool.map((c) => {
    const s = ctr.get(c.id)
    return { c, w: ((s?.clicks ?? 0) + 1) / ((s?.sent ?? 0) + 2) }
  })
  let r = Math.random() * scored.reduce((a, b) => a + b.w, 0)
  for (const s of scored) { r -= s.w; if (r <= 0) return s.c }
  return scored[scored.length - 1].c
}

// 本次发送落一条 notification_log 时的 template_id：取多数派语言的模板
// （混合语言家庭少见，取占多数者代表本次发送）。
function majorityTemplateId(targets: { tpl: Template }[]): number {
  const counts = new Map<number, number>()
  for (const t of targets) counts.set(t.tpl.id, (counts.get(t.tpl.id) ?? 0) + 1)
  let best = targets[0].tpl.id
  let bestC = -1
  for (const [id, c] of counts) { if (c > bestC) { bestC = c; best = id } }
  return best
}

async function processFamily(
  familyId: string,
  wardrobe: { at: number }[],
  templates: Template[],
  ctr: CtrMap,
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
    .from('memories').select('id, created_at, kid_id, level_num, user_id, sealed, seal_until')
    .eq('family_id', familyId).order('created_at', { ascending: false })
  const memories = (mems ?? []) as Memory[]

  // 收件设备（提前取：既用于个性化发送时段判定，也用于最终投递）
  const { data: members } = await admin
    .from('family_members').select('user_id').eq('family_id', familyId)
  const userIds = (members ?? []).map((m) => m.user_id)
  if (userIds.length === 0) return 'no_members'
  const { data: devicesRaw } = await admin
    .from('push_devices').select('device_id, token, lang, user_id, tz_offset').in('user_id', userIds)
  const devices = (devicesRaw ?? []) as Device[]
  if (devices.length === 0) return 'no_devices'

  // 个性化发送时段：只挡「太早」——不早于该家「习惯记录时段」才评估发送，消除全员扎堆免打扰结束
  // 的 ≈08:00。到点后每个小时都是一次机会（免打扰由下方按设备再过滤），直到发出或当天结束。
  // 用「不早于」而非「固定 2h 窗口」：窗口若因 cron 失败/自定义免打扰错过，仍能在后续非免打扰小时补发，
  // 避免个性化门控把当天推送「静默饿死」。取任一设备时区为家庭代表（同家庭通常同城）。
  const repTz = devices.find((d) => d.tz_offset != null)?.tz_offset ?? 0
  const sendHour = computeSendHour(memories, repTz)
  const curHour = localHour(now.getTime(), repTz)
  if (curHour < sendHour) return 'off_window' // 太早：等到习惯时段再发

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

  // 那年今天：存在「N 年前的今天（365k±3 天）」且当前可见（未被封存锁住）的旧记录 → 正向回忆唤起。
  // memories 已按 created_at 降序，取最年轻的满足周年者（≈1 年前，最有共鸣）。周年天然稀疏、自限流。
  const anniversary = ((): { kidId: string; memId: string; years: number } | null => {
    const nowMs = now.getTime()
    for (const m of memories) {
      const ageDays = daysBetween(nowMs, new Date(m.created_at).getTime())
      if (ageDays < 362) continue
      const years = Math.round(ageDays / 365)
      if (years < 1 || Math.abs(ageDays - years * 365) > 3) continue
      if (m.sealed && m.seal_until && new Date(m.seal_until).getTime() > nowMs) continue // 仍封存锁着，跳过
      return { kidId: m.kid_id === 'all' ? primary.id : m.kid_id, memId: m.id, years }
    }
    return null
  })()

  // ── 场景匹配（优先级从高到低，每次只发一条）──
  const match = ((): SceneMatch | null => {
    // 那年今天优先：用真实回忆再互动，比内疚 nag 更温柔有效（有周年记录才触发，故不会喧宾夺主）
    if (anniversary) return { scene: 'on_this_day', species: sp(anniversary.kidId), kidId: anniversary.kidId, vars: { years: anniversary.years }, memId: anniversary.memId }
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

  // 防重：提醒类（gentle/growth/loss）用「提醒冷却」——任一提醒场景在冷却期内发过就不再发提醒，
  // 保证「时不时」而非连续念叨（冷却 = 该档首提醒间隔 th.gentle，约 2 周）。正向场景仍用同场景 48h 去重。
  if (REMINDER_SCENES.includes(match.scene)) {
    const cooldownMs = th.gentle * DAY_MS
    const { data: recentReminder } = await admin
      .from('notification_log').select('id')
      .eq('family_id', familyId).in('scene', REMINDER_SCENES)
      .gte('sent_at', new Date(now.getTime() - cooldownMs).toISOString()).limit(1)
    if (recentReminder && recentReminder.length > 0) return 'reminder_cooldown'
  } else {
    const { data: sceneLog } = await admin
      .from('notification_log').select('id')
      .eq('family_id', familyId).eq('scene', match.scene)
      .gte('sent_at', new Date(now.getTime() - 2 * DAY_MS).toISOString()).limit(1)
    if (sceneLog && sceneLog.length > 0) return `dup_${match.scene}`
  }

  // 组装可发送目标（过滤无 token / 记录者本人 / 免打扰），并按语言做轮播+CTR 选模板（同语言只选一次）。
  const chosen = new Map<Lang, Template | null>()
  const getTpl = async (lang: Lang): Promise<Template | null> => {
    if (!chosen.has(lang)) chosen.set(lang, await pickTemplate(familyId, match.scene, match.species, lang, templates, ctr))
    return chosen.get(lang) ?? null
  }
  const targets: { token: string; lang: Lang; tpl: Template }[] = []
  for (const dev of devices) {
    if (!dev.token) continue // 无 token（如 SQL 造的测试假设备）无法推送
    if (match.excludeUserId && dev.user_id === match.excludeUserId) continue // family_activity 不发给记录者本人
    const localMin = deviceLocalMinutes(now.getTime(), dev.tz_offset ?? 0)
    if (inQuietHours(localMin, pref.quiet_start, pref.quiet_end)) continue // 免打扰
    const lang: Lang = dev.lang === 'en' ? 'en' : 'zh'
    const tpl = await getTpl(lang)
    if (!tpl) continue
    targets.push({ token: dev.token, lang, tpl })
  }
  if (targets.length === 0) return `nosend_${match.scene}` // 全部免打扰/被排除/无模板 → 下一小时再试

  // 先落一条 notification_log（clicked=false）拿到 id → 写进 payload，供客户端点击回写闭环。
  const { data: logRow } = await admin.from('notification_log')
    .insert({ kid_id: match.kidId, family_id: familyId, scene: match.scene, template_id: majorityTemplateId(targets) })
    .select('id').single()
  const logId: number | null = logRow?.id ?? null

  let sent = 0
  for (const t of targets) {
    // {{who}}/{{when}} 按本设备语言本地化；其余变量（done/remain/days）与语言无关
    const vars: Record<string, string | number> = { ...match.vars }
    if (match.who != null) vars.who = localizeWho(match.who, t.lang)
    if (match.scene === 'on_this_day') vars.when = formatWhen(Number(match.vars.years ?? 1), t.lang)
    const data: Record<string, string> = { scene: match.scene, kidId: match.kidId }
    if (match.memId) data.memId = match.memId
    if (logId != null) data.logId = String(logId)
    const ok = await sendDooPush(t.token, interpolate(t.tpl.title, vars), interpolate(t.tpl.body, vars), data)
    if (ok) sent++
  }

  if (sent === 0 && logId != null) {
    // 一台都没发出去（DooPush 全失败）→ 撤回日志，避免污染每日限流/CTR
    await admin.from('notification_log').delete().eq('id', logId)
    return `nosend_${match.scene}`
  }
  return `sent_${match.scene}_${sent}`
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
  extraVars: Record<string, string>,
  ctr: CtrMap,
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

  // 组装可发送目标（过滤无 token / 记录者本人 / 免打扰），并按语言做轮播+CTR 选模板。
  const chosen = new Map<Lang, Template | null>()
  const getTpl = async (lang: Lang): Promise<Template | null> => {
    if (!chosen.has(lang)) chosen.set(lang, await pickTemplate(familyId, scene, species, lang, templates, ctr))
    return chosen.get(lang) ?? null
  }
  const targets: { token: string; lang: Lang; tpl: Template }[] = []
  for (const dev of devices) {
    if (!dev.token) continue
    if (excludeUserId && dev.user_id === excludeUserId) continue
    const localMin = deviceLocalMinutes(now.getTime(), dev.tz_offset ?? 0)
    if (inQuietHours(localMin, pref.quiet_start, pref.quiet_end)) continue
    const lang: Lang = dev.lang === 'en' ? 'en' : 'zh'
    const tpl = await getTpl(lang)
    if (!tpl) continue
    targets.push({ token: dev.token, lang, tpl })
  }
  if (targets.length === 0) return 0

  // 先落一条 notification_log（clicked=false）拿到 id → 写进 payload，供客户端点击回写闭环。
  const { data: logRow } = await admin.from('notification_log')
    .insert({ kid_id: kidId, family_id: familyId, scene, template_id: majorityTemplateId(targets) })
    .select('id').single()
  const logId: number | null = logRow?.id ?? null

  let sent = 0
  for (const t of targets) {
    const vars = { who: localizeWho(whoRaw, t.lang), ...extraVars } // {{who}} 按设备语言翻译；extraVars（如 title）原样
    const data: Record<string, string> = { scene, kidId }
    if (logId != null) data.logId = String(logId)
    const ok = await sendDooPush(t.token, interpolate(t.tpl.title, vars), interpolate(t.tpl.body, vars), data)
    if (ok) sent++
  }

  if (sent === 0 && logId != null) {
    await admin.from('notification_log').delete().eq('id', logId)
    return 0
  }
  return sent
}

// drain：由 DB 触发器即时 kick（~1-3s）+ 每分钟 cron 兜底 调用。
// 原子领取一批 outbox 任务（SKIP LOCKED + 卡死重领），逐条投递并回写状态（done / 退避重试 / dead）。
async function drainOutbox(templates: Template[], ctr: CtrMap): Promise<Response> {
  const { data: jobs, error } = await admin.rpc('claim_notification_jobs', { p_limit: 20 })
  if (error) return jsonResp({ ok: false, error: error.message }, 500)
  let done = 0
  for (const job of (jobs ?? []) as any[]) {
    try {
      // 按事件分派场景：新增家庭事项 vs 记录回忆
      const sent = job.event === 'custom_level_added'
        ? await runFamilyNotification(job, 'custom_level_added', templates, { title: String(job.payload?.title ?? '') }, ctr)
        : await runFamilyNotification(job, 'family_activity', templates, {}, ctr)
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

    // 每模板 CTR（近 45 天）：本次调用取一次，供 pickTemplate 加权选取（drain / 定时扫描共用）。
    const { data: ctrRows } = await admin.from('notification_ctr').select('template_id, sent, clicks')
    const ctr: CtrMap = new Map()
    for (const r of (ctrRows ?? []) as any[]) {
      ctr.set(Number(r.template_id), { sent: Number(r.sent), clicks: Number(r.clicks) })
    }

    if (body?.event === 'drain') {
      return await drainOutbox((templates ?? []) as Template[], ctr)
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
        results[fam.id] = await processFamily(fam.id, wardrobe ?? [], (templates ?? []) as Template[], ctr)
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
