import * as React from "react"
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  LockKeyholeIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { AdminPagination } from "@/components/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  createAdminRepository,
  isGovernanceReasonReady,
  resolveGovernanceReason,
  useGovernanceAuthorizationSettings,
} from "@/lib/admin"
import type {
  ActivityRecord,
  AdminReadModel,
  AdminRepository,
  CaptureMode,
  RecordDetail,
  RecordListItem,
  RecordMediaKind,
  RecordModerationStatus,
} from "@/lib/admin"

type ModerationFilter = RecordModerationStatus | "all"

const defaultPageSize = 10
const reasonMinimumLength = 8

async function openRepository() {
  return createAdminRepository()
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

function shortId(value?: string | null) {
  if (!value) return "未返回"
  if (value.length <= 12) return value
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

function captureLabel(mode: CaptureMode) {
  if (mode === "photo") return "照片"
  if (mode === "video") return "视频"
  if (mode === "voice") return "语音"
  return "文字"
}

function mediaLabel(kind: RecordMediaKind) {
  if (kind === "image") return "图片"
  if (kind === "video") return "视频"
  if (kind === "audio") return "音频"
  if (kind === "text") return "文字"
  return "其他"
}

function statusLabel(status?: RecordModerationStatus | null) {
  if (status === "pending") return "待处理"
  if (status === "approved") return "已通过"
  if (status === "rejected") return "已拒绝"
  if (status === "hidden") return "已隐藏"
  return "未标记"
}

function statusClassName(status?: RecordModerationStatus | null) {
  if (status === "approved") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (status === "pending") return "bg-amber-500/10 text-amber-700 dark:text-amber-300"
  if (status === "rejected" || status === "hidden") return "bg-destructive/10 text-destructive"
  return "bg-muted text-muted-foreground"
}

function dataSourceLabel(source: RecordListItem["read_model_source"]) {
  if (source === "governed_rpc") return "受限访问数据"
  if (source === "memories_compat_rpc") return "完成记录数据"
  return "完成记录新数据"
}

function recordTitle(record: ActivityRecord) {
  return record.title || record.snapshot.activity_title || "未命名记录"
}

function recordSummary(record: ActivityRecord) {
  return record.caption || record.transcript || record.snapshot.record_hint || "无文本摘要"
}

function formatModes(record: ActivityRecord) {
  const modes = record.capture_modes.length > 0 ? record.capture_modes : [record.primary_capture_mode]
  return modes.map(captureLabel).join(" / ")
}

function formatDuration(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number") return `${value} 秒`
  return value
}

function StateBlock({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/15 px-4 py-8 text-center">
      <div className="text-base font-medium">{title}</div>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}

function LoadingRows() {
  return Array.from({ length: 6 }).map((_, index) => (
    <TableRow key={index}>
      <TableCell><Skeleton className="h-5 w-52" /></TableCell>
      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
      <TableCell><Skeleton className="ml-auto size-8" /></TableCell>
    </TableRow>
  ))
}

function StatusPill({ status }: { status?: RecordModerationStatus | null }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ${statusClassName(status)}`}>
      {statusLabel(status)}
    </span>
  )
}

function CopyText({ value, label }: { value?: string | null; label: string }) {
  const [copied, setCopied] = React.useState(false)
  if (!value) return null

  async function copyValue(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    await navigator.clipboard?.writeText(value ?? "")
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Button variant="ghost" size="icon-sm" title={label} aria-label={label} onClick={(event) => void copyValue(event)}>
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
    </Button>
  )
}

function DetailLine({
  label,
  value,
  copyable = false,
  copyValue,
}: {
  label: string
  value?: React.ReactNode
  copyable?: boolean
  copyValue?: string | null
}) {
  const textValue = copyValue ?? (typeof value === "string" ? value : null)
  return (
    <div className="grid gap-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex min-h-6 items-center gap-1 text-sm">
        <span className="min-w-0 break-words">{value || "未返回"}</span>
        {copyable ? <CopyText value={textValue} label={`复制${label}`} /> : null}
      </div>
    </div>
  )
}

function GovernancePanel({
  reason,
  loading,
  loadedReason,
  onReasonChange,
  onLoad,
}: {
  reason: string
  loading: boolean
  loadedReason: string | null
  onReasonChange: (value: string) => void
  onLoad: () => void
}) {
  const { automaticReason, manualAuthorizationEnabled } = useGovernanceAuthorizationSettings()
  const ready = isGovernanceReasonReady(reason, reasonMinimumLength)
  const remaining = Math.max(0, reasonMinimumLength - reason.trim().length)

  return (
    <section className="grid gap-3 rounded-lg border bg-background p-4">
      <div className="flex items-start gap-3">
        <LockKeyholeIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="text-sm font-medium">进入家庭私有记录范围</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">读取家庭完成记录前需要明确治理理由，系统会保留本次访问记录。</p>
        </div>
      </div>
      {manualAuthorizationEnabled ? (
        <>
          <textarea
            className="min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="例如：审核案件 CASE-123，需核对被举报完成记录。"
            aria-label="治理访问理由"
          />
          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{ready ? (loadedReason ? "已授权，可刷新列表" : "理由有效，可以加载列表") : `还需输入 ${remaining} 个字符`}</span>
            <Button onClick={onLoad} disabled={loading || !ready}>
              <ShieldCheckIcon />
              {loading ? "正在加载" : loadedReason ? "刷新列表" : "加载记录"}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">手动授权已关闭，本次会使用临时排查理由：{automaticReason}</p>
          <Button onClick={onLoad} disabled={loading}>
            <ShieldCheckIcon />
            {loading ? "正在加载" : loadedReason ? "刷新列表" : "加载记录"}
          </Button>
        </div>
      )}
    </section>
  )
}

function DetailAccessPanel({
  reason,
  loading,
  error,
  onReasonChange,
  onLoad,
}: {
  reason: string
  loading: boolean
  error: string | null
  onReasonChange: (value: string) => void
  onLoad: () => void
}) {
  const { automaticReason, manualAuthorizationEnabled } = useGovernanceAuthorizationSettings()
  const ready = isGovernanceReasonReady(reason, reasonMinimumLength)

  return (
    <section className="grid gap-3 rounded-lg border bg-background p-4">
      <div>
        <h2 className="text-sm font-medium">查看私有详情</h2>
        <p className="mt-1 text-sm text-muted-foreground">详情会单独请求，媒体与完整内容不会在列表常驻展开。</p>
      </div>
      {manualAuthorizationEnabled ? (
        <textarea
          className="min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="例如：审核案件 CASE-123，需查看记录媒体。"
          aria-label="详情治理访问理由"
        />
      ) : (
        <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">使用临时排查理由：{automaticReason}</p>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button onClick={onLoad} disabled={loading || !ready}>
          <LockKeyholeIcon />
          {loading ? "正在读取" : "查看详情"}
        </Button>
      </div>
    </section>
  )
}

function RecordsTable({
  rows,
  loading,
  canViewPrivateRecords,
  onSelect,
}: {
  rows: RecordListItem[]
  loading: boolean
  canViewPrivateRecords: boolean
  onSelect: (record: RecordListItem) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>事情</TableHead>
          <TableHead>家庭 / 成员</TableHead>
          <TableHead>完成方式</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>时间</TableHead>
          {canViewPrivateRecords ? <TableHead className="text-right">操作</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? <LoadingRows /> : rows.map((record) => (
          <TableRow key={record.id}>
            <TableCell className="min-w-72 whitespace-normal">
              <div className="font-medium">{recordTitle(record)}</div>
              <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{recordSummary(record)}</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <span>记录 {shortId(record.id)}</span>
                <CopyText value={record.id} label="复制记录 ID" />
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1 text-sm">
                <span>家庭 {shortId(record.family_id)}</span>
                <CopyText value={record.family_id} label="复制家庭 ID" />
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <span>{record.kid_id ? `孩子 ${shortId(record.kid_id)}` : `成员 ${shortId(record.recorded_by)}`}</span>
                <CopyText value={record.kid_id ?? record.recorded_by} label={record.kid_id ? "复制孩子 ID" : "复制成员 ID"} />
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">{formatModes(record)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {record.media_count ?? 0} 个附件{record.duration ? ` · ${formatDuration(record.duration)}` : ""}
              </div>
            </TableCell>
            <TableCell><StatusPill status={record.moderation_status} /></TableCell>
            <TableCell>
              <div className="text-sm">{formatDate(record.recorded_at)}</div>
              {record.place ? <div className="mt-1 max-w-36 truncate text-xs text-muted-foreground">{record.place}</div> : null}
            </TableCell>
            {canViewPrivateRecords ? (
              <TableCell className="text-right">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="查看详情"
                  aria-label={`查看 ${recordTitle(record)} 详情`}
                  onClick={() => onSelect(record)}
                >
                  <EyeIcon />
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RecordDetailView({
  selectedRecord,
  detail,
  detailReason,
  detailLoading,
  detailError,
  onBack,
  onReasonChange,
  onLoadDetail,
}: {
  selectedRecord: RecordListItem
  detail: RecordDetail | null
  detailReason: string
  detailLoading: boolean
  detailError: string | null
  onBack: () => void
  onReasonChange: (value: string) => void
  onLoadDetail: () => void
}) {
  const record = detail ?? selectedRecord
  const duration = formatDuration(record.duration)
  const attachmentSummary = detail ? `${detail.media.length} 个附件` : `${record.media_count ?? 0} 个附件`

  return (
    <main className="admin-page @container/main flex flex-1 flex-col gap-4 md:gap-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={onBack}>
            <ArrowLeftIcon />
            返回记录列表
          </Button>
          <h1 className="break-words text-2xl font-semibold tracking-normal">{recordTitle(record)}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            家庭完成记录详情，只在本次治理访问中读取。
          </p>
        </div>
        <StatusPill status={record.moderation_status} />
      </header>

      {!detail ? (
        detailLoading ? (
          <StateBlock title="详情加载中" description="正在读取记录详情，并保留访问记录。" />
        ) : (
          <DetailAccessPanel
            reason={detailReason}
            loading={detailLoading}
            error={detailError}
            onReasonChange={onReasonChange}
            onLoad={onLoadDetail}
          />
        )
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="rounded-lg border bg-background">
          <div className="grid gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">证据与快照</h2>
              <span className="text-xs text-muted-foreground">{attachmentSummary}</span>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">记录内容</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{record.caption || record.transcript || "无正文内容"}</p>
            </div>
            {record.transcript && record.caption ? (
              <div className="rounded-md border bg-muted/10 px-3 py-2">
                <div className="text-xs text-muted-foreground">转写内容</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{record.transcript}</p>
              </div>
            ) : null}
          </div>

          <div className="border-t p-4">
            <div className="text-xs text-muted-foreground">完成时事情快照</div>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <DetailLine label="为什么值得做" value={record.snapshot.activity_why || "未返回"} />
              <DetailLine label="可以怎么做" value={record.snapshot.activity_how || "未返回"} />
              <DetailLine label="记录些什么" value={record.snapshot.record_hint || "未返回"} />
            </div>
          </div>

          <div className="border-t p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">附件摘要</div>
              <span className="text-xs text-muted-foreground">{detail ? `${detail.media.length} 个` : "详情读取后显示"}</span>
            </div>
            {!detail ? (
              <p className="text-sm text-muted-foreground">列表只显示附件数量，不展开家庭私有媒体。</p>
            ) : detail.media.length === 0 ? (
              <p className="text-sm text-muted-foreground">没有返回媒体附件。</p>
            ) : (
              <div className="grid gap-2">
                {detail.media.map((media) => (
                  <div key={media.id} className="grid gap-1 rounded-md border bg-muted/10 px-3 py-2 text-sm sm:grid-cols-[140px_1fr]">
                    <div className="font-medium">{mediaLabel(media.kind)}{media.is_primary ? " · 主附件" : ""}</div>
                    <div className="min-w-0 text-muted-foreground">
                      附件信息
                      {media.duration ? ` · ${media.duration} 秒` : ""}
                      {media.width && media.height ? ` · ${media.width}x${media.height}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="grid gap-3 rounded-lg border bg-background p-4">
            <h2 className="text-sm font-medium">状态与时间</h2>
            <div className="grid gap-3">
              <DetailLine label="状态" value={<StatusPill status={record.moderation_status} />} />
              <DetailLine label="完成时间" value={formatDate(record.recorded_at)} />
              <DetailLine label="记录方式" value={formatModes(record)} />
              <DetailLine label="附件数量" value={attachmentSummary} />
              <DetailLine label="封存状态" value={record.sealed === "sealed" ? (record.seal_label ?? record.seal_until ?? "已封存") : "未封存"} />
              {record.place ? <DetailLine label="地点" value={record.place} /> : null}
              {duration ? <DetailLine label="时长" value={duration} /> : null}
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border bg-background p-4">
            <h2 className="text-sm font-medium">范围与元数据</h2>
            <div className="grid gap-3">
              <DetailLine label="记录" value={shortId(record.id)} copyable copyValue={record.id} />
              <DetailLine label="家庭" value={shortId(record.family_id)} copyable copyValue={record.family_id} />
              <DetailLine label="孩子" value={shortId(record.kid_id)} copyable copyValue={record.kid_id} />
              <DetailLine label="记录者" value={shortId(record.recorded_by)} copyable copyValue={record.recorded_by} />
              {detail ? (
                <DetailLine
                  label="访问记录"
                  value={shortId(detail.governance_metadata.audit_event_id)}
                  copyable
                  copyValue={detail.governance_metadata.audit_event_id}
                />
              ) : null}
            </div>
          </div>
        </aside>
      </section>

      <details className="rounded-lg border bg-background p-4">
        <summary className="cursor-pointer text-sm font-medium">高级信息</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <DetailLine label="记录 ID" value={record.id} copyable />
          <DetailLine label="事情 ID" value={record.activity_id} copyable />
          <DetailLine label="版本 ID" value={record.activity_version_id} copyable />
          <DetailLine label="记录者 ID" value={record.recorded_by} copyable />
          <DetailLine label="读取范围" value={dataSourceLabel(record.read_model_source)} />
          {detail ? <DetailLine label="访问记录" value={detail.governance_metadata.audit_event_id ?? "未返回"} copyable /> : null}
          {detail?.media.map((media) => (
            <DetailLine key={media.id} label={`${mediaLabel(media.kind)}附件位置`} value={media.storage_path ?? "未返回"} copyable />
          ))}
        </div>
      </details>
    </main>
  )
}

export function RecordsPage() {
  const [repository, setRepository] = React.useState<AdminRepository | null>(null)
  const [readModel, setReadModel] = React.useState<AdminReadModel<RecordListItem> | null>(null)
  const [records, setRecords] = React.useState<RecordListItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<ModerationFilter>("all")
  const [governanceReason, setGovernanceReason] = React.useState("")
  const [loadedReason, setLoadedReason] = React.useState<string | null>(null)
  const [privateScopeOpen, setPrivateScopeOpen] = React.useState(false)
  const [authorizationPanelOpen, setAuthorizationPanelOpen] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(defaultPageSize)
  const [selectedRecord, setSelectedRecord] = React.useState<RecordListItem | null>(null)
  const [detail, setDetail] = React.useState<RecordDetail | null>(null)
  const [detailReason, setDetailReason] = React.useState("")
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detailError, setDetailError] = React.useState<string | null>(null)
  const [canViewPrivateRecords, setCanViewPrivateRecords] = React.useState<boolean | null>(null)

  const reasonReady = isGovernanceReasonReady(governanceReason, reasonMinimumLength)

  const loadData = React.useCallback(async () => {
    setPrivateScopeOpen(true)
    if (!isGovernanceReasonReady(governanceReason, reasonMinimumLength)) return

    setLoading(true)
    setError(null)
    try {
      const adminRepository = repository ?? await openRepository()
      setRepository(adminRepository)

      const permission = await adminRepository.getPermissionSummary()
      if (!permission.capabilities.includes("record.view_governed")) {
        setCanViewPrivateRecords(false)
        setReadModel({
          status: "permission_denied",
          source: adminRepository.mode,
          generatedAt: new Date().toISOString(),
          items: [],
          permissionDeniedReason: "当前角色不能查看家庭完成记录。",
        })
        setRecords([])
        return
      }

      setCanViewPrivateRecords(true)
      const reason = resolveGovernanceReason(governanceReason)
      const model = await adminRepository.listRecords({
        limit: 200,
        search: search.trim() || undefined,
        moderationStatus: status,
        governanceReason: reason,
      })
      setReadModel(model)
      setRecords(model.items)
      setLoadedReason(reason)
      setAuthorizationPanelOpen(false)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "记录加载失败")
    } finally {
      setLoading(false)
    }
  }, [governanceReason, repository, search, status])

  React.useEffect(() => {
    setPage(1)
  }, [search, status])

  function openPrivateScope() {
    setPrivateScopeOpen(true)
    setAuthorizationPanelOpen(true)
  }

  function selectRecord(record: RecordListItem) {
    setSelectedRecord(record)
    setDetail(null)
    setDetailError(null)
    setDetailReason(loadedReason ?? governanceReason)
  }

  function backToList() {
    setSelectedRecord(null)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(false)
  }

  async function loadDetail() {
    if (!selectedRecord) return
    const reasonCandidate = detailReason.trim() || loadedReason || ""
    if (!isGovernanceReasonReady(reasonCandidate, reasonMinimumLength)) {
      setDetailError(`查看家庭完成记录详情必须填写至少 ${reasonMinimumLength} 个字符的治理理由。`)
      return
    }

    setDetailLoading(true)
    setDetailError(null)
    try {
      const adminRepository = repository ?? await openRepository()
      setRepository(adminRepository)
      const reason = resolveGovernanceReason(reasonCandidate)
      const recordDetail = await adminRepository.getRecordDetail(selectedRecord.id, { governanceReason: reason })
      setDetail(recordDetail)
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : "记录详情加载失败")
    } finally {
      setDetailLoading(false)
    }
  }

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return records
      .filter((record) => status === "all" || record.moderation_status === status)
      .filter((record) => {
        if (!query) return true
        return [
          record.id,
          record.family_id,
          record.kid_id,
          record.title ?? "",
          record.caption ?? "",
          record.transcript ?? "",
          record.snapshot.activity_title,
        ].join(" ").toLowerCase().includes(query)
      })
      .sort((left, right) => new Date(right.recorded_at).getTime() - new Date(left.recorded_at).getTime())
  }, [records, search, status])

  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, maxPage)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const loadedAt = readModel?.generatedAt ? formatDate(readModel.generatedAt) : null
  const canShowRows = Boolean(loadedReason) && canViewPrivateRecords !== false

  if (selectedRecord) {
    return (
      <RecordDetailView
        selectedRecord={selectedRecord}
        detail={detail}
        detailReason={detailReason}
        detailLoading={detailLoading}
        detailError={detailError}
        onBack={backToList}
        onReasonChange={setDetailReason}
        onLoadDetail={() => void loadDetail()}
      />
    )
  }

  return (
    <main className="admin-page @container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mt-1 text-sm text-muted-foreground">查看家庭完成事实、记录方式和治理状态。</p>
        </div>
        {canViewPrivateRecords === false ? null : privateScopeOpen ? (
          <Button variant="outline" onClick={() => void loadData()} disabled={loading || !reasonReady}>
            <RefreshCwIcon className={loading ? "animate-spin" : undefined} />
            {loadedReason ? "刷新" : "加载记录"}
          </Button>
        ) : (
          <Button variant="outline" onClick={openPrivateScope}>
            <LockKeyholeIcon />
            进入私有范围
          </Button>
        )}
      </div>

      {privateScopeOpen && (!loadedReason || authorizationPanelOpen) ? (
        <GovernancePanel
          reason={governanceReason}
          loading={loading}
          loadedReason={loadedReason}
          onReasonChange={setGovernanceReason}
          onLoad={() => void loadData()}
        />
      ) : null}

      <section className="rounded-lg border bg-background">
        <div className="grid gap-3 border-b p-4">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px]">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题、摘要、家庭或孩子" />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value as ModerationFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="approved">已通过</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
                <SelectItem value="hidden">已隐藏</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{loadedReason ? `${filtered.length} 条匹配记录${loadedAt ? ` · ${loadedAt} 更新` : ""}` : "尚未读取家庭私有记录"}</span>
            <div className="flex flex-wrap items-center gap-2">
              {loadedReason ? (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheckIcon className="size-3.5" />
                  已授权读取，访问会保留记录
                </span>
              ) : null}
              {loadedReason ? (
                <Button variant="ghost" size="xs" onClick={() => setAuthorizationPanelOpen(true)}>
                  调整理由
                </Button>
              ) : null}
              {readModel?.status === "permission_denied" ? <span>{readModel.permissionDeniedReason}</span> : null}
            </div>
          </div>
        </div>

        <div className="p-4">
          {error ? (
            <StateBlock
              title={error.toLowerCase().includes("permission") ? "权限不足" : "记录加载失败"}
              description={error}
              action={canViewPrivateRecords === false ? undefined : <Button variant="outline" onClick={() => void loadData()}>重试</Button>}
            />
          ) : canViewPrivateRecords === false ? (
            <StateBlock title="权限不足" description="当前角色没有家庭完成记录治理查看权限。" />
          ) : !privateScopeOpen ? (
            <StateBlock
              title="未进入私有范围"
              description="默认不请求家庭完成记录。进入私有范围并填写治理理由后加载列表。"
              action={<Button variant="outline" onClick={openPrivateScope}><LockKeyholeIcon />进入私有范围</Button>}
            />
          ) : loading && !loadedReason ? (
            <StateBlock title="记录加载中" description="正在读取家庭完成记录，并保留本次访问记录。" />
          ) : !loadedReason ? (
            <StateBlock title="等待治理理由" description="填写明确理由后，才会读取家庭完成记录。" />
          ) : !loading && filtered.length === 0 ? (
            <StateBlock title="暂无记录" description="没有匹配当前筛选条件的完成记录。" />
          ) : (
            <RecordsTable
              rows={rows}
              loading={loading}
              canViewPrivateRecords={canShowRows}
              onSelect={selectRecord}
            />
          )}
        </div>

        {loadedReason && !error && canViewPrivateRecords !== false ? (
          <AdminPagination
            total={filtered.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
            disabled={loading}
            className="px-4"
          />
        ) : null}
      </section>
    </main>
  )
}

export default RecordsPage
