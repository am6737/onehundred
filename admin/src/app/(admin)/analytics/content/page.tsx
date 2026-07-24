import { supabaseAdmin } from '@/lib/supabase-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  StackedAreaChart,
  TimeRangePicker,
  CsvDownloadButton,
} from '@/components/analytics-charts';
import { exportContentCsv } from '../_actions';
import type { StackedPoint } from '@/components/analytics-charts';

const TYPE_LABELS: Record<string, string> = {
  photo: '照片',
  voice: '语音',
  video: '视频',
  text: '文字',
};
const PERSPECTIVE_LABELS: Record<string, string> = {
  parent: '父母视角',
  child: '孩子视角',
  together: '共同记录',
};

async function getContentData(days: number) {
  const since =
    days > 0
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() - days);
          return d.toISOString();
        })()
      : null;

  let query = supabaseAdmin
    .from('memories')
    .select('created_at, type, perspective')
    .order('created_at', { ascending: true });
  if (since) query = query.gte('created_at', since);

  const { data: mems } = await query;

  const typeMap = new Map<string, { photo: number; voice: number; video: number; text: number }>();
  const perspMap = new Map<string, { parent: number; child: number; together: number }>();
  const totals = { photo: 0, voice: 0, video: 0, text: 0, parent: 0, child: 0, together: 0 };

  for (const m of mems ?? []) {
    const day = m.created_at.slice(0, 10);

    if (!typeMap.has(day)) typeMap.set(day, { photo: 0, voice: 0, video: 0, text: 0 });
    const te = typeMap.get(day)!;
    if (m.type in te) (te as Record<string, number>)[m.type]++;
    if (m.type in totals) (totals as Record<string, number>)[m.type]++;

    if (!perspMap.has(day)) perspMap.set(day, { parent: 0, child: 0, together: 0 });
    const pe = perspMap.get(day)!;
    if (m.perspective in pe) (pe as Record<string, number>)[m.perspective]++;
    if (m.perspective in totals) (totals as Record<string, number>)[m.perspective]++;
  }

  const allDays = [...new Set([...typeMap.keys(), ...perspMap.keys()])].sort();

  const typeData: StackedPoint[] = allDays.map((day) => {
    const te = typeMap.get(day) ?? { photo: 0, voice: 0, video: 0, text: 0 };
    return { date: day.slice(5), ...te };
  });

  const perspData: StackedPoint[] = allDays.map((day) => {
    const pe = perspMap.get(day) ?? { parent: 0, child: 0, together: 0 };
    return { date: day.slice(5), ...pe };
  });

  return { typeData, perspData, totals, totalMemories: mems?.length ?? 0 };
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysStr } = await searchParams;
  const days = Math.max(0, Number(daysStr ?? 30));
  const { typeData, perspData, totals, totalMemories } = await getContentData(days);

  const exportAction = exportContentCsv.bind(null, days);

  const typeCards = [
    { label: '照片', value: totals.photo, color: 'text-indigo-600' },
    { label: '语音', value: totals.voice, color: 'text-cyan-600' },
    { label: '视频', value: totals.video, color: 'text-amber-600' },
    { label: '文字', value: totals.text, color: 'text-red-600' },
  ];

  const perspCards = [
    { label: '父母视角', value: totals.parent },
    { label: '孩子视角', value: totals.child },
    { label: '共同记录', value: totals.together },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">内容趋势</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            记录类型与视角分布随时间的变化
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TimeRangePicker current={days} />
          <CsvDownloadButton action={exportAction} filename="content-trends.csv" />
        </div>
      </div>

      {/* Total summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            期间记录总数：{totalMemories.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            {typeCards.map((c) => (
              <div key={c.label}>
                <div className={`text-xl font-bold ${c.color}`}>{c.value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            ))}
            <div className="w-px bg-border self-stretch mx-2" />
            {perspCards.map((c) => (
              <div key={c.label}>
                <div className="text-xl font-bold">{c.value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <StackedAreaChart
          title="记录类型趋势"
          data={typeData}
          keys={['photo', 'voice', 'video', 'text']}
          labels={TYPE_LABELS}
        />
        <StackedAreaChart
          title="视角分布趋势"
          data={perspData}
          keys={['parent', 'child', 'together']}
          labels={PERSPECTIVE_LABELS}
        />
      </div>
    </div>
  );
}
