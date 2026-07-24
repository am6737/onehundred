'use client';

import { useState } from 'react';
import { AreaChart } from '@/components/tremor/AreaChart';
import { BarChart } from '@/components/tremor/BarChart';
import { Card } from '@/components/tremor/Card';

export type TrendPoint = { date: string; count: number };
export type DistPoint = { name: string; value: number };

export interface DashboardChartsData {
  userTrend7: TrendPoint[];
  userTrend30: TrendPoint[];
  memoryTrend7: TrendPoint[];
  memoryTrend30: TrendPoint[];
  typeDistribution: DistPoint[];
  perspectiveDistribution: DistPoint[];
  outboxDistribution: DistPoint[];
}

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

const OUTBOX_LABELS: Record<string, string> = {
  pending: '待发送',
  processing: '发送中',
  done: '已完成',
  dead: '失败',
};

// One restrained accent everywhere; identity comes from axis labels, not color.
const ACCENT = ['indigo'] as const;
const fmt = (v: number) => `${v}`;

type Period = '7天' | '30天';

function TrendChart({
  title,
  data7,
  data30,
}: {
  title: string;
  data7: TrendPoint[];
  data30: TrendPoint[];
}) {
  const [period, setPeriod] = useState<Period>('7天');
  const raw = period === '7天' ? data7 : data30;
  const data = raw.map((d) => ({ date: d.date, 数量: d.count }));

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="flex gap-0.5 rounded-md bg-muted p-0.5 text-xs">
          {(['7天', '30天'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-2 py-0.5 transition-colors ${
                period === p
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <AreaChart
        className="h-52"
        data={data}
        index="date"
        categories={['数量']}
        colors={ACCENT as unknown as ['indigo']}
        valueFormatter={fmt}
        showLegend={false}
        startEndOnly
        autoMinValue
      />
    </Card>
  );
}

function DistributionBar({
  title,
  data,
  labelMap,
}: {
  title: string;
  data: DistPoint[];
  labelMap: Record<string, string>;
}) {
  const chartData = data.map((d) => ({
    name: labelMap[d.name] ?? d.name,
    数量: d.value,
  }));

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-medium">{title}</h3>
      {chartData.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
          暂无数据
        </div>
      ) : (
        <BarChart
          className="h-52"
          data={chartData}
          index="name"
          categories={['数量']}
          colors={ACCENT as unknown as ['indigo']}
          valueFormatter={fmt}
          layout="vertical"
          showLegend={false}
        />
      )}
    </Card>
  );
}

export function DashboardCharts({ charts }: { charts: DashboardChartsData }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <TrendChart
          title="新增用户趋势"
          data7={charts.userTrend7}
          data30={charts.userTrend30}
        />
        <TrendChart
          title="新增记录趋势"
          data7={charts.memoryTrend7}
          data30={charts.memoryTrend30}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <DistributionBar
          title="记录类型分布"
          data={charts.typeDistribution}
          labelMap={TYPE_LABELS}
        />
        <DistributionBar
          title="视角分布"
          data={charts.perspectiveDistribution}
          labelMap={PERSPECTIVE_LABELS}
        />
        <DistributionBar
          title="推送状态分布"
          data={charts.outboxDistribution}
          labelMap={OUTBOX_LABELS}
        />
      </div>
    </div>
  );
}
