'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download } from 'lucide-react';

const TOOLTIP_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
  color: 'hsl(var(--card-foreground))',
};

// ─── Time Range Picker ────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { label: '7天', value: 7 },
  { label: '30天', value: 30 },
  { label: '90天', value: 90 },
  { label: '全部', value: 0 },
];

export function TimeRangePicker({ current }: { current: number }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1">
      {RANGE_OPTIONS.map(({ label, value }) => (
        <a
          key={value}
          href={value === 0 ? pathname : `${pathname}?days=${value}`}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            current === value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          {label}
        </a>
      ))}
    </div>
  );
}

// ─── CSV Download Button ──────────────────────────────────────────────────────

export function CsvDownloadButton({
  action,
  filename,
  label = '导出 CSV',
}: {
  action: () => Promise<string>;
  filename: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const csv = await action();
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('CSV export failed', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-50"
    >
      <Download className="size-3.5" />
      {loading ? '生成中…' : label}
    </button>
  );
}

// ─── Growth Chart ─────────────────────────────────────────────────────────────

export type GrowthPoint = { date: string; daily: number; cumulative: number };

export function GrowthChart({ data }: { data: GrowthPoint[] }) {
  if (data.length === 0) return <EmptyChart title="用户增长" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">用户增长趋势</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 4, right: 24, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="d" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis
              yAxisId="c"
              orientation="right"
              tick={{ fontSize: 10 }}
              allowDecimals={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Line
              yAxisId="d"
              type="monotone"
              dataKey="daily"
              name="每日新增"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="c"
              type="monotone"
              dataKey="cumulative"
              name="累计用户"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Stacked Area Chart ───────────────────────────────────────────────────────

export type StackedPoint = { date: string } & Record<string, number | string>;

const AREA_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];

export function StackedAreaChart({
  title,
  data,
  keys,
  labels,
}: {
  title: string;
  data: StackedPoint[];
  keys: string[];
  labels: Record<string, string>;
}) {
  if (data.length === 0) return <EmptyChart title={title} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            {keys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={labels[key] ?? key}
                stackId="1"
                stroke={AREA_COLORS[i % AREA_COLORS.length]}
                fill={AREA_COLORS[i % AREA_COLORS.length]}
                fillOpacity={0.55}
                strokeWidth={1}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Scene Bar Chart ──────────────────────────────────────────────────────────

export type SceneBarPoint = { name: string; total: number; clicked: number; clickRate: number };

export function SceneBarChart({ data }: { data: SceneBarPoint[] }) {
  if (data.length === 0) return <EmptyChart title="各场景发送量" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">各场景发送量 & 点击量</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="total" name="发送量" fill="#6366f1" radius={[2, 2, 0, 0]} />
            <Bar dataKey="clicked" name="点击量" fill="#22d3ee" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Funnel Visualization ─────────────────────────────────────────────────────

export type FunnelStep = { label: string; count: number; rate: number };

const FUNNEL_COLORS = ['#6366f1', '#22d3ee', '#10b981'];

export function FunnelViz({ steps }: { steps: FunnelStep[] }) {
  const maxCount = steps[0]?.count ?? 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">邀请转化漏斗</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step, i) => (
          <div key={step.label}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">{step.label}</span>
              <span className="text-muted-foreground">
                {step.count.toLocaleString()} &nbsp;
                <span className="font-medium text-foreground">({step.rate}%)</span>
              </span>
            </div>
            <div className="h-9 overflow-hidden rounded bg-muted">
              <div
                className="flex h-full items-center pl-3 text-xs font-medium text-white transition-all"
                style={{
                  width: `${maxCount > 0 ? Math.max((step.count / maxCount) * 100, 4) : 4}%`,
                  backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                }}
              >
                {step.count > 0 ? step.count.toLocaleString() : ''}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="mt-1 text-right text-xs text-muted-foreground">
                ↓ 下一步转化率{' '}
                {steps[0]?.count
                  ? Math.round(((steps[i + 1]?.count ?? 0) / (steps[i]?.count ?? 1)) * 100)
                  : 0}
                %
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Retention Table ──────────────────────────────────────────────────────────

export type CohortRow = {
  month: string;
  size: number;
  d1: number | null;
  d7: number | null;
  d30: number | null;
};

function retentionCellClass(rate: number | null): string {
  if (rate === null) return 'text-muted-foreground';
  if (rate >= 0.5) return 'bg-green-500/20 text-green-700 dark:text-green-300 font-medium';
  if (rate >= 0.3) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (rate >= 0.1) return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300';
  return 'bg-red-500/10 text-red-700 dark:text-red-300';
}

export function RetentionTable({ cohorts }: { cohorts: CohortRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">留存率 Cohort 表</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">注册月份</th>
                <th className="p-3 text-center font-medium">用户数</th>
                <th className="p-3 text-center font-medium">D1 留存</th>
                <th className="p-3 text-center font-medium">D7 留存</th>
                <th className="p-3 text-center font-medium">D30 留存</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((row) => (
                <tr key={row.month} className="border-b transition-colors hover:bg-muted/30">
                  <td className="p-3 font-medium">{row.month}</td>
                  <td className="p-3 text-center text-muted-foreground">{row.size}</td>
                  {([row.d1, row.d7, row.d30] as (number | null)[]).map((rate, i) => (
                    <td key={i} className={`p-3 text-center rounded ${retentionCellClass(rate)}`}>
                      {rate !== null ? `${(rate * 100).toFixed(1)}%` : '—'}
                    </td>
                  ))}
                </tr>
              ))}
              {cohorts.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Retention Line Chart ─────────────────────────────────────────────────────

export function RetentionLineChart({ cohorts }: { cohorts: CohortRow[] }) {
  const data = cohorts
    .filter((c) => c.d1 !== null || c.d7 !== null || c.d30 !== null)
    .map((c) => ({
      month: c.month,
      'D1留存': c.d1 !== null ? Math.round(c.d1 * 100) : undefined,
      'D7留存': c.d7 !== null ? Math.round(c.d7 * 100) : undefined,
      'D30留存': c.d30 !== null ? Math.round(c.d30 * 100) : undefined,
    }));

  if (data.length === 0) return <EmptyChart title="留存趋势" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">留存趋势（各 Cohort）</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [`${v ?? 0}%`]}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="D1留存"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="D7留存"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="D30留存"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Overview Dual Trend Chart ────────────────────────────────────────────────

export type DualTrendPoint = { date: string; users: number; memories: number };

export function DualTrendChart({ data }: { data: DualTrendPoint[] }) {
  if (data.length === 0) return <EmptyChart title="新增趋势" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">新增趋势（用户 & 记录）</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="users"
              name="新增用户"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="memories"
              name="新增记录"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyChart({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        暂无数据
      </CardContent>
    </Card>
  );
}
