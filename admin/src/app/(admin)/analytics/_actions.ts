'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';

function daysAgoIso(days: number): string | null {
  if (days === 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ─── Overview CSV ─────────────────────────────────────────────────────────────

export async function exportOverviewCsv(days: number): Promise<string> {
  const since = daysAgoIso(days);
  const [usersTotal, familiesTotal, memoriesTotal, kidsTotal, usersPeriod, familiesPeriod, memoriesPeriod] =
    await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('families').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('memories').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('kids').select('*', { count: 'exact', head: true }),
      since
        ? supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since)
        : supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      since
        ? supabaseAdmin.from('families').select('*', { count: 'exact', head: true }).gte('created_at', since)
        : supabaseAdmin.from('families').select('*', { count: 'exact', head: true }),
      since
        ? supabaseAdmin.from('memories').select('*', { count: 'exact', head: true }).gte('created_at', since)
        : supabaseAdmin.from('memories').select('*', { count: 'exact', head: true }),
    ]);

  const period = days === 0 ? '全部' : `最近${days}天`;
  const rows = [
    ['指标', '数值'],
    ['总用户数', usersTotal.count ?? 0],
    ['总家庭数', familiesTotal.count ?? 0],
    ['总记录数', memoriesTotal.count ?? 0],
    ['总孩子数', kidsTotal.count ?? 0],
    [`新增用户(${period})`, usersPeriod.count ?? 0],
    [`新增家庭(${period})`, familiesPeriod.count ?? 0],
    [`新增记录(${period})`, memoriesPeriod.count ?? 0],
  ];
  return rows.map((r) => r.join(',')).join('\n');
}

// ─── Growth CSV ───────────────────────────────────────────────────────────────

export async function exportGrowthCsv(days: number): Promise<string> {
  const since = daysAgoIso(days);
  let query = supabaseAdmin.from('mv_daily_users').select('day, new_users').order('day', { ascending: true });
  if (since) query = query.gte('day', since.slice(0, 10));

  const { data: rows } = await query;

  // Compute cumulative baseline
  let cumulativeBase = 0;
  if (since) {
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', since);
    cumulativeBase = count ?? 0;
  }

  let cumulative = cumulativeBase;
  const lines = [['日期', '每日新增', '累计用户']];
  for (const row of rows ?? []) {
    cumulative += row.new_users;
    lines.push([row.day, String(row.new_users), String(cumulative)]);
  }
  return lines.map((r) => r.join(',')).join('\n');
}

// ─── Retention CSV ────────────────────────────────────────────────────────────

export async function exportRetentionCsv(): Promise<string> {
  const [profilesRes, memoriesRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, created_at').order('created_at', { ascending: true }),
    supabaseAdmin.from('memories').select('user_id, created_at').not('user_id', 'is', null),
  ]);

  const profiles = profilesRes.data ?? [];
  const memories = memoriesRes.data ?? [];

  const memMap = new Map<string, number[]>();
  for (const m of memories) {
    if (!m.user_id) continue;
    if (!memMap.has(m.user_id)) memMap.set(m.user_id, []);
    memMap.get(m.user_id)!.push(new Date(m.created_at).getTime());
  }

  const cohortMap = new Map<string, typeof profiles>();
  for (const p of profiles) {
    const month = p.created_at.slice(0, 7);
    if (!cohortMap.has(month)) cohortMap.set(month, []);
    cohortMap.get(month)!.push(p);
  }

  const DAY_MS = 86400000;
  const now = Date.now();

  function retained(userId: string, regMs: number, daysN: number): boolean {
    const mems = memMap.get(userId) ?? [];
    return mems.some((t) => t >= regMs && t <= regMs + daysN * DAY_MS);
  }

  const lines = [['注册月份', '用户数', 'D1留存', 'D7留存', 'D30留存']];
  for (const [month, users] of [...cohortMap.entries()].sort()) {
    const ageDays = (now - new Date(month + '-01').getTime()) / DAY_MS;
    if (ageDays < 1) continue;
    const d1 = ageDays >= 2 ? users.filter((u) => retained(u.id, new Date(u.created_at).getTime(), 1)).length / users.length : null;
    const d7 = ageDays >= 8 ? users.filter((u) => retained(u.id, new Date(u.created_at).getTime(), 7)).length / users.length : null;
    const d30 = ageDays >= 31 ? users.filter((u) => retained(u.id, new Date(u.created_at).getTime(), 30)).length / users.length : null;
    lines.push([
      month,
      String(users.length),
      d1 !== null ? `${(d1 * 100).toFixed(1)}%` : '—',
      d7 !== null ? `${(d7 * 100).toFixed(1)}%` : '—',
      d30 !== null ? `${(d30 * 100).toFixed(1)}%` : '—',
    ]);
  }
  return lines.map((r) => r.join(',')).join('\n');
}

// ─── Content CSV ──────────────────────────────────────────────────────────────

export async function exportContentCsv(days: number): Promise<string> {
  const since = daysAgoIso(days);
  let query = supabaseAdmin.from('memories').select('created_at, type, perspective').order('created_at', { ascending: true });
  if (since) query = query.gte('created_at', since);

  const { data: mems } = await query;

  const dayMap = new Map<string, { photo: number; voice: number; video: number; text: number; parent: number; child: number; together: number }>();
  for (const m of mems ?? []) {
    const day = m.created_at.slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, { photo: 0, voice: 0, video: 0, text: 0, parent: 0, child: 0, together: 0 });
    const entry = dayMap.get(day)!;
    if (m.type in entry) (entry as Record<string, number>)[m.type]++;
    if (m.perspective in entry) (entry as Record<string, number>)[m.perspective]++;
  }

  const lines = [['日期', '照片', '语音', '视频', '文字', '父母视角', '孩子视角', '共同记录']];
  for (const [day, e] of [...dayMap.entries()].sort()) {
    lines.push([day, String(e.photo), String(e.voice), String(e.video), String(e.text), String(e.parent), String(e.child), String(e.together)]);
  }
  return lines.map((r) => r.join(',')).join('\n');
}

// ─── Push CSV ─────────────────────────────────────────────────────────────────

export async function exportPushCsv(days: number): Promise<string> {
  const since = daysAgoIso(days);
  let query = supabaseAdmin.from('notification_log').select('scene, clicked');
  if (since) query = query.gte('sent_at', since);

  const { data: logs } = await query;

  const sceneMap = new Map<string, { total: number; clicked: number }>();
  for (const log of logs ?? []) {
    if (!sceneMap.has(log.scene)) sceneMap.set(log.scene, { total: 0, clicked: 0 });
    const s = sceneMap.get(log.scene)!;
    s.total++;
    if (log.clicked) s.clicked++;
  }

  const lines = [['场景', '发送量', '点击量', '点击率']];
  for (const [scene, d] of [...sceneMap.entries()].sort((a, b) => b[1].total - a[1].total)) {
    const rate = d.total > 0 ? `${Math.round((d.clicked / d.total) * 100)}%` : '0%';
    lines.push([scene, String(d.total), String(d.clicked), rate]);
  }
  return lines.map((r) => r.join(',')).join('\n');
}

// ─── Invites CSV ──────────────────────────────────────────────────────────────

export async function exportInvitesCsv(): Promise<string> {
  const [tokensRes, openedRes, memTokensRes] = await Promise.all([
    supabaseAdmin.from('invite_tokens').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('invite_tokens').select('*', { count: 'exact', head: true }).not('opened_at', 'is', null),
    supabaseAdmin.from('memories').select('invite_token_id').not('invite_token_id', 'is', null),
  ]);

  const total = tokensRes.count ?? 0;
  const opened = openedRes.count ?? 0;
  const completed = new Set((memTokensRes.data ?? []).map((m) => m.invite_token_id).filter(Boolean)).size;

  const lines = [
    ['阶段', '数量', '转化率'],
    ['创建邀请', String(total), '100%'],
    ['打开链接', String(opened), total > 0 ? `${Math.round((opened / total) * 100)}%` : '0%'],
    ['完成记录', String(completed), total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%'],
  ];
  return lines.map((r) => r.join(',')).join('\n');
}
