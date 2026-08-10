import * as React from "react"
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  EyeIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  LockKeyholeIcon,
  MessageSquareWarningIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  VideoIcon,
  Volume2Icon,
  XCircleIcon,
} from "lucide-react"

import { GovernanceAccessCard } from "@/components/admin/governance-access-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createAdminRepository, createDemoAdminRepository, isGovernanceReasonReady, resolveGovernanceReason } from "@/lib/admin"
import type {
  AdminRepository,
  AdminUserRow,
  CaptureMode,
  FamilyRow,
  ModerationStatus,
  RecordDetail,
  RecordListItem,
  RecordModerationStatus,
} from "@/lib/admin"
import { cn } from "@/lib/utils"

type ContentKind = "all" | CaptureMode
type DateFilter = "all" | "today" | "7d" | "30d"
type SortKey = "recordedAt" | "title" | "status" | "type"
type SortDirection = "asc" | "desc"
type ReviewAction = Exclude<RecordModerationStatus, "pending">

const pageSizeOptions = [10, 20, 50]
const minimumReasonLength = 8

const statusLabels: Record<RecordModerationStatus, string> = {
  pending: "待治理审核",
  approved: "已通过",
  rejected: "已驳回",
  hidden: "已隐藏",
}

const statusBadge: Record<RecordModerationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
  hidden: "secondary",
}

const mediaLabels: Record<CaptureMode, string> = {
  text: "文字",
  photo: "照片",
  voice: "语音",
  video: "视频",
}

const actionLabels: Record<ReviewAction, string> = {
  approved: "通过",
  rejected: "驳回",
  hidden: "隐藏",
}

interface LoadState {
  repository: AdminRepository | null
  records: RecordListItem[]
  users: AdminUserRow[]
  families: FamilyRow[]
  loading: boolean
  error: string | null
  loadedReason: string | null
}

interface OperationState {
  phase: "idle" | "pending" | "success" | "error"
  message: string
}

function isExplicitDemoMode() {
  return import.meta.env.VITE_ADMIN_DATA_MODE?.trim().toLowerCase() === "demo"
}

async function createRepository() {
  if (isExplicitDemoMode()) {
    return createDemoAdminRepository("显式 VITE_ADMIN_DATA_MODE=demo，当前页面只显示演示治理数据。")
  }
  return createAdminRepository()
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function getDateBoundary(filter: DateFilter) {
  if (filter === "all") return null
  const date = new Date()
  if (filter === "today") date.setHours(0, 0, 0, 0)
  if (filter === "7d") date.setDate(date.getDate() - 7)
  if (filter === "30d") date.setDate(date.getDate() - 30)
  return date
}

function getStatus(record: RecordListItem): RecordModerationStatus {
  return record.moderation_status ?? "pending"
}

function getTypeIcon(type: CaptureMode) {
  if (type === "photo") return ImageIcon
  if (type === "voice") return Volume2Icon
  if (type === "video") return VideoIcon
  return FileTextIcon
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试。"
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "zh-CN")
}

function legacyStatusFromAction(action: ReviewAction): ModerationStatus {
  if (action === "rejected") return "flagged"
  if (action === "hidden") return "removed"
  return "approved"
}

function matchesSearch(record: RecordListItem, query: string, author?: AdminUserRow, family?: FamilyRow) {
  if (!query) return true
  const text = [
    record.id,
    record.title ?? "",
    record.caption ?? "",
    record.transcript ?? "",
    record.family_id,
    record.kid_id,
    record.activity_id,
    record.activity_version_id,
    record.recorded_by,
    record.snapshot.activity_title,
    record.snapshot.record_hint,
    author?.username ?? "",
    author?.generatedEmail ?? "",
    family?.inviteCode ?? "",
  ]
    .join(" ")
    .toLowerCase()
  return text.includes(query.toLowerCase())
}

function ContentTypePill({ modes, primary }: { modes: CaptureMode[]; primary: CaptureMode }) {
  const Icon = getTypeIcon(primary)
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="size-3" />
      {modes.length > 1 ? `混合：${modes.map((mode) => mediaLabels[mode]).join("/")}` : mediaLabels[primary]}
    </Badge>
  )
}

function OperationBanner({ operation }: { operation: OperationState }) {
  if (operation.phase === "idle") return null
  const Icon = operation.phase === "pending" ? Loader2Icon : operation.phase === "success" ? CheckCircle2Icon : XCircleIcon
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        operation.phase === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
        operation.phase === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
        operation.phase === "pending" && "border-border bg-muted/60 text-muted-foreground",
      )}
    >
      <Icon className={cn("size-4", operation.phase === "pending" && "animate-spin")} />
      <span>{operation.message}</span>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: number
  description: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card size="sm" className="rounded-lg">
      <CardHeader className="grid-cols-[1fr_auto] items-center">
        <div>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="mt-1 text-2xl">{value}</CardTitle>
        </div>
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{description}</CardContent>
    </Card>
  )
}

function LoadingRows() {
  return Array.from({ length: 6 }).map((_, index) => (
    <TableRow key={index}>
      <TableCell><Skeleton className="size-4" /></TableCell>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-7 w-16" /></TableCell>
    </TableRow>
  ))
}

export function ContentManagementPage() {
  const [state, setState] = React.useState<LoadState>({
    repository: null,
    records: [],
    users: [],
    families: [],
    loading: false,
    error: null,
    loadedReason: null,
  })
  const [governanceReason, setGovernanceReason] = React.useState("")
  const [reviewNote, setReviewNote] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | RecordModerationStatus>("all")
  const [kindFilter, setKindFilter] = React.useState<ContentKind>("all")
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("all")
  const [sortKey, setSortKey] = React.useState<SortKey>("recordedAt")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [previewId, setPreviewId] = React.useState<string | null>(null)
  const [previewDetail, setPreviewDetail] = React.useState<RecordDetail | null>(null)
  const [previewLoading, setPreviewLoading] = React.useState(false)
  const [previewError, setPreviewError] = React.useState<string | null>(null)
  const [operation, setOperation] = React.useState<OperationState>({ phase: "idle", message: "" })

  const loadData = React.useCallback(async () => {
    if (!isGovernanceReasonReady(governanceReason, minimumReasonLength)) {
      setOperation({ phase: "error", message: `请先填写明确治理理由，至少 ${minimumReasonLength} 个字符。` })
      return
    }
    const trimmedReason = resolveGovernanceReason(governanceReason)

    setState((current) => ({ ...current, loading: true, error: null }))
    setOperation({ phase: "pending", message: "正在通过治理访问路径加载家庭私有记录..." })
    try {
      const repository = await createRepository()
      const [recordModel, users, families] = await Promise.all([
        repository.listRecords({ limit: 200, governanceReason: trimmedReason, moderationStatus: "all" }),
        repository.listUsers({ limit: 200 }),
        repository.listFamilies({ limit: 200, governanceReason: trimmedReason }),
      ])
      setState({ repository, records: recordModel.items, users, families, loading: false, error: null, loadedReason: trimmedReason })
      setSelectedIds(new Set())
      setPreviewId(null)
      setPreviewDetail(null)
      setOperation({ phase: "success", message: `已使用治理理由加载 ${recordModel.items.length} 条记录。` })
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getErrorMessage(error) }))
      setOperation({ phase: "error", message: getErrorMessage(error) })
    }
  }, [governanceReason])

  const usersById = React.useMemo(() => new Map(state.users.map((user) => [user.id, user])), [state.users])
  const familiesById = React.useMemo(() => new Map(state.families.map((family) => [family.id, family])), [state.families])

  const filteredRecords = React.useMemo(() => {
    const boundary = getDateBoundary(dateFilter)
    return state.records
      .filter((record) => statusFilter === "all" || getStatus(record) === statusFilter)
      .filter((record) => kindFilter === "all" || record.capture_modes.includes(kindFilter) || record.primary_capture_mode === kindFilter)
      .filter((record) => !boundary || new Date(record.created_at) >= boundary)
      .filter((record) => matchesSearch(record, query.trim(), usersById.get(record.recorded_by), familiesById.get(record.family_id)))
      .sort((left, right) => {
        let result = 0
        if (sortKey === "recordedAt") result = new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
        if (sortKey === "title") result = compareText(left.title ?? left.snapshot.activity_title, right.title ?? right.snapshot.activity_title)
        if (sortKey === "status") result = compareText(statusLabels[getStatus(left)], statusLabels[getStatus(right)])
        if (sortKey === "type") result = compareText(mediaLabels[left.primary_capture_mode], mediaLabels[right.primary_capture_mode])
        return sortDirection === "asc" ? result : -result
      })
  }, [dateFilter, familiesById, kindFilter, query, sortDirection, sortKey, state.records, statusFilter, usersById])

  React.useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [query, statusFilter, kindFilter, dateFilter, pageSize])

  const maxPage = Math.max(Math.ceil(filteredRecords.length / pageSize), 1)
  const currentPage = Math.min(page, maxPage)
  const pageItems = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const previewRecord = previewDetail ?? state.records.find((record) => record.id === previewId) ?? null
  const selectedOnPage = pageItems.length > 0 && pageItems.every((record) => selectedIds.has(record.id))

  const summary = React.useMemo(() => {
    const pending = state.records.filter((record) => getStatus(record) === "pending").length
    const media = state.records.filter((record) => record.capture_modes.some((mode) => mode === "photo" || mode === "voice" || mode === "video")).length
    const rejected = state.records.filter((record) => getStatus(record) === "rejected" || getStatus(record) === "hidden").length
    return { total: state.records.length, pending, media, rejected }
  }, [state.records])

  const updateRecord = React.useCallback(
    async (ids: string[], action: ReviewAction, note: string) => {
      if (!state.repository || ids.length === 0) return
      const loadedReason = state.loadedReason
      if (!loadedReason) {
        setOperation({ phase: "error", message: "请先填写治理理由并加载记录。" })
        return
      }
      const needsReason = action !== "approved"
      if (needsReason && !note.trim()) {
        setOperation({ phase: "error", message: "驳回或隐藏需要填写审核原因。" })
        return
      }

      const confirmText =
        ids.length === 1
          ? `确认${actionLabels[action]}这条记录？`
          : `确认批量${actionLabels[action]} ${ids.length} 条记录？该操作会写入治理审核状态。`
      if (!window.confirm(confirmText)) return

      const moderationNote = action === "approved" ? note.trim() || "审核通过" : note.trim()
      setOperation({ phase: "pending", message: `正在${actionLabels[action]} ${ids.length} 条记录...` })
      try {
        await Promise.all(
          ids.map((id) =>
            state.repository!.updateMemoryModeration(id, {
              status: legacyStatusFromAction(action),
              note: moderationNote,
              governanceReason: loadedReason,
            }),
          ),
        )
        setState((current) => ({
          ...current,
          records: current.records.map((record) =>
            ids.includes(record.id)
              ? { ...record, moderation_status: action, moderation_note: moderationNote, updated_at: new Date().toISOString() }
              : record,
          ),
        }))
        setPreviewDetail((current) =>
          current && ids.includes(current.id)
            ? { ...current, moderation_status: action, moderation_note: moderationNote, updated_at: new Date().toISOString() }
            : current,
        )
        setSelectedIds((current) => {
          const next = new Set(current)
          ids.forEach((id) => next.delete(id))
          return next
        })
        setReviewNote("")
        setOperation({ phase: "success", message: `已完成 ${ids.length} 条记录的${actionLabels[action]}。` })
      } catch (error) {
        setOperation({ phase: "error", message: getErrorMessage(error) })
      }
    },
    [state.loadedReason, state.repository],
  )

  const openPreview = React.useCallback(
    async (record: RecordListItem) => {
      if (!state.repository || !state.loadedReason) {
        setOperation({ phase: "error", message: "请先填写治理理由并加载记录。" })
        return
      }
      setPreviewId(record.id)
      setPreviewDetail(null)
      setPreviewError(null)
      setPreviewLoading(true)
      try {
        const detail = await state.repository.getRecordDetail(record.id, { governanceReason: state.loadedReason })
        setPreviewDetail(detail)
      } catch (error) {
        setPreviewError(getErrorMessage(error))
      } finally {
        setPreviewLoading(false)
      }
    },
    [state.loadedReason, state.repository],
  )

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(key)
    setSortDirection(key === "recordedAt" ? "desc" : "asc")
  }

  const togglePageSelection = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      pageItems.forEach((record) => {
        if (checked) next.add(record.id)
        else next.delete(record.id)
      })
      return next
    })
  }

  const toggleRowSelection = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <main className="admin-page mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">记录审核与治理</h1>
            {state.repository?.mode === "demo" ? <Badge variant="destructive">DEMO</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">家庭完成记录默认私有；必须先填写治理理由，之后才可读取、查看详情或处理审核。</p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={state.loading}>
          <RefreshCwIcon className={cn("size-4", state.loading && "animate-spin")} />
          {state.loadedReason ? "重新加载" : "加载治理队列"}
        </Button>
      </div>

      {state.repository?.mode === "demo" ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-900 dark:text-amber-100">
          DEMO 数据源：{state.repository.reason} 该模式只在显式环境开关下启用。
        </div>
      ) : null}

      <GovernanceAccessCard
        title="治理访问理由"
        description="用于 repository 治理参数、受限 RPC 和审计链路；关闭手动授权时会自动附加调试理由。"
        reason={governanceReason}
        loadedReason={state.loadedReason}
        loading={state.loading}
        placeholder="例如：moderation case MC-1024，用户举报照片含敏感内容，需要审核记录与媒体。"
        onReasonChange={setGovernanceReason}
        onLoad={() => void loadData()}
      />

      <OperationBanner operation={operation} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="已加载记录" value={summary.total} description="来自治理式记录 read model" icon={FileTextIcon} />
        <SummaryCard title="待治理审核" value={summary.pending} description="需要人工处理" icon={Clock3Icon} />
        <SummaryCard title="含媒体记录" value={summary.media} description="照片、语音、视频或混合媒体" icon={ImageIcon} />
        <SummaryCard title="已驳回/隐藏" value={summary.rejected} description="含原因记录" icon={MessageSquareWarningIcon} />
      </section>

      <Card className="rounded-lg">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>治理审核队列</CardTitle>
              <CardDescription>不会默认浏览家庭 memories；列表、详情和审核操作都复用治理理由。</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={selectedIds.size === 0 || operation.phase === "pending"}
                onClick={() => void updateRecord(Array.from(selectedIds), "approved", reviewNote)}
              >
                <ShieldCheckIcon className="size-4" />
                批量通过
              </Button>
              <Button
                variant="destructive"
                disabled={selectedIds.size === 0 || operation.phase === "pending"}
                onClick={() => void updateRecord(Array.from(selectedIds), "rejected", reviewNote)}
              >
                <AlertTriangleIcon className="size-4" />
                批量驳回
              </Button>
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_repeat(5,auto)]">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
                placeholder="搜索记录、事情快照、作者或家庭"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | RecordModerationStatus)}>
              <SelectTrigger className="w-full lg:w-36"><SelectValue placeholder="治理状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待治理审核</SelectItem>
                <SelectItem value="approved">已通过</SelectItem>
                <SelectItem value="rejected">已驳回</SelectItem>
                <SelectItem value="hidden">已隐藏</SelectItem>
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={(value) => setKindFilter(value as ContentKind)}>
              <SelectTrigger className="w-full lg:w-32"><SelectValue placeholder="记录方式" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部方式</SelectItem>
                <SelectItem value="text">文字</SelectItem>
                <SelectItem value="photo">照片</SelectItem>
                <SelectItem value="voice">语音</SelectItem>
                <SelectItem value="video">视频</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
              <SelectTrigger className="w-full lg:w-32"><SelectValue placeholder="日期" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部日期</SelectItem>
                <SelectItem value="today">今天</SelectItem>
                <SelectItem value="7d">近 7 天</SelectItem>
                <SelectItem value="30d">近 30 天</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger className="w-full lg:w-28"><SelectValue placeholder="分页" /></SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>{size} 条/页</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("")
                setStatusFilter("all")
                setKindFilter("all")
                setDateFilter("all")
              }}
            >
              <SlidersHorizontalIcon className="size-4" />
              重置
            </Button>
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              className="min-h-20 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="审核处理备注；驳回和隐藏必填，审核通过可选。"
            />
            <Button
              variant="destructive"
              disabled={selectedIds.size === 0 || operation.phase === "pending"}
              onClick={() => void updateRecord(Array.from(selectedIds), "hidden", reviewNote)}
              className="md:self-start"
            >
              <Trash2Icon className="size-4" />
              批量隐藏
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {state.error ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
              <XCircleIcon className="size-8 text-destructive" />
              <div>
                <div className="font-medium text-foreground">加载失败</div>
                <p className="mt-1 text-sm text-muted-foreground">{state.error}</p>
              </div>
              <Button variant="outline" onClick={() => void loadData()}>重新加载</Button>
            </div>
          ) : !state.loadedReason ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center">
              <LockKeyholeIcon className="size-8 text-muted-foreground" />
              <div>
                <div className="font-medium text-foreground">需要治理理由</div>
                <p className="mt-1 max-w-lg text-sm text-muted-foreground">输入明确治理理由后，页面才会调用 repository 安全方法读取家庭私有记录。</p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedOnPage}
                          disabled={pageItems.length === 0}
                          onCheckedChange={(checked) => togglePageSelection(checked === true)}
                          aria-label="选择当前页"
                        />
                      </TableHead>
                      <TableHead>
                        <SortButton active={sortKey === "title"} direction={sortDirection} onClick={() => toggleSort("title")}>
                          记录
                        </SortButton>
                      </TableHead>
                      <TableHead>
                        <SortButton active={sortKey === "type"} direction={sortDirection} onClick={() => toggleSort("type")}>
                          方式
                        </SortButton>
                      </TableHead>
                      <TableHead>
                        <SortButton active={sortKey === "status"} direction={sortDirection} onClick={() => toggleSort("status")}>
                          状态
                        </SortButton>
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">治理上下文</TableHead>
                      <TableHead>
                        <SortButton active={sortKey === "recordedAt"} direction={sortDirection} onClick={() => toggleSort("recordedAt")}>
                          日期
                        </SortButton>
                      </TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.loading ? <LoadingRows /> : null}
                    {!state.loading && pageItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
                            <FileTextIcon className="size-8 text-muted-foreground" />
                            <div className="font-medium">暂无匹配记录</div>
                            <p className="text-sm text-muted-foreground">调整搜索词或筛选条件后再试。</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {!state.loading
                      ? pageItems.map((record) => {
                          const author = usersById.get(record.recorded_by)
                          const family = familiesById.get(record.family_id)
                          return (
                            <TableRow key={record.id} data-state={selectedIds.has(record.id) ? "selected" : undefined}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(record.id)}
                                  onCheckedChange={(checked) => toggleRowSelection(record.id, checked === true)}
                                  aria-label={`选择 ${record.title ?? record.snapshot.activity_title}`}
                                />
                              </TableCell>
                              <TableCell className="max-w-[340px]">
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => void openPreview(record)}
                                    className="block max-w-full truncate text-left font-medium text-foreground hover:underline"
                                  >
                                    {record.title || record.snapshot.activity_title || "未命名记录"}
                                  </button>
                                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{record.caption || record.transcript || record.snapshot.record_hint || "无正文"}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <ContentTypePill modes={record.capture_modes} primary={record.primary_capture_mode} />
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusBadge[getStatus(record)]}>{statusLabels[getStatus(record)]}</Badge>
                              </TableCell>
                              <TableCell className="hidden max-w-[280px] lg:table-cell">
                                <div className="truncate text-sm">{author?.username ?? author?.generatedEmail ?? record.recorded_by}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  家庭 {family?.inviteCode ?? record.family_id} · 孩子 {record.kid_id}
                                </div>
                              </TableCell>
                              <TableCell>{formatDate(record.created_at)}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => void openPreview(record)}>
                                  <EyeIcon className="size-4" />
                                  查看
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      : null}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>已选择 {selectedIds.size} 条，共 {filteredRecords.length} 条匹配记录</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>
                    <ChevronLeftIcon className="size-4" />
                    上一页
                  </Button>
                  <span>{currentPage} / {maxPage}</span>
                  <Button variant="outline" size="sm" disabled={currentPage >= maxPage} onClick={() => setPage((value) => Math.min(value + 1, maxPage))}>
                    下一页
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <PreviewDrawer
        record={previewRecord}
        author={previewRecord ? usersById.get(previewRecord.recorded_by) : undefined}
        family={previewRecord ? familiesById.get(previewRecord.family_id) : undefined}
        open={Boolean(previewId)}
        loading={previewLoading}
        error={previewError}
        reviewNote={reviewNote}
        operation={operation}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewId(null)
            setPreviewDetail(null)
            setPreviewError(null)
          }
        }}
        onReviewNoteChange={setReviewNote}
        onReview={(action) => {
          if (previewRecord) void updateRecord([previewRecord.id], action, reviewNote)
        }}
      />
    </main>
  )
}

function SortButton({
  active,
  direction,
  onClick,
  children,
}: {
  active: boolean
  direction: SortDirection
  onClick: () => void
  children: React.ReactNode
}) {
  const Icon = direction === "asc" ? ArrowUpIcon : ArrowDownIcon
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 font-medium">
      {children}
      {active ? <Icon className="size-3.5" /> : null}
    </button>
  )
}

function PreviewDrawer({
  record,
  author,
  family,
  open,
  loading,
  error,
  reviewNote,
  operation,
  onOpenChange,
  onReviewNoteChange,
  onReview,
}: {
  record: RecordListItem | RecordDetail | null
  author?: AdminUserRow
  family?: FamilyRow
  open: boolean
  loading: boolean
  error: string | null
  reviewNote: string
  operation: OperationState
  onOpenChange: (open: boolean) => void
  onReviewNoteChange: (value: string) => void
  onReview: (action: ReviewAction) => void
}) {
  const detail = record && "media" in record ? record : null
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="w-full sm:max-w-xl">
        {record ? (
          <>
            <DrawerHeader className="border-b">
              <div className="flex items-center gap-2">
                <ContentTypePill modes={record.capture_modes} primary={record.primary_capture_mode} />
                <Badge variant={statusBadge[getStatus(record)]}>{statusLabels[getStatus(record)]}</Badge>
              </div>
              <DrawerTitle className="mt-2 text-xl">{record.title || record.snapshot.activity_title || "未命名记录"}</DrawerTitle>
              <DrawerDescription>{formatDate(record.created_at)} · 详情读取走治理访问路径</DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto p-4">
              <section className="space-y-3">
                {loading ? (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">正在加载治理详情...</div>
                ) : null}
                {error ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
                ) : null}

                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="text-xs font-medium text-muted-foreground">记录内容</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{record.caption || "无正文"}</p>
                  {record.transcript ? (
                    <div className="mt-3 rounded-lg bg-background p-3 text-sm text-muted-foreground">
                      <div className="mb-1 font-medium text-foreground">转写文本</div>
                      {record.transcript}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="text-xs font-medium text-muted-foreground">完成时事情快照</div>
                  <div className="mt-2 text-sm font-medium">{record.snapshot.activity_title || "未记录标题"}</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{record.snapshot.record_hint || "未记录提示"}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <ContextItem label="作者" value={author?.username ?? author?.generatedEmail ?? record.recorded_by} detail={record.recorded_by} />
                  <ContextItem label="家庭" value={family?.inviteCode ?? record.family_id} detail={`成员 ${family?.memberCount ?? "未知"} · 记录 ${family?.memoryCount ?? "未知"}`} />
                  <ContextItem label="孩子" value={record.kid_id} detail={`activity ${record.activity_id}`} />
                  <ContextItem label="封存" value={record.sealed === "sealed" ? "已封存" : "未封存"} detail={record.moderation_note || "无审核备注"} />
                </div>

                {detail ? (
                  <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                    媒体附件 {detail.media.length} 个；审计事件 {detail.governance_metadata.audit_event_id ?? "由 RPC 记录或待返回"}。
                  </div>
                ) : null}

                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="review-note">
                    审核处理备注
                  </label>
                  <textarea
                    id="review-note"
                    value={reviewNote}
                    onChange={(event) => onReviewNoteChange(event.target.value)}
                    className="mt-2 min-h-28 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    placeholder="驳回或隐藏必须填写原因，通过可填写备注"
                  />
                </div>
              </section>
            </div>

            <DrawerFooter className="border-t">
              <OperationBanner operation={operation} />
              <div className="grid gap-2 sm:grid-cols-3">
                <Button disabled={operation.phase === "pending"} onClick={() => onReview("approved")}>
                  <CheckCircle2Icon className="size-4" />
                  通过
                </Button>
                <Button variant="destructive" disabled={operation.phase === "pending"} onClick={() => onReview("rejected")}>
                  <AlertTriangleIcon className="size-4" />
                  驳回
                </Button>
                <Button variant="destructive" disabled={operation.phase === "pending"} onClick={() => onReview("hidden")}>
                  <Trash2Icon className="size-4" />
                  隐藏
                </Button>
              </div>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}

function ContextItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-foreground">{value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}
