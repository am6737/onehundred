import { supabaseAdmin } from '@/lib/supabase-admin';
import { KpiCard } from '@/components/kpi-card';
import { DashboardCharts } from '@/components/dashboard-charts';
import type { TrendPoint } from '@/components/dashboard-charts';

// Week-over-week % change: last 7 days of new items vs the prior 7 days.
function wowDelta(trend: TrendPoint[]): number | null {
  if (!trend || trend.length < 14) return null;
  const last7 = trend.slice(-7).reduce((s, p) => s + p.count, 0);
  const prev7 = trend.slice(-14, -7).reduce((s, p) => s + p.count, 0);
  if (prev7 === 0) return null;
  return ((last7 - prev7) / prev7) * 100;
}

function groupByDate(timestamps: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ts of timestamps) {
    const date = ts.split('T')[0];
    counts[date] = (counts[date] ?? 0) + 1;
  }
  return counts;
}

function fillDateRange(end: Date, days: number, counts: Record<string, number>): TrendPoint[] {
  const result: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    result.push({ date: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, count: counts[key] ?? 0 });
  }
  return result;
}

async function getDashboardData() {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayISO = todayStart.toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // All queries in parallel via nested Promise.all (all fire at once)
  const [statsGroup, distGroup, trendGroup] = await Promise.all([
    Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
      supabaseAdmin.from('families').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('families').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
      supabaseAdmin.from('memories').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('memories').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
      supabaseAdmin.from('kids').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('memories').select('family_id').gte('created_at', sevenDaysAgo),
    ] as const),
    Promise.all([
      supabaseAdmin.from('memories').select('*', { count: 'exact', head: true }).eq('type', 'photo'),
      supabaseAdmin.from('memories').select('*', { count: 'exact', head: true }).eq('type', 'voice'),
      supabaseAdmin.from('memories').select('*', { count: 'exact', head: true }).eq('type', 'video'),
      supabaseAdmin.from('memories').select('*', { count: 'exact', head: true }).eq('type', 'text'),
      supabaseAdmin.from('memories').select('*', { count: 'exact', head: true }).eq('perspective', 'parent'),
      supabaseAdmin.from('memories').select('*', { count: 'exact', head: true }).eq('perspective', 'child'),
      supabaseAdmin.from('memories').select('*', { count: 'exact', head: true }).eq('perspective', 'together'),
      supabaseAdmin.from('notification_outbox').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('notification_outbox').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      supabaseAdmin.from('notification_outbox').select('*', { count: 'exact', head: true }).eq('status', 'done'),
      supabaseAdmin.from('notification_outbox').select('*', { count: 'exact', head: true }).eq('status', 'dead'),
    ] as const),
    Promise.all([
      supabaseAdmin.from('profiles').select('created_at').gte('created_at', thirtyDaysAgo),
      supabaseAdmin.from('memories').select('created_at').gte('created_at', thirtyDaysAgo),
    ] as const),
  ]);

  const [
    usersTotal, usersToday, familiesTotal, familiesToday,
    memoriesTotal, memoriesToday, kidsTotal, recentMems,
  ] = statsGroup;

  const [
    photoMems, voiceMems, videoMems, textMems,
    parentMems, childMems, togetherMems,
    outboxPending, outboxProc, outboxDone, outboxDead,
  ] = distGroup;

  const [profileDates, memoryDates] = trendGroup;

  const activeFamilies = new Set(recentMems.data?.map((m) => m.family_id) ?? []).size;

  const userCounts = groupByDate(profileDates.data?.map((p) => p.created_at) ?? []);
  const memoryCounts = groupByDate(memoryDates.data?.map((m) => m.created_at) ?? []);

  return {
    stats: {
      totalUsers: usersTotal.count ?? 0,
      todayUsers: usersToday.count ?? 0,
      totalFamilies: familiesTotal.count ?? 0,
      todayFamilies: familiesToday.count ?? 0,
      totalMemories: memoriesTotal.count ?? 0,
      todayMemories: memoriesToday.count ?? 0,
      totalKids: kidsTotal.count ?? 0,
      activeFamilies,
    },
    charts: {
      userTrend7: fillDateRange(now, 7, userCounts),
      userTrend30: fillDateRange(now, 30, userCounts),
      memoryTrend7: fillDateRange(now, 7, memoryCounts),
      memoryTrend30: fillDateRange(now, 30, memoryCounts),
      typeDistribution: [
        { name: 'photo', value: photoMems.count ?? 0 },
        { name: 'voice', value: voiceMems.count ?? 0 },
        { name: 'video', value: videoMems.count ?? 0 },
        { name: 'text', value: textMems.count ?? 0 },
      ].filter((d) => d.value > 0),
      perspectiveDistribution: [
        { name: 'parent', value: parentMems.count ?? 0 },
        { name: 'child', value: childMems.count ?? 0 },
        { name: 'together', value: togetherMems.count ?? 0 },
      ].filter((d) => d.value > 0),
      outboxDistribution: [
        { name: 'pending', value: outboxPending.count ?? 0 },
        { name: 'processing', value: outboxProc.count ?? 0 },
        { name: 'done', value: outboxDone.count ?? 0 },
        { name: 'dead', value: outboxDead.count ?? 0 },
      ].filter((d) => d.value > 0),
    },
  };
}

export default async function DashboardPage() {
  const { stats, charts } = await getDashboardData();

  const statCards = [
    {
      label: '注册用户',
      value: stats.totalUsers,
      delta: wowDelta(charts.userTrend30),
      hint: `今日新增 +${stats.todayUsers}`,
    },
    {
      label: '家庭数量',
      value: stats.totalFamilies,
      delta: null,
      hint: `今日新增 +${stats.todayFamilies}`,
    },
    {
      label: '记录总数',
      value: stats.totalMemories,
      delta: wowDelta(charts.memoryTrend30),
      hint: `今日新增 +${stats.todayMemories}`,
    },
    {
      label: '孩子数量',
      value: stats.totalKids,
      delta: null,
      hint: undefined,
    },
    {
      label: '7日活跃家庭',
      value: stats.activeFamilies,
      delta: null,
      hint: undefined,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">仪表盘</h1>
        <p className="mt-1 text-sm text-muted-foreground">关键指标总览</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => (
          <KpiCard
            key={card.label}
            label={card.label}
            value={card.value}
            delta={card.delta}
            hint={card.hint}
          />
        ))}
      </div>

      <DashboardCharts charts={charts} />
    </div>
  );
}
