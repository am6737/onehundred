import { supabaseAdmin } from '@/lib/supabase-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GrowthChart, TimeRangePicker, CsvDownloadButton } from '@/components/analytics-charts';
import { exportGrowthCsv } from '../_actions';
import type { GrowthPoint } from '@/components/analytics-charts';

async function getGrowthData(days: number) {
  const since =
    days > 0
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() - days);
          return d.toISOString().slice(0, 10);
        })()
      : null;

  let query = supabaseAdmin
    .from('mv_daily_users')
    .select('day, new_users')
    .order('day', { ascending: true });
  if (since) query = query.gte('day', since);

  const { data: rows } = await query;

  // Cumulative baseline: users registered before the window
  let cumulativeBase = 0;
  if (since) {
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', since);
    cumulativeBase = count ?? 0;
  }

  let cumulative = cumulativeBase;
  const growthData: GrowthPoint[] = (rows ?? []).map((row) => {
    cumulative += row.new_users;
    return {
      date: row.day.slice(5),
      daily: row.new_users,
      cumulative,
    };
  });

  // Summary stats
  const totalNewInPeriod = (rows ?? []).reduce((s, r) => s + r.new_users, 0);
  const peakDay = (rows ?? []).reduce<{ day: string; count: number } | null>(
    (max, r) => (max === null || r.new_users > max.count ? { day: r.day, count: r.new_users } : max),
    null
  );
  const avgPerDay = rows && rows.length > 0 ? Math.round(totalNewInPeriod / rows.length) : 0;

  return { growthData, totalNewInPeriod, peakDay, avgPerDay, finalCumulative: cumulative };
}

export default async function GrowthPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysStr } = await searchParams;
  const days = Math.max(0, Number(daysStr ?? 90));
  const { growthData, totalNewInPeriod, peakDay, avgPerDay, finalCumulative } =
    await getGrowthData(days);

  const exportAction = exportGrowthCsv.bind(null, days);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户增长</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            注册用户日增量与累计趋势
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TimeRangePicker current={days} />
          <CsvDownloadButton action={exportAction} filename="user-growth.csv" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">期间新增用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalNewInPeriod.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">当前累计用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{finalCumulative.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">日均新增</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgPerDay.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">峰值单日</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{peakDay?.count ?? 0}</div>
            {peakDay && (
              <div className="mt-1 text-xs text-muted-foreground">{peakDay.day}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <GrowthChart data={growthData} />
    </div>
  );
}
