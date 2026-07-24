import { supabaseAdmin } from '@/lib/supabase-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Home, FileText, Baby } from 'lucide-react';
import { TimeRangePicker, DualTrendChart } from '@/components/analytics-charts';
import { CsvDownloadButton } from '@/components/analytics-charts';
import { exportOverviewCsv } from './_actions';
import type { DualTrendPoint } from '@/components/analytics-charts';

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function getOverviewData(days: number) {
  const since = days > 0 ? daysAgoIso(days) : null;

  const [usersTotal, familiesTotal, memoriesTotal, kidsTotal, usersPeriod, familiesPeriod, memoriesPeriod, activeFamiliesPeriod] =
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
      since
        ? supabaseAdmin.from('memories').select('family_id').gte('created_at', since)
        : supabaseAdmin.from('memories').select('family_id'),
    ]);

  const activeFamilies = new Set((activeFamiliesPeriod.data ?? []).map((m) => m.family_id)).size;

  // Trend chart: use mv_daily_users + mv_daily_stats for the period
  const trendSince = daysAgoIso(Math.min(days || 30, 30));
  const [userTrend, memTrend] = await Promise.all([
    supabaseAdmin.from('mv_daily_users').select('day, new_users').gte('day', trendSince.slice(0, 10)).order('day', { ascending: true }),
    supabaseAdmin.from('mv_daily_stats').select('day, new_memories').gte('day', trendSince.slice(0, 10)).order('day', { ascending: true }),
  ]);

  const userByDay = new Map((userTrend.data ?? []).map((r) => [r.day, r.new_users]));
  const memByDay = new Map((memTrend.data ?? []).map((r) => [r.day, r.new_memories]));
  const allDays = [...new Set([...userByDay.keys(), ...memByDay.keys()])].sort();
  const trendData: DualTrendPoint[] = allDays.map((day) => ({
    date: day.slice(5),
    users: userByDay.get(day) ?? 0,
    memories: memByDay.get(day) ?? 0,
  }));

  return {
    totals: {
      users: usersTotal.count ?? 0,
      families: familiesTotal.count ?? 0,
      memories: memoriesTotal.count ?? 0,
      kids: kidsTotal.count ?? 0,
    },
    period: {
      users: usersPeriod.count ?? 0,
      families: familiesPeriod.count ?? 0,
      memories: memoriesPeriod.count ?? 0,
      activeFamilies,
    },
    trendData,
  };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysStr } = await searchParams;
  const days = Math.max(0, Number(daysStr ?? 30));
  const { totals, period, trendData } = await getOverviewData(days);
  const periodLabel = days === 0 ? '全部时间' : `最近 ${days} 天`;

  const exportAction = exportOverviewCsv.bind(null, days);

  const totalCards = [
    { title: '总用户数', value: totals.users, icon: Users },
    { title: '总家庭数', value: totals.families, icon: Home },
    { title: '总记录数', value: totals.memories, icon: FileText },
    { title: '总孩子数', value: totals.kids, icon: Baby },
  ];

  const periodCards = [
    { title: `新增用户`, value: period.users },
    { title: `新增家庭`, value: period.families },
    { title: `新增记录`, value: period.memories },
    { title: `活跃家庭`, value: period.activeFamilies },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">数据统计概览</h1>
        <CsvDownloadButton action={exportAction} filename="analytics-overview.csv" />
      </div>

      {/* All-time totals */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">全部时间总计</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {totalCards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{card.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Period stats with time range picker */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">{periodLabel}</h2>
          <TimeRangePicker current={days} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {periodCards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{card.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Trend chart */}
      <DualTrendChart data={trendData} />
    </div>
  );
}
