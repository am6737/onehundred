/* ════════════════════════════════════════════════════════════
   一百件事 — data layer (Supabase-backed)
   ════════════════════════════════════════════════════════════ */

import { supabase } from '../lib/supabase';
import { File as FSFile } from 'expo-file-system';
import { t, getLang } from '../i18n';

// ── Pure constants (no DB dependency) ──

// 用 getter：每次读取 label/long/hint 都按当前语言翻译，调用点无需改动。
export const PERSPECTIVES = {
  parent:   { key: 'parent',   get label() { return t('perspective.parent.label'); },   get long() { return t('perspective.parent.long'); },   get hint() { return t('perspective.parent.hint'); } },
  child:    { key: 'child',    get label() { return t('perspective.child.label'); },    get long() { return t('perspective.child.long'); },    get hint() { return t('perspective.child.hint'); } },
  together: { key: 'together', get label() { return t('perspective.together.label'); }, get long() { return t('perspective.together.long'); }, get hint() { return t('perspective.together.hint'); } },
};

export const FAMILY = { id: 'all', get name() { return t('family.all'); }, tone: 'pink' };

// role 在 DB 里以中文存储并用于判等（如 === '其他'），故保持中文为「规范标识」，仅展示时翻译。
export const ROLES = ['爸爸', '妈妈', '爷爷', '奶奶', '外公', '外婆'];
const ROLE_LABEL_KEYS: Record<string, string> = {
  '爸爸': 'dad', '妈妈': 'mom', '爷爷': 'grandpaP', '奶奶': 'grandmaP',
  '外公': 'grandpaM', '外婆': 'grandmaM', '其他': 'other',
};
// 把存储用的角色标识翻成展示文案；自定义角色（自由文本）原样返回。
export function roleLabel(role?: string): string {
  if (!role) return '';
  const k = ROLE_LABEL_KEYS[role];
  return k ? t(`role.${k}`) : role;
}
export const DEFAULT_ME = { role: '爸爸', custom: '' };

export const NOW_YM = {
  get y() { return new Date().getFullYear(); },
  get m() { return new Date().getMonth() + 1; },
};

// 可重复做的内置事——这些事做完后仍然可以"再做一次"。
// 自定义事（custom）默认也可以重复。以后可由算法动态决定。
export const REPEATABLE_LEVELS = new Set(['05']);

// ── Pure functions (no DB dependency) ──

export function meName(me) {
  if (!me) return t('role.parentFallback');
  return me.role === '其他' ? (me.custom || t('role.selfFallback')) : roleLabel(me.role);
}

export function meChar(me) {
  const n = meName(me);
  if (!n) return '';
  // 中文取末字（「爸爸」→「爸」），英文取首字母
  return getLang() === 'zh' ? n[n.length - 1] : (n[0] || '').toUpperCase();
}

export function durationSince(sinceStr) {
  const match = sinceStr && sinceStr.match(/(\d+)\s*年\s*(\d+)\s*月(?:\s*(\d+)\s*日)?/);
  if (!match) return '';
  const startY = parseInt(match[1], 10);
  const startM = parseInt(match[2], 10);
  const startD = match[3] ? parseInt(match[3], 10) : 1;
  const now = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1;
  const nowD = now.getDate();
  let years = nowY - startY;
  let months = nowM - startM;
  let days = nowD - startD;
  if (days < 0) {
    months--;
    days += new Date(nowY, nowM - 1, 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  const parts: any[] = [];
  if (years > 0) parts.push(t('duration.years', { count: years }));
  if (months > 0) parts.push(t('duration.months', { count: months }));
  if (years === 0 && months === 0 && days > 0) parts.push(t('duration.days', { count: days }));
  return parts.join(' ') || t('duration.fallback');
}

export function kidAge(k) {
  if (!k || k.id === 'all') return null;
  return Math.max(0, NOW_YM.y - k.y - (NOW_YM.m < k.m ? 1 : 0));
}

export function nowCtx() {
  const d = new Date();
  const h = d.getHours(), wd = d.getDay(), m = d.getMonth() + 1;
  return {
    hour: h, weekend: wd === 0 || wd === 6, month: m,
    season: m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter',
    slot: h < 11 ? 'morning' : h < 14 ? 'noon' : h < 18 ? 'afternoon' : h < 21 ? 'evening' : 'night',
  };
}

export function suitsNow(l) {
  const ctx = nowCtx();
  if (l.custom) return t('suits.custom');
  if (l.seasonal && (ctx.season === 'spring' || ctx.season === 'summer')) return t('suits.season');
  if ((ctx.slot === 'evening' || ctx.slot === 'night') && (l.suggest === 'voice' || l.suggest === 'text')) return t('suits.evening');
  if (ctx.weekend && l.suggest === 'photo') return t('suits.weekend');
  if (ctx.slot === 'afternoon' && l.suggest === 'photo') return t('suits.afternoon');
  return null;
}

// ── DB → JS column mappers ──

function mapLevel(row) {
  return {
    num: row.num, perspective: row.perspective, tone: row.tone,
    title: row.title, why: row.why, how: row.how, record: row.record,
    suggest: row.suggest, sealed: row.sealed, sealUntil: row.seal_until,
    sealedOn: row.sealed_on, sealKind: row.seal_kind, seasonal: row.seasonal, kid: row.kid,
    illustrationPath: row.illustration_path,
  };
}

function mapMemory(row) {
  return {
    id: row.id, kid: row.kid_id, levelNum: row.level_num,
    perspective: row.perspective, type: row.type, dur: row.duration,
    shots: row.shots, date: row.date, place: row.place, title: row.title,
    caption: row.caption, transcript: row.transcript, tone: row.tone,
    sealed: row.sealed, sealUntil: row.seal_until, sealLabel: row.seal_label,
    inviteTokenId: row.invite_token_id, invitedRole: row.invited_role,
    userId: row.user_id, createdAt: row.created_at,
  };
}

function mapKid(row) {
  return {
    id: row.id, name: row.name, y: row.birth_year, m: row.birth_month,
    tone: row.tone, bear: row.bear, since: row.since, acc: row.accessories,
  };
}

function mapCustomLevel(row) {
  return {
    id: row.id, num: row.num, perspective: row.perspective, tone: row.tone, custom: true,
    title: row.title, why: row.why, how: row.how, record: row.record_hint,
    suggest: row.suggest, illustrationPath: row.illustration_path,
  };
}

// ── Async fetch functions ──

export async function fetchLevels() {
  const { data, error } = await supabase.from('levels').select('*').order('sort_order');
  if (error) throw error;
  return (data || []).map(mapLevel);
}

export async function fetchKids() {
  const { data, error } = await supabase.from('kids').select('*');
  if (error) throw error;
  return (data || []).map(mapKid);
}

export async function fetchMemories() {
  const { data, error } = await supabase.from('memories').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapMemory);
}

export async function fetchCustomLevels() {
  const { data, error } = await supabase.from('custom_levels').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapCustomLevel);
}

export async function insertCustomLevel({
  title, why = '', how = '', record = '',
  perspective = 'together', tone = 'pink', suggest = 'photo',
  illustrationPath = null,
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const familyId = await getMyFamilyId();
  if (!familyId) throw new Error('no_family');
  const { data: existing } = await supabase.from('custom_levels').select('id').eq('family_id', familyId);
  const num = '★' + ((existing?.length || 0) + 1);
  const { data, error } = await supabase.from('custom_levels').insert({
    family_id: familyId,
    user_id: session.user.id,
    num, title, perspective, tone, suggest,
    why: why || t('customLevel.defaultWhy'),
    how, record_hint: record,
    illustration_path: illustrationPath,
  }).select().single();
  if (error) throw error;
  return mapCustomLevel(data);
}

// 改一件「我们家自己的事」。只更新传进来的字段（undefined 的不动），
// num 不变——这样已经记录在这件事下的回忆仍然对得上。
export async function updateCustomLevel(id, input: any = {}) {
  const { title, why, how, record, perspective, tone, suggest, illustrationPath } = input;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const fields: Record<string, any> = {};
  if (title !== undefined) fields.title = title;
  if (why !== undefined) fields.why = why;
  if (how !== undefined) fields.how = how;
  if (record !== undefined) fields.record_hint = record;
  if (perspective !== undefined) fields.perspective = perspective;
  if (tone !== undefined) fields.tone = tone;
  if (suggest !== undefined) fields.suggest = suggest;
  if (illustrationPath !== undefined) fields.illustration_path = illustrationPath;
  const { data, error } = await supabase
    .from('custom_levels').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return mapCustomLevel(data);
}

// 删一件「我们家自己的事」。RLS 限定只能删自己家的。
// best-effort 清掉这件事的封面（只删它自己那张，不碰同家其他事），失败不阻塞删除。
export async function deleteCustomLevel(id, illustrationPath = null) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase.from('custom_levels').delete().eq('id', id);
  if (error) throw error;
  if (illustrationPath && !/^https?:\/\//i.test(illustrationPath)) {
    try {
      const { error: rmErr } = await supabase.storage.from('illustrations').remove([illustrationPath]);
      if (rmErr) throw rmErr;
    } catch (e: any) {
      console.warn('deleteCustomLevel illustration cleanup:', e?.message || e);
    }
  }
}

// 上传自定义事的封面到公开桶 illustrations，按家庭目录存放（受 RLS 限定只能写自己家）。
// 返回桶内路径（存进 custom_levels.illustration_path），失败返回 null，不阻塞创建。
export async function uploadIllustration(uri) {
  try {
    const familyId = await getMyFamilyId();
    if (!familyId) throw new Error('no_family');
    const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
    const path = `${familyId}/custom-${Date.now()}.${ext}`;
    const contentType =
      ext === 'png' ? 'image/png' :
      ext === 'heic' ? 'image/heic' :
      ext === 'webp' ? 'image/webp' :
      'image/jpeg';
    // RN 的 fetch(file://).blob() 上传经常得到 0 字节文件，改为直接读字节
    const bytes = await new FSFile(uri).bytes();
    const { error } = await supabase.storage
      .from('illustrations')
      .upload(path, bytes, { contentType, upsert: true });
    if (error) throw error;
    return path;
  } catch (e: any) {
    console.warn('uploadIllustration failed:', e?.message || e);
    return null;
  }
}

export async function insertMemory({ id: givenId, kid, levelNum, perspective, type, dur, shots, date, place, title, caption, transcript, tone, sealed, sealUntil, sealLabel }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const familyId = await getMyFamilyId();
  if (!familyId) throw new Error('no_family');
  const id = givenId || `m${Date.now()}`;
  const { data, error } = await supabase.from('memories').insert({
    id,
    family_id: familyId,
    user_id: session.user.id,
    kid_id: kid,
    level_num: levelNum,
    perspective,
    type,
    duration: dur || null,
    shots: shots || null,
    date,
    place: place || null,
    title,
    caption: caption || '',
    transcript: transcript || null,
    tone: tone || 'orange',
    sealed: sealed || false,
    seal_until: sealUntil || null,
    seal_label: sealLabel || null,
  }).select().single();
  if (error) throw error;
  // 记完即时通知家人：已改由 memories 的 DB 触发器 + outbox 服务端投递（~1-3s，含重试兜底）。
  // 客户端不再直接调 send-pet-notifications——更可靠，且从源头杜绝伪造（归属由 memories RLS 保证）。
  return mapMemory(data);
}

export async function deleteMemory(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase.from('memories').delete().eq('id', id);
  if (error) throw error;
  // best-effort 清理 Storage 媒体目录，失败不阻塞删除
  try {
    const familyId = await getMyFamilyId();
    const dir = `${familyId}/${id}`;
    const { data: files, error: listErr } = await supabase.storage.from('memories').list(dir);
    if (listErr) throw listErr;
    if (files && files.length > 0) {
      const { error: rmErr } = await supabase.storage
        .from('memories')
        .remove(files.map(f => `${dir}/${f.name}`));
      if (rmErr) throw rmErr;
    }
  } catch (e: any) {
    console.warn('deleteMemory storage cleanup:', e?.message || e);
  }
}

export async function insertKid({ name, y, m, tone = 'orange' }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const familyId = await getMyFamilyId();
  if (!familyId) throw new Error('no_family');
  const id = 'k' + Date.now();
  const now = new Date();
  const since = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const { data, error } = await supabase.from('kids').insert({
    id,
    family_id: familyId,
    user_id: session.user.id,
    name,
    birth_year: y,
    birth_month: m,
    tone,
    bear: '',
    since,
    accessories: ['scarf'],
  }).select().single();
  if (error) throw error;
  return mapKid(data);
}

export async function updateKid(id: string, fields: { name?: string; y?: number; m?: number }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const mapped: any = {};
  if (fields.name !== undefined) mapped.name = fields.name;
  if (fields.y !== undefined) mapped.birth_year = fields.y;
  if (fields.m !== undefined) mapped.birth_month = fields.m;
  const { error } = await supabase.from('kids').update(mapped).eq('id', id);
  if (error) throw error;
}

// 删孩子：走 delete_kid RPC，原子清掉这个孩子的 memories/mascot/邀记再删本人（仅创建者）。
export async function deleteKid(id: string) {
  const { error } = await supabase.rpc('delete_kid', { p_kid_id: id });
  if (error) throw error;
}

export async function fetchProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(fields) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase.from('profiles').update(fields).eq('id', session.user.id);
  if (error) throw error;
}

// 把 DooPush 设备登记到 push_devices，供后端按家庭定向发送宠物通知。
// device_id = DooPush.getDeviceId()（即 /push/single 的 device_id）。lang 落到设备上。
// 走 register_push_device（SECURITY DEFINER）而非直连 upsert：device_id 跨账号复用，
// 换账号后认领同一台设备的 ON CONFLICT→UPDATE 会因旧归属行不可见而被 RLS 冲突检查拒绝。
export async function upsertPushDevice(deviceId: string, token: string | null, platform: string) {
  if (!deviceId) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { error } = await supabase.rpc('register_push_device', {
    p_device_id: deviceId,
    p_token: token,
    p_platform: platform,
    p_lang: getLang(),
    p_tz_offset: new Date().getTimezoneOffset(),
  });
  if (error) throw error;
}

// 当前家庭的通知偏好（可能没有行 → 返回 null，调用方用默认值）。
export async function fetchNotificationPrefs() {
  const familyId = await getMyFamilyId();
  if (!familyId) return null;
  const { data, error } = await supabase
    .from('notification_preferences').select('*').eq('family_id', familyId).maybeSingle();
  if (error) throw error;
  return data;
}

// 局部更新通知偏好（无行则按 DB 默认建行）。
export async function updateNotificationPrefs(fields: Record<string, any>) {
  const familyId = await getMyFamilyId();
  if (!familyId) throw new Error('no_family');
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({ family_id: familyId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'family_id' })
    .select().single();
  if (error) throw error;
  return data;
}

// 通知模板（全局只读参考文案，RLS 允许任意登录用户读）。开发者工具用于内联预览。
export async function fetchNotificationTemplates(lang?: string, species?: string) {
  let q = supabase.from('notification_templates').select('scene, species, lang, title, body');
  if (lang) q = q.eq('lang', lang);
  if (species) q = q.eq('species', species);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// 开发者工具：把某个 scene 的真实模板作为测试推送发到本机设备（绕过所有护栏）。
// deviceToken 直接传本机 DooPush token，最可靠；返回 { ok, scene, title, content, targets, sent }。
export async function sendTestNotification(opts: {
  scene: string; deviceToken?: string; lang?: string; species?: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-pet-notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      'X-Notify-Secret': process.env.EXPO_PUBLIC_NOTIFY_SECRET ?? '',
    },
    body: JSON.stringify({
      event: 'test',
      scene: opts.scene,
      device_token: opts.deviceToken,
      actor_user_id: session.user.id,
      lang: opts.lang,
      species: opts.species,
    }),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json as { ok: boolean; scene: string; title: string; content: string; targets: number; sent: number };
}

// ── Family（家庭共享）──

// 当前用户的 family_id 缓存：避免每次写入都查一次。切账号/退出时调 clearFamilyCache()。
let _familyIdCache: string | null = null;
export function clearFamilyCache() { _familyIdCache = null; }

export async function getMyFamilyId(): Promise<string | null> {
  if (_familyIdCache) return _familyIdCache;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error || !data) return null;
  _familyIdCache = data.family_id;
  return _familyIdCache;
}

// 拉「我的家」+ 花名册。无家时返回 null。
export async function fetchMyFamily() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: mem } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (!mem) return null;
  const { data: fam } = await supabase
    .from('families')
    .select('id, invite_code, created_by')
    .eq('id', mem.family_id)
    .maybeSingle();
  // 名册走 family_roster RPC：手机号在 auth.users，普通查询读不到他人，SECURITY DEFINER 里脱敏后返回。
  const { data: members } = await supabase.rpc('family_roster');
  return {
    id: mem.family_id,
    inviteCode: fam?.invite_code || '',
    isCreator: fam?.created_by === session.user.id,
    members: (members || []).map(m => ({
      userId: m.user_id, role: m.role, customRole: m.custom_role,
      phone: m.phone_masked || '',
      isMe: m.user_id === session.user.id,
    })),
  };
}

// 建家：返回 { id, inviteCode }
export async function createFamily(role: string, custom = '') {
  const { data, error } = await supabase.rpc('create_family', { p_role: role, p_custom_role: custom });
  if (error) throw error;
  _familyIdCache = null;
  const row = Array.isArray(data) ? data[0] : data;
  return { id: row.family_id, inviteCode: row.invite_code };
}

// 加入：返回 family_id；错误码 invalid_code / already_in_family
export async function joinFamily(code: string, role: string, custom = '') {
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: code, p_role: role, p_custom_role: custom });
  if (error) throw error;
  _familyIdCache = null;
  return data as string;
}

export async function peekInvite(code: string): Promise<{ familyId: string; roles: string[] }> {
  const { data, error } = await supabase.rpc('peek_invite', { p_code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { familyId: row.family_id, roles: row.roles || [] };
}

export async function leaveFamily() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('no_session');
  const fid = await getMyFamilyId();
  if (!fid) return;
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('family_id', fid)
    .eq('user_id', session.user.id);
  if (error) throw error;
  _familyIdCache = null;
}

// 创建者移除成员
export async function removeFamilyMember(userId: string) {
  const fid = await getMyFamilyId();
  if (!fid) throw new Error('no_family');
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('family_id', fid)
    .eq('user_id', userId);
  if (error) throw error;
}

// ── Derived helper functions (accept data as params) ──

export function getKidFrom(kids, id) {
  return kids.find(k => k.id === id) || FAMILY;
}

export function kidLabelFrom(kids, id) {
  return id === 'all' ? FAMILY.name : getKidFrom(kids, id).name;
}

export function kidDoneFrom(memories, id) {
  const list = id === 'all' ? memories : memories.filter(m => m.kid === id || m.kid === 'all');
  return new Set(list.map(m => m.levelNum)).size;
}

export function memoriesForKidFrom(memories, id) {
  if (id === 'all') return memories;
  return memories.filter(m => m.kid === id || m.kid === 'all');
}

export function memoriesForLevelFrom(memories, levelNum) {
  return memories
    .filter(m => m.levelNum === levelNum)
    .sort((a, b) => {
      if (a.date !== b.date) return b.date > a.date ? 1 : -1;
      const ca = a.createdAt || '';
      const cb = b.createdAt || '';
      return cb > ca ? 1 : cb < ca ? -1 : 0;
    });
}

export function yearFromDate(dateStr) {
  const iso = dateStr?.match(/^(\d{4})/);
  return iso ? parseInt(iso[1], 10) : null;
}

export function monthFromDate(dateStr) {
  const m = dateStr?.match(/^\d{4}-(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

export function dayFromDate(dateStr) {
  const m = dateStr?.match(/^\d{4}-\d{2}-(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

export function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const MONTH_EN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function kidAgeAtYear(kid, year) {
  if (!kid || kid.id === 'all' || !kid.y) return null;
  return Math.max(0, year - kid.y);
}

/* ── 封存 ── */

// 开发者工具的「忽略解封时间」开关：开启后所有已封存记录都视为可开启——仅 __DEV__ 生效、
// 不改数据、可逆。由 DevToolsSheet 切换、DataProvider 启动时从 AsyncStorage 恢复；键名共享给两处。
export const SEAL_TEST_UNLOCK_KEY = '100m.dev_seal_unlock_all';
let __sealTestUnlockAll = false;
export function setSealTestUnlockAll(on: boolean) { __sealTestUnlockAll = !!on; }
export function getSealTestUnlockAll() { return __sealTestUnlockAll; }

// 这条记录此刻是否处于"封存锁定"（封存了且还没到约定日期）
export function isMemoryLocked(mem) {
  if (!(mem && mem.sealed && mem.sealUntil)) return false;
  if (__DEV__ && __sealTestUnlockAll) return false; // 开发者工具：忽略解封时间，全部视为可开启
  return Date.now() < new Date(mem.sealUntil).getTime();
}

// 封存了且已到期（可以打开了）
export function isMemoryUnsealed(mem) {
  if (!(mem && mem.sealed && mem.sealUntil)) return false;
  if (__DEV__ && __sealTestUnlockAll) return true; // 开发者工具：忽略解封时间
  return Date.now() >= new Date(mem.sealUntil).getTime();
}

// 某个孩子（或全家）当前仍锁定的封存记录
export function sealedLockedFrom(memories, kidId = 'all') {
  return memories.filter(m => isMemoryLocked(m) && (kidId === 'all' || m.kid === kidId || m.kid === 'all'));
}

// 某个孩子（或全家）所有封存记录（仍锁定 + 已到期可打开）。
// 没有“已开启”状态，所以这就是用户心里“封存了几样东西”的真实数量。
export function sealedAllFrom(memories, kidId = 'all') {
  return memories.filter(m => m && m.sealed && m.sealUntil && (kidId === 'all' || m.kid === kidId || m.kid === 'all'));
}

// 根据可封存活动 + 孩子算到期日与展示文案。
// age18：孩子生日(年+月) + 18 年；返回 null 表示需要 UI 进一步处理（如未指定具体孩子）。
export function sealDateFor(level, kid) {
  if (level?.sealKind === 'age18') {
    if (!kid || kid.id === 'all' || kid.y == null) return null;
    const until = new Date(kid.y + 18, (kid.m || 1) - 1, 1);
    return { sealUntil: until.toISOString(), sealLabel: t('seal.age18Label', { name: kid.name }) };
  }
  return null; // 'date' 类由 UI 选完年月后调 makeSealDate
}

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// 由用户选的年/月构造到期日与文案（time capsule 等）。
// sealLabel 是创建时按当前语言生成并存进 DB 的快照，之后不随语言切换重写。
export function makeSealDate(y, m, d = 1) {
  const sealLabel = t('seal.dateLabel', { y, m, d, mon: MONTHS_EN[m - 1] });
  return { sealUntil: new Date(y, m - 1, d).toISOString(), sealLabel };
}

export function allLevelsFrom(customLevels, levels) {
  return [...customLevels, ...levels];
}

export function throwbackFrom(memories, kidId = 'all') {
  const list = kidId === 'all' ? memories : memories.filter(m => m.kid === kidId || m.kid === 'all');
  if (list.length < 2) return null;
  const m = list[list.length - 1];
  return { m, label: t('throwback.label'), sub: t('throwback.sub') };
}

const LEVEL_AGE = { '12': 6, '04': 4, '17': 5, '31': 5, '23': 4 };

export function levelWeightFrom(kids, l, kid) {
  let w = 1;
  const ctx = nowCtx();
  if (l.custom) w *= 2.4;
  if (l.seasonal) w *= 2.0;
  const minA = LEVEL_AGE[l.num];
  const age = kid && kid !== 'all' ? kidAge(getKidFrom(kids, kid)) : null;
  if (minA != null && age != null && age < minA) w *= 0.3;
  if ((ctx.slot === 'evening' || ctx.slot === 'night') && (l.suggest === 'voice' || l.suggest === 'text')) w *= 1.5;
  if ((ctx.weekend || ctx.slot === 'afternoon') && l.suggest === 'photo') w *= 1.4;
  return w;
}

// 稳定伪随机：同一 (seed, key) 永远得到同一个 [0,1) 值。
// 用它替代 Math.random()，这样数据静默重载（refresh 换数组引用）时洗牌顺序不乱跳，
// 只有 seed 改变（用户主动换一批）才会得到一套新顺序。
function hashStr(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededUnit(seed, key) {
  let h = (hashStr(key) ^ Math.imul(seed | 0, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

// seed 省略（0）时退回 Math.random()，保持老行为；HomeFeed 传 shuffleKey 让顺序稳定
export function weightedShuffleFrom(kids, arr, kid, seed = 0) {
  return arr
    .map(l => {
      const r = seed ? seededUnit(seed, `${l.perspective}|${l.num}`) : Math.random();
      return { l, k: Math.pow(r, 1 / Math.max(0.0001, levelWeightFrom(kids, l, kid))) };
    })
    .sort((a, b) => b.k - a.k)
    .map(x => x.l);
}

export function frameLabelFrom(kids, perspective, kidId, meLabel = t('role.parentFallback')) {
  if (perspective === 'together' || kidId === 'all') return PERSPECTIVES[perspective].long;
  const name = getKidFrom(kids, kidId).name;
  if (perspective === 'parent') return `${meLabel} → ${name}`;
  if (perspective === 'child') return `${name} → ${meLabel}`;
  return PERSPECTIVES[perspective].long;
}

export function yearReviewFrom(memories, kidId = 'all') {
  const list = kidId === 'all' ? memories : memories.filter(m => m.kid === kidId || m.kid === 'all');
  const byP = { parent: 0, child: 0, together: 0 };
  const byType = { voice: 0, photo: 0, text: 0, video: 0 };
  const places = {};
  list.forEach(m => {
    byP[m.perspective] = (byP[m.perspective] || 0) + 1;
    byType[m.type] = (byType[m.type] || 0) + 1;
    if (m.place && !isMemoryLocked(m)) places[m.place] = (places[m.place] || 0) + 1; // 封存中不泄露地点
  });
  const top = Object.entries(places).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  return {
    total: list.length, byP, byType,
    voiceCount: byType.voice,
    topPlace: top ? top[0] : null,
    firstTitle: list.length ? list[list.length - 1].title : null,
    lastTitle: list.length ? list[0].title : null,
  };
}
