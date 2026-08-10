import * as React from "react"
import { CircleAlertIcon, EyeIcon, PlusIcon, RefreshCwIcon, SearchIcon, ShieldAlertIcon } from "lucide-react"

import { AdminPagination } from "@/components/admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createAdminRepository, isGovernanceReasonReady, resolveGovernanceReason } from "@/lib/admin"
import type { AdminRepository, NotificationOutboxStatus, NotificationRow } from "@/lib/admin"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | NotificationOutboxStatus
type DeliveryFilter = "all" | "sent" | "not_sent"

interface OperationState {
  phase: "idle" | "blocked" | "error"
  message: string
}

const pageSize = 12
const minimumReasonLength = 10

const statusLabels: Record<NotificationOutboxStatus, string> = {
  pending: "待处理",
  processing: "处理中",
  done: "已完成",
  dead: "失败",
}

function statusTone(status: NotificationOutboxStatus) {
  if (status === "done") return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-500/30"
  if (status === "processing") return "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-100 dark:ring-sky-500/30"
  if (status === "dead") return "bg-destructive/10 text-destructive ring-destructive/20"
  return "bg-muted text-muted-foreground ring-border"
}

const deliveryLabels: Record<DeliveryFilter, string> = {
  all: "全部发送",
  sent: "已发送",
  not_sent: "未发送",
}

function formatDate(value?: string | null) {
  if (!value) return "未记录"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "未记录"
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function matchesSearch(row: NotificationRow, query: string) {
  if (!query) return true
  return [row.event, row.familyId, row.kidId ?? "", row.lastError ?? "", String(row.id)].join(" ").toLowerCase().includes(query.toLowerCase())
}

function hasSent(row: NotificationRow) {
  return (row.sentCount ?? 0) > 0
}

function matchesDelivery(row: NotificationRow, delivery: DeliveryFilter) {
  if (delivery === "all") return true
  if (delivery === "sent") return hasSent(row)
  return !hasSent(row)
}

function deliveryText(row: NotificationRow) {
  if (hasSent(row)) return `${row.sentCount} 次`
  if (row.status === "dead") return "发送失败"
  if (row.status === "processing") return "处理中"
  return "未发送"
}

function channelText() {
  return "DooPush 推送"
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
      <TableCell className="py-2"><Skeleton className="h-5 w-36" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-5 w-36" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-5 w-24" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-5 w-20" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-5 w-36" /></TableCell>
      <TableCell className="py-2"><Skeleton className="ml-auto h-8 w-8" /></TableCell>
    </TableRow>
  ))
}

function OperationBanner({ operation }: { operation: OperationState }) {
  if (operation.phase === "idle") return null
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b bg-muted/20 px-4 py-2.5 text-sm text-muted-foreground",
        operation.phase === "blocked" && "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
        operation.phase === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <CircleAlertIcon className="size-4 shrink-0" />
      {operation.message}
    </div>
  )
}

export function NotificationsPage() {
  const [repository, setRepository] = React.useState<AdminRepository | null>(null)
  const [notifications, setNotifications] = React.useState<NotificationRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [reason, setReason] = React.useState("")
  const [loadedReason, setLoadedReason] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<StatusFilter>("all")
  const [delivery, setDelivery] = React.useState<DeliveryFilter>("all")
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<NotificationRow | null>(null)
  const [operation, setOperation] = React.useState<OperationState>({ phase: "idle", message: "" })

  const canLoad = isGovernanceReasonReady(reason, minimumReasonLength)

  const loadData = React.useCallback(async () => {
    if (!isGovernanceReasonReady(reason, minimumReasonLength)) {
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const adminRepository = repository ?? await createAdminRepository()
      const governanceReason = resolveGovernanceReason(reason)
      const rows = await adminRepository.listNotifications({ limit: 200, governanceReason })
      setRepository(adminRepository)
      setNotifications(rows)
      setLoadedReason(governanceReason)
    } catch (loadError) {
      setNotifications([])
      setError(loadError instanceof Error ? loadError.message : "消息任务加载失败")
    } finally {
      setLoading(false)
    }
  }, [reason, repository])

  React.useEffect(() => {
    setPage(1)
  }, [delivery, search, status])

  const filtered = React.useMemo(() => {
    return notifications
      .filter((item) => status === "all" || item.status === status)
      .filter((item) => matchesDelivery(item, delivery))
      .filter((item) => matchesSearch(item, search.trim()))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  }, [delivery, notifications, search, status])

  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, maxPage)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function blockCreate() {
    setOperation({ phase: "blocked", message: "新建和手动发送尚未接入，系统不会创建任务，也不会向用户发送通知。" })
  }

  const toolStatus = loading
    ? "正在加载消息任务"
    : error
      ? "列表读取失败，保留原始错误信息"
      : loadedReason
        ? `${repository?.mode === "demo" ? "DEMO 数据" : "实时数据"} · ${filtered.length} 条 · 发送入口不可用`
        : "需要治理理由后读取家庭消息任务"

  return (
    <main className="admin-page @container/main flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">通知运营</h1>
          <p className="text-sm text-muted-foreground">查看推送任务、受众、渠道和发送结果；发送能力未接入时保持不可用状态。</p>
          <p className="mt-1 text-xs text-muted-foreground">{toolStatus}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="grid gap-2 border-b p-3 lg:grid-cols-[minmax(260px,1fr)_150px_150px_auto_auto]">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索任务、家庭、孩子、错误信息" />
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="pending">待处理</SelectItem>
              <SelectItem value="processing">处理中</SelectItem>
              <SelectItem value="done">已完成</SelectItem>
              <SelectItem value="dead">失败</SelectItem>
            </SelectContent>
          </Select>
          <Select value={delivery} onValueChange={(value) => setDelivery(value as DeliveryFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{deliveryLabels.all}</SelectItem>
              <SelectItem value="sent">{deliveryLabels.sent}</SelectItem>
              <SelectItem value="not_sent">{deliveryLabels.not_sent}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void loadData()} disabled={loading || !canLoad}>
            <RefreshCwIcon className={loading ? "animate-spin" : undefined} />
            {loadedReason ? "刷新" : "加载"}
          </Button>
          <Button variant="outline" onClick={blockCreate}>
            <PlusIcon />
            新建任务
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-b bg-muted/20 px-4 py-3 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlertIcon className="size-4 shrink-0" />
            <span>通知任务包含家庭上下文，填写治理理由后读取并保留审计。</span>
          </div>
          <Input
            className="md:max-w-md"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={`治理理由，至少 ${minimumReasonLength} 个字符`}
          />
        </div>

        <OperationBanner operation={operation} />

        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm">
          <div className="font-medium">任务列表</div>
          <div className="text-xs text-muted-foreground">{loading ? "正在加载" : `${filtered.length} 条结果`}</div>
        </div>
        {error ? (
          <div className="p-4">
            <StateBlock title="消息任务加载失败" description={error} action={<Button variant="outline" onClick={() => void loadData()} disabled={!canLoad}>重试</Button>} />
          </div>
        ) : !loadedReason && !loading ? (
          <div className="p-4">
            <StateBlock title="请输入查询理由后加载" description="消息任务包含家庭上下文，需要先说明本次查询目的。" />
          </div>
        ) : !loading && filtered.length === 0 ? (
          <div className="p-4">
            <StateBlock title="暂无消息任务" description="没有匹配当前搜索和筛选条件的任务。" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务</TableHead>
                  <TableHead>受众</TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建/发送时间</TableHead>
                  <TableHead className="w-12 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <LoadingRows /> : rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-56 whitespace-normal py-2">
                      <div className="font-medium leading-5">{row.event}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">任务 #{row.id} · 尝试 {row.attempts}/{row.maxAttempts}</div>
                    </TableCell>
                    <TableCell className="max-w-56 py-2 text-xs text-muted-foreground">
                      <div className="truncate">{row.familyId}</div>
                      <div className="truncate">{row.kidId ?? "家庭级"}</div>
                    </TableCell>
                    <TableCell className="py-2 text-sm text-muted-foreground">
                      <div>{channelText()}</div>
                      <div className="text-xs">{deliveryText(row)}</div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className={cn("border-transparent ring-1", statusTone(row.status))}>
                        {statusLabels[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      <div>创建 {formatDate(row.createdAt)}</div>
                      <div>发送 {hasSent(row) ? formatDate(row.processedAt) : "未发送"}</div>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button size="icon-sm" variant="ghost" onClick={() => setSelected(row)} aria-label={`查看通知任务 ${row.id} 详情`}>
                        <EyeIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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

      <MessageDetailDialog row={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </main>
  )
}

function MessageDetailDialog({ row, onOpenChange }: { row: NotificationRow | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {row ? (
          <>
            <DialogHeader>
              <DialogTitle>{row.event}</DialogTitle>
              <DialogDescription>{statusLabels[row.status]} · {channelText()} · {formatDate(row.createdAt)}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 text-sm">
              <dl className="grid gap-x-4 gap-y-2 rounded-lg border p-3 text-sm sm:grid-cols-[96px_1fr]">
                <MetadataRow label="家庭" value={row.familyId} />
                <MetadataRow label="孩子" value={row.kidId ?? "家庭级"} />
                <MetadataRow label="渠道" value={channelText()} />
                <MetadataRow label="发送结果" value={deliveryText(row)} />
                <MetadataRow label="尝试次数" value={`${row.attempts} / ${row.maxAttempts}`} />
                <MetadataRow label="处理时间" value={formatDate(row.processedAt)} />
              </dl>
              {row.lastError ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive">{row.lastError}</div>
              ) : null}
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">高级 ID 与元数据</summary>
                <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <MetadataRow label="id" value={String(row.id)} />
                  <MetadataRow label="sent_count" value={String(row.sentCount ?? 0)} />
                  <MetadataRow label="created_at" value={row.createdAt} />
                  <MetadataRow label="processed_at" value={row.processedAt ?? "未记录"} />
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

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:contents">
      <dt className="font-medium text-foreground">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  )
}
