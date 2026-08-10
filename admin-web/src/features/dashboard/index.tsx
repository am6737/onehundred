import * as React from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  UsersRoundIcon,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { AdminDataError, createAdminRepository, createDemoAdminRepository } from "@/lib/admin"
import type { AdminRepository, DashboardSummary } from "@/lib/admin"
import { cn } from "@/lib/utils"

type LoadStatus = "loading" | "ready" | "blocked" | "error"

type Metric = {
  label: string
  value: number | undefined
  helper: string
  Icon: React.ComponentType<{ className?: string }>
  tone?: "urgent"
}

type OperationItem = {
  label: string
  value: string
  detail: string
  tone?: "urgent" | "warning" | "ok"
}

const chartConfig = {
  newUsers: {
    label: "新增用户",
    color: "oklch(0.54 0.13 214)",
  },
  newMemories: {
    label: "新增记录",
    color: "oklch(0.52 0.14 156)",
  },
  activeFamilies: {
    label: "活跃家庭",
    color: "oklch(0.62 0.13 70)",
  },
} satisfies ChartConfig

function isExplicitDemoMode() {
  return import.meta.env.VITE_ADMIN_DATA_MODE?.trim().toLowerCase() === "demo"
}

async function createDashboardRepository() {
  if (isExplicitDemoMode()) {
    return createDemoAdminRepository("当前为演示数据，运营首页只显示预览内容。")
  }
  return createAdminRepository()
}

function formatNumber(value: number | undefined) {
  if (value === undefined) return "未返回"
  return new Intl.NumberFormat("zh-CN").format(value)
}

function formatDateTime(value?: string | null) {
  if (!value) return "未返回"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  })
}

function statusLabel(status: LoadStatus, repository: AdminRepository | null) {
  if (status === "blocked") return "未配置"
  if (repository?.mode === "demo") return "演示数据"
  if (repository?.mode === "live") return "线上数据"
  if (status === "error") return "加载失败"
  return "连接中"
}

function sourceLabel(source: DashboardSummary["source"]) {
  return source === "demo" ? "演示数据" : "线上数据"
}

function totalActivities(summary: DashboardSummary) {
  const { systemActivities, familyActivities } = summary.totals
  if (systemActivities === undefined && familyActivities === undefined) return undefined
  return (systemActivities ?? 0) + (familyActivities ?? 0)
}

function sumDaily(summary: DashboardSummary, key: "newUsers" | "newMemories" | "activeFamilies") {
  return summary.daily.slice(-14).reduce((total, item) => total + item[key], 0)
}

function latestActiveFamilies(summary: DashboardSummary) {
  return summary.daily.at(-1)?.activeFamilies
}

function dashboardMetrics(summary: DashboardSummary): Metric[] {
  const totals = summary.totals
  const activities = totalActivities(summary)
  const activeFamilies = latestActiveFamilies(summary)

  return [
    {
      label: "事情总量",
      value: activities,
      Icon: ClipboardListIcon,
      helper: `系统 ${formatNumber(totals.systemActivities)} / 家庭 ${formatNumber(totals.familyActivities)}${
        totals.publishedVersions !== undefined ? `，已发布 ${formatNumber(totals.publishedVersions)}` : ""
      }`,
    },
    {
      label: "完成记录",
      value: totals.memories,
      Icon: CheckCircle2Icon,
      helper: `近 14 天新增 ${formatNumber(sumDaily(summary, "newMemories"))}`,
    },
    {
      label: "待审核",
      value: totals.pendingReview,
      Icon: ShieldAlertIcon,
      helper:
        totals.notificationQueue > 0
          ? `通知队列 ${formatNumber(totals.notificationQueue)}`
          : "通知队列正常",
      tone: totals.pendingReview > 0 ? "urgent" : undefined,
    },
    {
      label: activeFamilies === undefined ? "用户" : "活跃家庭",
      value: activeFamilies ?? totals.users,
      Icon: UsersRoundIcon,
      helper: `用户 ${formatNumber(totals.users)} / 家庭 ${formatNumber(totals.families)} / 孩子 ${formatNumber(totals.kids)}`,
    },
  ]
}

function operationItems(summary: DashboardSummary): OperationItem[] {
  const totals = summary.totals
  const activities = totalActivities(summary)
  const activeFamilies = latestActiveFamilies(summary)
  const items: OperationItem[] = []

  if (totals.pendingReview > 0) {
    items.push({
      label: "处理待审核记录",
      value: formatNumber(totals.pendingReview),
      detail: "内容审核有积压",
      tone: "urgent",
    })
  }

  if (totals.notificationQueue > 0) {
    items.push({
      label: "检查通知队列",
      value: formatNumber(totals.notificationQueue),
      detail: "仍有待发送任务",
      tone: "warning",
    })
  }

  if ((totals.moderationCases ?? 0) > 0) {
    items.push({
      label: "跟进治理案件",
      value: formatNumber(totals.moderationCases),
      detail: "确认案件状态和处理结论",
      tone: "warning",
    })
  }

  if (activities === 0) {
    items.push({
      label: "补齐事情库",
      value: "0",
      detail: "当前没有可运营的事情定义",
      tone: "urgent",
    })
  }

  if (totals.publishedVersions === 0) {
    items.push({
      label: "发布首个版本",
      value: "0",
      detail: "用户侧暂无可用版本",
      tone: "urgent",
    })
  }

  if (totals.users === 0 || totals.families === 0) {
    items.push({
      label: "启动用户与家庭数据",
      value: `${formatNumber(totals.users)} / ${formatNumber(totals.families)}`,
      detail: "注册和家庭创建尚未形成基础量",
      tone: "warning",
    })
  }

  if (activeFamilies === 0 && totals.families > 0) {
    items.push({
      label: "关注家庭活跃",
      value: "0",
      detail: "最近一个趋势点没有活跃家庭",
      tone: "warning",
    })
  }

  if (items.length === 0) {
    items.push(
      {
        label: "审核队列正常",
        value: "清空",
        detail: "当前没有待审核积压",
        tone: "ok",
      },
      {
        label: "通知队列正常",
        value: "清空",
        detail: "未发现待发送任务",
        tone: "ok",
      },
    )
  }

  return items.slice(0, 5)
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  return <main className="admin-page @container/main flex flex-1 flex-col gap-6">{children}</main>
}

function DashboardTools({
  summary,
  repository,
  status,
  loading,
  onRefresh,
}: {
  summary: DashboardSummary | null
  repository: AdminRepository | null
  status: LoadStatus
  loading: boolean
  onRefresh: () => void
}) {
  const label = statusLabel(status, repository)

  return (
    <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 font-medium",
            repository?.mode === "demo" && "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
            status === "blocked" && "border-destructive/30 bg-destructive/10 text-destructive",
            status === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full bg-muted-foreground/55",
              repository?.mode === "demo" && "bg-amber-500",
              repository?.mode === "live" && "bg-emerald-500",
              (status === "blocked" || status === "error") && "bg-destructive",
            )}
          />
          {label}
        </span>
        <span>{summary ? `更新于 ${formatDateTime(summary.generatedAt)}` : "等待数据返回"}</span>
        {summary ? <span>{sourceLabel(summary.source)}</span> : null}
      </div>
      <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="w-fit text-muted-foreground">
        <RefreshCwIcon className={loading ? "animate-spin" : undefined} />
        刷新
      </Button>
    </div>
  )
}

function StatePanel({
  status,
  title,
  description,
  action,
}: {
  status: Exclude<LoadStatus, "loading" | "ready">
  title: string
  description: string
  action?: React.ReactNode
}) {
  const Icon = status === "blocked" ? AlertTriangleIcon : ShieldAlertIcon

  return (
    <section className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-xl border bg-card px-6 py-10 text-center shadow-sm">
      <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </section>
  )
}

function MetricStrip({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="核心运营指标">
      {dashboardMetrics(summary).map((metric) => {
        const Icon = metric.Icon

        return (
          <article
            key={metric.label}
            className="min-w-0 rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">{metric.label}</div>
                <div
                  className={cn(
                    "text-3xl font-semibold leading-none tracking-tight tabular-nums",
                    metric.tone === "urgent" && "text-destructive",
                  )}
                >
                  {formatNumber(metric.value)}
                </div>
              </div>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </div>
            </div>
            <p className="mt-4 truncate text-xs text-muted-foreground">{metric.helper}</p>
          </article>
        )
      })}
    </section>
  )
}

function MetricSkeleton() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="运营首页加载中">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="size-9 rounded-lg" />
          </div>
          <Skeleton className="mt-4 h-3 w-36 max-w-full" />
        </div>
      ))}
    </section>
  )
}

function TrendChart({ summary }: { summary: DashboardSummary }) {
  const data = summary.daily.slice(-14)

  return (
    <section className="rounded-xl border bg-card shadow-sm" aria-label="14 天趋势">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight">14 天趋势</h2>
        <p className="text-sm text-muted-foreground">新增用户、完成记录与活跃家庭</p>
      </div>
      <div className="p-5 pl-2 sm:pl-5">
        {data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            暂无趋势数据
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fillNewUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-newUsers)" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="var(--color-newUsers)" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="fillNewMemories" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-newMemories)" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="var(--color-newMemories)" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="fillActiveFamilies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-activeFamilies)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-activeFamilies)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={28}
                tickFormatter={(value) => formatDay(String(value))}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} allowDecimals={false} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent labelFormatter={(value) => formatDay(String(value))} indicator="dot" />}
              />
              <Area dataKey="activeFamilies" type="monotone" fill="url(#fillActiveFamilies)" stroke="var(--color-activeFamilies)" strokeWidth={2} />
              <Area dataKey="newMemories" type="monotone" fill="url(#fillNewMemories)" stroke="var(--color-newMemories)" strokeWidth={2} />
              <Area dataKey="newUsers" type="monotone" fill="url(#fillNewUsers)" stroke="var(--color-newUsers)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </section>
  )
}

function OperationsPanel({ summary }: { summary: DashboardSummary }) {
  return (
    <aside className="rounded-xl border bg-card shadow-sm" aria-label="待办与运行状态">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight">待办与运行状态</h2>
        <p className="text-sm text-muted-foreground">最多显示 5 个需要关注的信号</p>
      </div>
      <div className="divide-y">
        {operationItems(summary).map((item) => (
          <div key={item.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
            <span
              className={cn(
                "size-2 rounded-full bg-muted-foreground/35",
                item.tone === "urgent" && "bg-destructive",
                item.tone === "warning" && "bg-amber-500",
                item.tone === "ok" && "bg-emerald-500",
              )}
            />
            <div className="min-w-0 space-y-0.5">
              <div className="truncate text-sm font-medium leading-5">{item.label}</div>
              <div className="truncate text-xs text-muted-foreground">{item.detail}</div>
            </div>
            <div
              className={cn(
                "text-sm font-medium tabular-nums text-muted-foreground",
                item.tone === "urgent" && "text-destructive",
                item.tone === "warning" && "text-amber-700 dark:text-amber-300",
                item.tone === "ok" && "text-emerald-700 dark:text-emerald-300",
              )}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t px-5 py-3 text-xs text-muted-foreground">
        数据时间：{formatDateTime(summary.generatedAt)}
      </div>
    </aside>
  )
}

function LoadingDashboard({ onRefresh }: { onRefresh: () => void }) {
  return (
    <DashboardShell>
      <DashboardTools summary={null} repository={null} status="loading" loading onRefresh={onRefresh} />
      <MetricSkeleton />
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]" aria-label="运营首页加载骨架">
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b px-5 py-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
          <div className="p-5 pl-2 sm:pl-5">
            <Skeleton className="h-[250px] w-full" />
          </div>
        </div>
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b px-5 py-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-2 h-4 w-40" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
                <Skeleton className="size-2 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40 max-w-full" />
                </div>
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </DashboardShell>
  )
}

export function DashboardPage() {
  const [repository, setRepository] = React.useState<AdminRepository | null>(null)
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null)
  const [status, setStatus] = React.useState<LoadStatus>("loading")

  const loadData = React.useCallback(async () => {
    setStatus("loading")
    try {
      const adminRepository = await createDashboardRepository()
      const dashboardSummary = await adminRepository.getDashboardSummary()
      setRepository(adminRepository)
      setSummary(dashboardSummary)
      setStatus("ready")
    } catch (loadError) {
      setRepository(null)
      setSummary(null)
      setStatus(loadError instanceof AdminDataError && loadError.code === "missing_supabase_config" ? "blocked" : "error")
    }
  }, [])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  if (status === "loading") {
    return <LoadingDashboard onRefresh={loadData} />
  }

  if (!summary) {
    const description =
      status === "blocked"
        ? "后台连接配置尚未完成，暂时无法读取线上运营数据。"
        : "读取运营数据时遇到错误，请稍后刷新重试。"

    return (
      <DashboardShell>
        <DashboardTools summary={null} repository={repository} status={status} loading={false} onRefresh={loadData} />
        <StatePanel
          status={status === "blocked" ? "blocked" : "error"}
          title={status === "blocked" ? "线上数据未就绪" : "运营首页暂不可用"}
          description={description}
          action={
            <Button variant="outline" onClick={loadData}>
              <RefreshCwIcon />
              重试
            </Button>
          }
        />
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardTools summary={summary} repository={repository} status={status} loading={false} onRefresh={loadData} />

      <MetricStrip summary={summary} />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]" aria-label="运营首页运行趋势">
        <TrendChart summary={summary} />
        <OperationsPanel summary={summary} />
      </section>
    </DashboardShell>
  )
}
