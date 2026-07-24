import { supabaseAdmin } from '@/lib/supabase-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SceneBarChart, TimeRangePicker, CsvDownloadButton } from '@/components/analytics-charts';
import { exportPushCsv } from '../_actions';
import type { SceneBarPoint } from '@/components/analytics-charts';

async function getPushData(days: number) {
  const since =
    days > 0
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() - days);
          return d.toISOString();
        })()
      : null;

  const [logsRes, outboxRes] = await Promise.all([
    (() => {
      let q = supabaseAdmin.from('notification_log').select('scene, clicked');
      if (since) q = q.gte('sent_at', since);
      return q;
    })(),
    (() => {
      let q = supabaseAdmin.from('notification_outbox').select('status');
      if (since) q = q.gte('created_at', since);
      return q;
    })(),
  ]);

  const logs = logsRes.data ?? [];
  const outbox = outboxRes.data ?? [];

  // Aggregate by scene
  const sceneMap = new Map<string, { total: number; clicked: number }>();
  let totalSent = 0;
  let totalClicked = 0;

  for (const log of logs) {
    if (!sceneMap.has(log.scene)) sceneMap.set(log.scene, { total: 0, clicked: 0 });
    const s = sceneMap.get(log.scene)!;
    s.total++;
    totalSent++;
    if (log.clicked) {
      s.clicked++;
      totalClicked++;
    }
  }

  const sceneData: SceneBarPoint[] = [...sceneMap.entries()]
    .map(([name, d]) => ({
      name,
      total: d.total,
      clicked: d.clicked,
      clickRate: d.total > 0 ? Math.round((d.clicked / d.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Outbox delivery stats
  const outboxCounts = { done: 0, dead: 0, pending: 0, processing: 0 };
  for (const item of outbox) {
    if (item.status in outboxCounts) {
      outboxCounts[item.status as keyof typeof outboxCounts]++;
    }
  }

  const deliveryAttempted = outboxCounts.done + outboxCounts.dead;
  const deliveryRate =
    deliveryAttempted > 0
      ? Math.round((outboxCounts.done / deliveryAttempted) * 100)
      : null;

  const overallClickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  return { sceneData, totalSent, totalClicked, overallClickRate, deliveryRate, outboxCounts };
}

export default async function PushPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysStr } = await searchParams;
  const days = Math.max(0, Number(daysStr ?? 30));
  const { sceneData, totalSent, totalClicked, overallClickRate, deliveryRate, outboxCounts } =
    await getPushData(days);

  const exportAction = exportPushCsv.bind(null, days);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">推送效果</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            通知发送量、点击率及投递成功率分析
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TimeRangePicker current={days} />
          <CsvDownloadButton action={exportAction} filename="push-analytics.csv" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总发送量</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalSent.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总点击量</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalClicked.toLocaleString()}</div>
            <div className="mt-1 text-xs text-muted-foreground">点击率 {overallClickRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">投递成功率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {deliveryRate !== null ? `${deliveryRate}%` : '—'}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              成功 {outboxCounts.done} / 失败 {outboxCounts.dead}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">待处理队列</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{outboxCounts.pending.toLocaleString()}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              处理中 {outboxCounts.processing}
            </div>
          </CardContent>
        </Card>
      </div>

      <SceneBarChart data={sceneData} />

      {/* Click rate table */}
      {sceneData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">各场景点击率明细</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-3 text-left font-medium">场景</th>
                    <th className="p-3 text-right font-medium">发送量</th>
                    <th className="p-3 text-right font-medium">点击量</th>
                    <th className="p-3 text-right font-medium">点击率</th>
                  </tr>
                </thead>
                <tbody>
                  {sceneData.map((row) => (
                    <tr key={row.name} className="border-b transition-colors hover:bg-muted/30">
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3 text-right text-muted-foreground">
                        {row.total.toLocaleString()}
                      </td>
                      <td className="p-3 text-right">{row.clicked.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <span
                          className={`font-medium ${row.clickRate >= 20 ? 'text-green-600' : row.clickRate >= 10 ? 'text-amber-600' : 'text-muted-foreground'}`}
                        >
                          {row.clickRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
