import { supabaseAdmin } from '@/lib/supabase-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RetentionTable, RetentionLineChart, CsvDownloadButton } from '@/components/analytics-charts';
import { exportRetentionCsv } from '../_actions';
import type { CohortRow } from '@/components/analytics-charts';

const DAY_MS = 86400000;

async function getRetentionData(): Promise<CohortRow[]> {
  const [profilesRes, memoriesRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, created_at')
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('memories')
      .select('user_id, created_at')
      .not('user_id', 'is', null),
  ]);

  const profiles = profilesRes.data ?? [];
  const memories = memoriesRes.data ?? [];

  // Build user -> memory timestamps map
  const memMap = new Map<string, number[]>();
  for (const m of memories) {
    if (!m.user_id) continue;
    if (!memMap.has(m.user_id)) memMap.set(m.user_id, []);
    memMap.get(m.user_id)!.push(new Date(m.created_at).getTime());
  }

  // Group users by registration month
  const cohortMap = new Map<string, typeof profiles>();
  for (const p of profiles) {
    const month = p.created_at.slice(0, 7);
    if (!cohortMap.has(month)) cohortMap.set(month, []);
    cohortMap.get(month)!.push(p);
  }

  // Cumulative retention: user is retained at D_N if they created any memory
  // within N days of registration
  function isRetained(userId: string, regMs: number, daysN: number): boolean {
    const mems = memMap.get(userId) ?? [];
    return mems.some((t) => t >= regMs && t <= regMs + daysN * DAY_MS);
  }

  const now = Date.now();
  const cohorts: CohortRow[] = [];

  for (const [month, users] of [...cohortMap.entries()].sort()) {
    const cohortStartMs = new Date(month + '-01').getTime();
    const ageDays = (now - cohortStartMs) / DAY_MS;
    if (ageDays < 1) continue; // Skip current incomplete cohort

    const cohortRow: CohortRow = { month, size: users.length, d1: null, d7: null, d30: null };

    if (ageDays >= 2) {
      const retained = users.filter((u) =>
        isRetained(u.id, new Date(u.created_at).getTime(), 1)
      );
      cohortRow.d1 = users.length > 0 ? retained.length / users.length : 0;
    }

    if (ageDays >= 8) {
      const retained = users.filter((u) =>
        isRetained(u.id, new Date(u.created_at).getTime(), 7)
      );
      cohortRow.d7 = users.length > 0 ? retained.length / users.length : 0;
    }

    if (ageDays >= 31) {
      const retained = users.filter((u) =>
        isRetained(u.id, new Date(u.created_at).getTime(), 30)
      );
      cohortRow.d30 = users.length > 0 ? retained.length / users.length : 0;
    }

    cohorts.push(cohortRow);
  }

  return cohorts.reverse(); // Most recent first
}

export default async function RetentionPage() {
  const cohorts = await getRetentionData();

  const totalUsers = cohorts.reduce((s, c) => s + c.size, 0);
  const d1Cohorts = cohorts.filter((c) => c.d1 !== null);
  const d7Cohorts = cohorts.filter((c) => c.d7 !== null);
  const d30Cohorts = cohorts.filter((c) => c.d30 !== null);

  const avgD1 =
    d1Cohorts.length > 0
      ? d1Cohorts.reduce((s, c) => s + (c.d1 ?? 0), 0) / d1Cohorts.length
      : null;
  const avgD7 =
    d7Cohorts.length > 0
      ? d7Cohorts.reduce((s, c) => s + (c.d7 ?? 0), 0) / d7Cohorts.length
      : null;
  const avgD30 =
    d30Cohorts.length > 0
      ? d30Cohorts.reduce((s, c) => s + (c.d30 ?? 0), 0) / d30Cohorts.length
      : null;

  const cohortsForChart = [...cohorts].reverse(); // Chronological for line chart

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">留存分析</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            按注册月份分组，统计用户在 D1/D7/D30 的累计回忆创建率
          </p>
        </div>
        <CsvDownloadButton action={exportRetentionCsv} filename="retention.csv" />
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">分析用户总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUsers.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">平均 D1 留存</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {avgD1 !== null ? `${(avgD1 * 100).toFixed(1)}%` : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">注册后 1 天内创建记录</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">平均 D7 留存</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {avgD7 !== null ? `${(avgD7 * 100).toFixed(1)}%` : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">注册后 7 天内创建记录</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">平均 D30 留存</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {avgD30 !== null ? `${(avgD30 * 100).toFixed(1)}%` : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">注册后 30 天内创建记录</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RetentionTable cohorts={cohorts} />
        <RetentionLineChart cohorts={cohortsForChart} />
      </div>

      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground">
          <strong>留存定义：</strong>D1 留存 = 注册后 1 天内曾创建任意回忆；D7 = 7 天内；D30 = 30 天内。
          表格颜色：绿色 ≥50%，蓝绿 ≥30%，黄色 ≥10%，红色 &lt;10%。
          最近月份因时间不足，高留存阶段显示 —。
        </CardContent>
      </Card>
    </div>
  );
}
