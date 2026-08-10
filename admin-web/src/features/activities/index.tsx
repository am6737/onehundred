import * as React from "react"
import { EyeIcon, RefreshCwIcon, SearchIcon, ShieldAlertIcon } from "lucide-react"

import { AdminPagination } from "@/components/admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createAdminRepository, isGovernanceReasonReady, resolveGovernanceReason } from "@/lib/admin"
import type { ActivityLifecycleStatus, ActivityListItem, ActivitySourceType, AdminRepository, CaptureMode } from "@/lib/admin"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | ActivityLifecycleStatus
type SourceFilter = Extract<ActivitySourceType, "system" | "family" | "copied_family">

const pageSize = 12
const minimumReasonLength = 10

const statusLabels: Record<ActivityLifecycleStatus, string> = {
  draft: "草稿",
  published: "可推荐",
  archived: "已归档",
  unpublished: "已下架",
  deleted: "已删除",
}

const sourceLabels: Record<SourceFilter, string> = {
  system: "平台",
  family: "家庭",
  copied_family: "家庭副本",
}

const captureModeLabels: Record<CaptureMode, string> = {
  text: "文字",
  photo: "照片",
  video: "视频",
  voice: "语音",
}

function formatDate(value?: string | null) {
  if (!value) return "未记录"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "未记录"
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function titleOf(activity: ActivityListItem) {
  return activity.current_version?.title || activity.source_key
}

function sourceOf(activity: ActivityListItem) {
  if (activity.source_type === "family" || activity.source_type === "copied_family") {
    return activity.family_id ? `家庭 ${activity.family_id}` : sourceLabels[activity.source_type]
  }
  return sourceLabels.system
}

function statusTone(status: ActivityLifecycleStatus) {
  if (status === "published") return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-500/30"
  if (status === "draft") return "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-100 dark:ring-sky-500/30"
  if (status === "deleted") return "bg-destructive/10 text-destructive ring-destructive/20"
  return "bg-muted text-muted-foreground ring-border"
}

function matchesSearch(activity: ActivityListItem, query: string) {
  if (!query) return true
  const version = activity.current_version
  return [
    activity.id,
    activity.source_key,
    activity.display_no ?? "",
    activity.family_id ?? "",
    version?.title ?? "",
    version?.why ?? "",
    version?.record_hint ?? "",
    version?.category ?? "",
    version?.scene ?? "",
    ...(version?.tags ?? []),
  ].join(" ").toLowerCase().includes(query.toLowerCase())
}

function StateBlock({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border bg-muted/20 p-6 text-center">
      <div className="text-base font-medium">{title}</div>
      <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}

function LoadingRows() {
  return Array.from({ length: 6 }).map((_, index) => (
    <TableRow key={index}>
      <TableCell className="py-2"><Skeleton className="h-5 w-28" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-5 w-64" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-5 w-20" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-5 w-24" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-5 w-24" /></TableCell>
      <TableCell className="py-2"><Skeleton className="ml-auto h-8 w-8" /></TableCell>
    </TableRow>
  ))
}

export function ActivitiesPage() {
  const [repository, setRepository] = React.useState<AdminRepository | null>(null)
  const [activities, setActivities] = React.useState<ActivityListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<StatusFilter>("all")
  const [source, setSource] = React.useState<SourceFilter>("system")
  const [reason, setReason] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<ActivityListItem | null>(null)

  const canLoad = source === "system" || isGovernanceReasonReady(reason, minimumReasonLength)
  const requiresGovernance = source !== "system"

  const loadData = React.useCallback(async () => {
    if (source !== "system" && !isGovernanceReasonReady(reason, minimumReasonLength)) {
      setActivities([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const adminRepository = repository ?? await createAdminRepository()
      const model = await adminRepository.listActivities({
        sourceType: source,
        limit: 200,
        governanceReason: source === "system" ? undefined : resolveGovernanceReason(reason),
      })
      setRepository(adminRepository)
      setActivities(model.items.filter((item) => item.source_type === source))
    } catch (loadError) {
      setActivities([])
      setError(loadError instanceof Error ? loadError.message : "活动运营列表加载失败")
    } finally {
      setLoading(false)
    }
  }, [reason, repository, source])

  React.useEffect(() => {
    if (source === "system") {
      void loadData()
      return
    }

    setActivities([])
    setError(null)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  React.useEffect(() => {
    setPage(1)
  }, [search, source, status])

  const filtered = React.useMemo(() => {
    return activities
      .filter((item) => status === "all" || item.status === status)
      .filter((item) => matchesSearch(item, search.trim()))
      .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
  }, [activities, search, status])

  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, maxPage)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const toolStatus = loading
    ? "正在加载活动运营数据"
    : error
      ? "列表读取失败，保留原始错误信息"
      : requiresGovernance && !canLoad
        ? "需要治理理由后读取家庭来源"
      : `${repository?.mode === "demo" ? "DEMO 数据" : "实时数据"} · ${sourceLabels[source]} · ${filtered.length} 条`

  return (
    <main className="admin-page @container/main flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">活动运营</h1>
          <p className="text-sm text-muted-foreground">查看可进入推荐排期的事情，按来源、状态和最近更新时间快速判断。</p>
          <p className="mt-1 text-xs text-muted-foreground">{toolStatus}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="grid gap-2 border-b p-3 lg:grid-cols-[minmax(260px,1fr)_150px_150px_auto]">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索家庭、编号、标题、推荐理由" />
          </div>
          <Select value={source} onValueChange={(value) => setSource(value as SourceFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="system">平台事情</SelectItem>
              <SelectItem value="family">家庭事情</SelectItem>
              <SelectItem value="copied_family">家庭副本</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="published">可推荐</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="unpublished">已下架</SelectItem>
              <SelectItem value="archived">已归档</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void loadData()} disabled={loading || !canLoad}>
            <RefreshCwIcon className={loading ? "animate-spin" : undefined} />
            刷新
          </Button>
        </div>

        {requiresGovernance ? (
          <div className="flex flex-col gap-2 border-b bg-muted/20 px-4 py-3 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
              <ShieldAlertIcon className="size-4 shrink-0" />
              <span>家庭来源包含私有上下文，填写治理理由后读取并保留审计。</span>
            </div>
            <Input
              className="md:max-w-80"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={`治理理由，至少 ${minimumReasonLength} 个字符`}
            />
            <Button variant="outline" onClick={() => void loadData()} disabled={loading || !canLoad}>
              加载家庭来源
            </Button>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm">
          <div className="font-medium">运营列表</div>
          <div className="text-xs text-muted-foreground">{loading ? "正在加载" : `${filtered.length} 条结果`}</div>
        </div>

        {error ? (
          <div className="p-4">
            <StateBlock title="活动运营列表加载失败" description={error} action={<Button variant="outline" onClick={() => void loadData()} disabled={!canLoad}>重试</Button>} />
          </div>
        ) : requiresGovernance && !canLoad ? (
          <div className="p-4">
            <StateBlock title="等待治理理由" description="填写访问理由后再加载家庭来源的事情。" />
          </div>
        ) : !loading && filtered.length === 0 ? (
          <div className="p-4">
            <StateBlock title="暂无匹配事情" description="调整搜索或筛选后再试。" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>家庭</TableHead>
                  <TableHead>事情</TableHead>
                  <TableHead>推荐状态</TableHead>
                  <TableHead>推荐方式</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead className="w-12 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <LoadingRows /> : rows.map((activity) => {
                  const version = activity.current_version
                  return (
                    <TableRow key={activity.id}>
                      <TableCell className="max-w-44 truncate py-2 text-sm text-muted-foreground">{sourceOf(activity)}</TableCell>
                      <TableCell className="min-w-72 whitespace-normal py-2">
                        <div className="font-medium leading-5">{titleOf(activity)}</div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {version?.record_hint || version?.why || "未配置推荐说明"}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className={cn("border-transparent ring-1", statusTone(activity.status))}>
                          {statusLabels[activity.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {version ? captureModeLabels[version.suggest_mode] : "未知"}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">{formatDate(version?.published_at ?? activity.updated_at)}</TableCell>
                      <TableCell className="py-2 text-right">
                        <Button size="icon-sm" variant="ghost" onClick={() => setSelected(activity)} aria-label={`查看 ${titleOf(activity)} 详情`}>
                          <EyeIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <AdminPagination
              total={filtered.length}
              page={currentPage}
              pageSize={pageSize}
              onPageChange={setPage}
              disabled={loading}
              className="px-4"
            />
          </>
        )}
      </section>

      <ActivityDialog activity={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </main>
  )
}

function ActivityDialog({ activity, onOpenChange }: { activity: ActivityListItem | null; onOpenChange: (open: boolean) => void }) {
  const version = activity?.current_version ?? null
  return (
    <Dialog open={Boolean(activity)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {activity ? (
          <>
            <DialogHeader>
              <DialogTitle>{titleOf(activity)}</DialogTitle>
              <DialogDescription>{sourceOf(activity)} · {statusLabels[activity.status]}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 text-sm">
              <div className="rounded-lg border bg-muted/20 p-3">
                <DetailBlock label="为什么值得推荐" value={version?.why} />
                <DetailBlock label="可以怎么做" value={version?.how} />
                <DetailBlock label="记录提示" value={version?.record_hint} />
              </div>
              <dl className="grid gap-x-4 gap-y-2 rounded-lg border p-3 text-sm sm:grid-cols-[96px_1fr]">
                <MetadataRow label="推荐方式" value={version ? captureModeLabels[version.suggest_mode] : "未知"} />
                <MetadataRow label="允许方式" value={version ? version.allowed_capture_modes.map((mode) => captureModeLabels[mode]).join("、") : "未知"} />
                <MetadataRow label="发布时间" value={formatDate(version?.published_at)} />
              </dl>
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">高级 ID 与元数据</summary>
                <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <MetadataRow label="activity_id" value={activity.id} />
                  <MetadataRow label="source_key" value={activity.source_key} />
                  <MetadataRow label="version_id" value={version?.id ?? "未记录"} />
                  <MetadataRow label="read_model" value={activity.read_model_source} />
                  <MetadataRow label="updated_at" value={activity.updated_at} />
                </dl>
              </details>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DetailBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <section className="not-last:border-b not-last:pb-3 not-first:pt-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <p className="mt-1 whitespace-pre-wrap leading-6">{value || "未配置"}</p>
    </section>
  )
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:contents">
      <dt className="font-medium text-foreground">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  )
}
