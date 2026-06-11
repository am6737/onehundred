/* ════════════════════════════════════════════════════════════
   一百件事 — data layer (Supabase-backed)
   ════════════════════════════════════════════════════════════ */

import { supabase } from '../lib/supabase';

// ── Pure constants (no DB dependency) ──

export const PERSPECTIVES = {
  parent:   { key: 'parent',   label: '为你', long: '家长 → 孩子', hint: '我想为孩子做的事' },
  child:    { key: 'child',    label: '为我', long: '孩子 → 家长', hint: '孩子想为我做的事' },
  together: { key: 'together', label: '一起', long: '一起做',      hint: '我们一起完成的事' },
};

export const FAMILY = { id: 'all', name: '全家', tone: 'pink' };

export const ROLES = ['爸爸', '妈妈', '爷爷', '奶奶', '外公', '外婆'];
export const DEFAULT_ME = { role: '爸爸', custom: '' };

export const NOW_YM = { y: 2026, m: 6 };

export const PET_BODY = 3;

// ── Pure functions (no DB dependency) ──

export function meName(me) {
  if (!me) return '家长';
  return me.role === '其他' ? (me.custom || '我') : me.role;
}

export function meChar(me) {
  const n = meName(me);
  return (me && me.role !== '其他') ? n[n.length - 1] : n[0];
}

export function durationSince(sinceStr) {
  const match = sinceStr && sinceStr.match(/(\d+)\s*年\s*(\d+)\s*月/);
  if (!match) return '';
  const startY = parseInt(match[1], 10);
  const startM = parseInt(match[2], 10);
  const now = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1;
  const nowD = now.getDate();
  let years = nowY - startY;
  let months = nowM - startM;
  let days = nowD - 1;
  if (days < 0) {
    months--;
    days += new Date(nowY, nowM - 1, 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  const parts = [];
  if (years > 0) parts.push(`${years} 年`);
  if (months > 0) parts.push(`${months} 个月`);
  if (days > 0) parts.push(`${days} 天`);
  return parts.join(' ') || '1 天';
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
  if (l.custom) return '你们家自己的事';
  if (l.seasonal && (ctx.season === 'spring' || ctx.season === 'summer')) return '这个季节正合适';
  if ((ctx.slot === 'evening' || ctx.slot === 'night') && (l.suggest === 'voice' || l.suggest === 'text')) return '安静的晚上，适合慢慢说';
  if (ctx.weekend && l.suggest === 'photo') return '周末，适合出门做';
  if (ctx.slot === 'afternoon' && l.suggest === 'photo') return '光线正好，适合拍';
  return null;
}

// ── DB → JS column mappers ──

function mapLevel(row) {
  return {
    num: row.num, perspective: row.perspective, tone: row.tone,
    title: row.title, why: row.why, how: row.how, record: row.record,
    suggest: row.suggest, sealed: row.sealed, sealUntil: row.seal_until,
    sealedOn: row.sealed_on, seasonal: row.seasonal, kid: row.kid,
  };
}

function mapMemory(row) {
  return {
    id: row.id, kid: row.kid_id, levelNum: row.level_num,
    perspective: row.perspective, type: row.type, dur: row.duration,
    shots: row.shots, date: row.date, place: row.place, title: row.title,
    caption: row.caption, transcript: row.transcript, tone: row.tone,
  };
}

function mapKid(row) {
  return {
    id: row.id, name: row.name, y: row.birth_year, m: row.birth_month,
    tone: row.tone, bear: row.bear, since: row.since, acc: row.accessories,
  };
}

function mapMascot(row) {
  return {
    kid: row.kid_id, name: row.name, tone: row.tone, since: row.since,
    stage: row.stage, grown: row.grown, items: row.items, log: row.log,
  };
}

function mapCustomLevel(row) {
  return {
    num: row.num, perspective: row.perspective, tone: row.tone, custom: true,
    title: row.title, why: row.why, how: row.how, record: row.record_hint,
    suggest: row.suggest,
  };
}

function mapWardrobe(row) {
  return { id: row.id, name: row.name, slot: row.slot, at: row.at, line: row.line };
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

export async function fetchMascots() {
  const { data, error } = await supabase.from('mascots').select('*');
  if (error) throw error;
  const obj = {};
  (data || []).forEach(row => { obj[row.kid_id] = mapMascot(row); });
  return obj;
}

export async function fetchWardrobe() {
  const { data, error } = await supabase.from('wardrobe').select('*').order('at');
  if (error) throw error;
  return (data || []).map(mapWardrobe);
}

export async function fetchCustomLevels() {
  const { data, error } = await supabase.from('custom_levels').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapCustomLevel);
}

export async function insertCustomLevel({ title, why = '', perspective = 'together', tone = 'pink', suggest = 'photo' }) {
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
    why: why || '这是你们家自己的事，记下来就不会忘。',
    how: '', record_hint: '',
  }).select().single();
  if (error) throw error;
  return mapCustomLevel(data);
}

export async function insertMemory({ id: givenId, kid, levelNum, perspective, type, dur, shots, date, place, title, caption, transcript, tone }) {
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
  }).select().single();
  if (error) throw error;
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
  } catch (e) {
    console.warn('deleteMemory storage cleanup:', e?.message || e);
  }
}

export async function insertKid({ name, y, m, tone = 'orange' }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const familyId = await getMyFamilyId();
  if (!familyId) throw new Error('no_family');
  const id = 'k' + Date.now();
  const { data, error } = await supabase.from('kids').insert({
    id,
    family_id: familyId,
    user_id: session.user.id,
    name,
    birth_year: y,
    birth_month: m,
    tone,
    bear: '',
    since: '',
    accessories: ['scarf'],
  }).select().single();
  if (error) throw error;
  return mapKid(data);
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
  const { data: members } = await supabase
    .from('family_members')
    .select('user_id, role, custom_role, joined_at')
    .eq('family_id', mem.family_id)
    .order('joined_at');
  return {
    id: mem.family_id,
    inviteCode: fam?.invite_code || '',
    isCreator: fam?.created_by === session.user.id,
    members: (members || []).map(m => ({
      userId: m.user_id, role: m.role, customRole: m.custom_role,
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
  if (id === 'all') return memories.length;
  return memories.filter(m => m.kid === id || m.kid === 'all').length;
}

export function memoriesForKidFrom(memories, id) {
  if (id === 'all') return memories;
  return memories.filter(m => m.kid === id || m.kid === 'all');
}

export function allLevelsFrom(customLevels, levels) {
  return [...customLevels, ...levels];
}

export function getMascotFrom(mascots, id) {
  return mascots[id] || mascots[Object.keys(mascots)[0]] || { kid: id, name: '', tone: 'orange', since: '', stage: 1, grown: 0, items: [], log: [] };
}

export function wardrobeStateFrom(wardrobe, done) {
  return wardrobe.map(w => ({ ...w, got: done >= w.at }));
}

export function nextUnlockFrom(wardrobe, done) {
  const next = wardrobe.find(w => done < w.at) || null;
  const unlocked = wardrobe.filter(w => done >= w.at).length;
  if (!next) return { next: null, remain: 0, ratio: 1, unlocked, total: wardrobe.length };
  const prevAt = [...wardrobe].reverse().find(w => done >= w.at)?.at || 0;
  const span = next.at - prevAt || 1;
  return { next, remain: next.at - done, ratio: Math.min(1, (done - prevAt) / span), unlocked, total: wardrobe.length };
}

export function throwbackFrom(memories, kidId = 'all') {
  const list = kidId === 'all' ? memories : memories.filter(m => m.kid === kidId || m.kid === 'all');
  if (list.length < 2) return null;
  const m = list[list.length - 1];
  return { m, label: '去年的这个时候', sub: '你们一起做的第 1 件事' };
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

export function weightedShuffleFrom(kids, arr, kid) {
  return arr
    .map(l => ({ l, k: Math.pow(Math.random(), 1 / Math.max(0.0001, levelWeightFrom(kids, l, kid))) }))
    .sort((a, b) => b.k - a.k)
    .map(x => x.l);
}

export function frameLabelFrom(kids, perspective, kidId, meLabel = '家长') {
  if (perspective === 'together' || kidId === 'all') return PERSPECTIVES[perspective].long;
  const name = getKidFrom(kids, kidId).name;
  if (perspective === 'parent') return `${meLabel} → ${name}`;
  if (perspective === 'child') return `${name} → ${meLabel}`;
  return PERSPECTIVES[perspective].long;
}

export function yearReviewFrom(memories, mascots, wardrobe, kidId = 'all') {
  const list = kidId === 'all' ? memories : memories.filter(m => m.kid === kidId || m.kid === 'all');
  const byP = { parent: 0, child: 0, together: 0 };
  const byType = { voice: 0, photo: 0, text: 0, video: 0 };
  const places = {};
  list.forEach(m => {
    byP[m.perspective] = (byP[m.perspective] || 0) + 1;
    byType[m.type] = (byType[m.type] || 0) + 1;
    if (m.place) places[m.place] = (places[m.place] || 0) + 1;
  });
  const top = Object.entries(places).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  const doneCount = kidId === 'all' ? memories.length : list.length;
  const mascot = kidId === 'all' ? mascots[Object.keys(mascots)[0]] : (mascots[kidId] || { grown: 0 });
  return {
    total: list.length, byP, byType,
    voiceCount: byType.voice,
    topPlace: top ? top[0] : null,
    grown: mascot?.grown || 0,
    unlocked: nextUnlockFrom(wardrobe, mascot?.grown || 0).unlocked,
    firstTitle: list.length ? list[list.length - 1].title : null,
    lastTitle: list.length ? list[0].title : null,
  };
}
