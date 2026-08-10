import * as React from "react"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ClipboardIcon,
  FileSearchIcon,
  GavelIcon,
  Loader2Icon,
  LockKeyholeIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"

import { AdminPagination, ConfirmActionDialog } from "@/components/admin"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { createAdminRepository, createDemoAdminRepository, isGovernanceReasonReady, resolveGovernanceReason, useGovernanceAuthorizationSettings } from "@/lib/admin"
import type {
  AdminReadModel,
  AdminRepository,
  ModerationCase,
  ModerationCaseKind,
  ModerationCaseStatus,
  RoleCapabilitySummary,
} from "@/lib/admin"

type CaseStatusFilter = ModerationCaseStatus | "all"
type CaseKindFilter = ModerationCaseKind | "all"
type CaseTargetType = ModerationCase["target_type"]
type ResolutionStatus = Extract<ModerationCaseStatus, "resolved" | "rejected" | "closed">
type OperationPhase = "idle" | "pending" | "success" | "error"
type MobilePane = "list" | "detail"

type OperationState = {
  phase: OperationPhase
  message: string | null
}

type CreateCaseForm = {
  kind: ModerationCaseKind
  targetType: CaseTargetType
  targetId: string
  familyId: string
  assignedTo: string
  reason: string
}

type ResolutionForm = {
  status: ResolutionStatus
  resolutionNote: string
  governanceReason: string
}

const caseKinds: ModerationCaseKind[] = ["record_review", "activity_review", "asset_review", "family_support", "policy_violation", "public_request"]
const caseStatuses: ModerationCaseStatus[] = ["open", "in_review", "resolved", "rejected", "closed"]
const targetTypes: CaseTargetType[] = ["record", "activity", "activity_version", "asset", "family"]
const resolutionStatuses: ResolutionStatus[] = ["resolved", "rejected", "closed"]
const explicitReasonMinLength = 8
const defaultQueuePageSize = 12
const queuePageSizeOptions = [10, 12, 15]

async function openRepository() {
  if (import.meta.env.VITE_ADMIN_DATA_MODE?.trim().toLowerCase() === "demo") {
    return createDemoAdminRepository("显式 VITE_ADMIN_DATA_MODE=demo，当前治理案件为只读演示数据。")
  }
  return createAdminRepository()
}

function formatDate(value?: string | null) {
  if (!value) return "未记录"
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function caseStatusLabel(status: ModerationCaseStatus) {
  if (status === "open") return "打开"
  if (status === "in_review") return "审核中"
  if (status === "resolved") return "已解决"
  if (status === "rejected") return "已拒绝"
  return "已关闭"
}

function caseKindLabel(kind: ModerationCaseKind) {
  if (kind === "record_review") return "记录审核"
  if (kind === "activity_review") return "事情审核"
  if (kind === "asset_review") return "资产审核"
  if (kind === "family_support") return "家庭支持"
  if (kind === "policy_violation") return "规则风险"
  return "公开申请"
}

function targetTypeLabel(type: CaseTargetType) {
  if (type === "record") return "家庭记录"
  if (type === "activity") return "事情"
  if (type === "activity_version") return "事情版本"
  if (type === "asset") return "资产"
  return "家庭"
}

function statusPillClass(status: ModerationCaseStatus) {
  if (status === "open") return "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100"
  if (status === "in_review") return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
  if (status === "rejected") return "border-destructive/30 bg-destructive/10 text-destructive"
  return "border-border bg-muted/60 text-muted-foreground"
}

function isExplicitGovernanceReason(value: string) {
  return value.trim().length >= explicitReasonMinLength
}

function isMutableStatus(status: ModerationCaseStatus) {
  return status === "open" || status === "in_review"
}

function isFamilyPrivateCase(item: Pick<CreateCaseForm, "targetType" | "familyId">) {
  return item.targetType === "record" || item.targetType === "family" || Boolean(item.familyId?.trim())
}

function caseMatches(item: ModerationCase, query: string) {
  if (!query) return true
  return [
    item.id,
    item.kind,
    item.status,
    item.reason,
    item.target_type,
    item.target_id,
    item.family_id ?? "",
    item.assigned_to ?? "",
    item.resolution_note ?? "",
    item.audit_event_id ?? "",
  ].join(" ").toLowerCase().includes(query)
}

function OperationNotice({ state }: { state: OperationState }) {
  if (state.phase === "idle" || !state.message) return null
  const isError = state.phase === "error"
  const isPending = state.phase === "pending"
  const Icon = isPending ? Loader2Icon : isError ? AlertTriangleIcon : CheckCircle2Icon
  return (
    <div className={[
      "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
      isError
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-border bg-muted/40 text-muted-foreground",
    ].join(" ")}>
      <Icon className={["size-4", isPending ? "animate-spin" : ""].join(" ")} />
      <span>{state.message}</span>
    </div>
  )
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
      <div className="text-sm font-medium">{title}</div>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}

function StatusPill({ status }: { status: ModerationCaseStatus }) {
  return (
    <span className={["inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-xs font-medium", statusPillClass(status)].join(" ")}>
      {caseStatusLabel(status)}
    </span>
  )
}

function QueueSkeleton() {
  return (
    <div className="grid gap-2 p-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-md border p-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-48" />
        </div>
      ))}
    </div>
  )
}

function CopyButton({ value, label }: { value?: string | null; label: string }) {
  if (!value) return null
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7 shrink-0"
      onClick={() => void navigator.clipboard?.writeText(value)}
      aria-label={`复制${label}`}
      title={`复制${label}`}
    >
      <ClipboardIcon className="size-3.5" />
    </Button>
  )
}

function IdRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-muted-foreground">{value || "未记录"}</span>
      <CopyButton label={label} value={value} />
    </div>
  )
}

function DetailLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-sm">{value}</div>
    </div>
  )
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 rounded-md border bg-muted/15 p-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  )
}

function CaseDetail({ item, onBack }: { item: ModerationCase; onBack: () => void }) {
  const hasFamilyBoundary = item.family_id || item.target_type === "record" || item.target_type === "family"
  const targetSummary = `${targetTypeLabel(item.target_type)}${hasFamilyBoundary ? " · 家庭关联" : ""}`

  return (
    <section className="min-w-0 rounded-md border bg-background shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack} aria-label="返回列表">
              <ArrowLeftIcon />
            </Button>
            <h2 className="truncate text-lg font-semibold">{caseKindLabel(item.kind)}</h2>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{targetSummary}</p>
        </div>
        <StatusPill status={item.status} />
      </div>

      <div className="grid gap-4 p-4">
        <DetailBlock title="对象摘要">
          <div className="grid gap-3 sm:grid-cols-3">
            <DetailLine label="类型" value={targetTypeLabel(item.target_type)} />
            <DetailLine label="家庭边界" value={hasFamilyBoundary ? "家庭私有或家庭关联" : "未绑定家庭"} />
            <DetailLine label="当前状态" value={<StatusPill status={item.status} />} />
          </div>
        </DetailBlock>

        <DetailBlock title="说明">
          <p className="whitespace-pre-wrap text-sm leading-6">{item.reason}</p>
        </DetailBlock>

        <DetailBlock title="时间">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailLine label="创建时间" value={formatDate(item.opened_at)} />
            <DetailLine label="处理时间" value={formatDate(item.resolved_at)} />
          </div>
        </DetailBlock>

        {item.resolution_note ? (
          <DetailBlock title="处理结果">
            <p className="whitespace-pre-wrap text-sm leading-6">{item.resolution_note}</p>
          </DetailBlock>
        ) : null}

        <details className="rounded-md border bg-muted/25 p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">技术 ID</summary>
          <div className="mt-3 grid gap-2">
            <IdRow label="案件 ID" value={item.id} />
            <IdRow label="目标 ID" value={item.target_id} />
            <IdRow label="家庭 ID" value={item.family_id} />
            <IdRow label="审计 ID" value={item.audit_event_id} />
            <IdRow label="打开人" value={item.opened_by} />
            <IdRow label="分派给" value={item.assigned_to} />
          </div>
        </details>
      </div>
    </section>
  )
}

function QueuePanel({
  cases,
  error,
  gateOpen,
  gateReason,
  loading,
  page,
  pageSize,
  repository,
  search,
  selectedCaseId,
  statusFilter,
  total,
  kindFilter,
  onGateReasonChange,
  onPageChange,
  onPageSizeChange,
  onRetry,
  onSearchChange,
  onSelectCase,
  onStatusChange,
  onKindChange,
  onUnlock,
}: {
  cases: ModerationCase[]
  error: string | null
  gateOpen: boolean
  gateReason: string
  loading: boolean
  page: number
  pageSize: number
  repository: AdminRepository | null
  search: string
  selectedCaseId: string | null
  statusFilter: CaseStatusFilter
  total: number
  kindFilter: CaseKindFilter
  onGateReasonChange: (value: string) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onRetry: () => void
  onSearchChange: (value: string) => void
  onSelectCase: (id: string) => void
  onStatusChange: (value: CaseStatusFilter) => void
  onKindChange: (value: CaseKindFilter) => void
  onUnlock: () => void
}) {
  const gateReasonReady = isGovernanceReasonReady(gateReason, explicitReasonMinLength)

  return (
    <aside className="min-h-[620px] overflow-hidden rounded-md border bg-background shadow-sm lg:w-[360px] lg:shrink-0 xl:w-[372px]">
      <div className="grid gap-2 border-b p-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
            <Input className="h-8 pl-8" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="搜索" />
          </div>
          <Select value={statusFilter} onValueChange={(value) => onStatusChange(value as CaseStatusFilter)}>
            <SelectTrigger size="sm" className="w-[92px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {caseStatuses.map((status) => <SelectItem key={status} value={status}>{caseStatusLabel(status)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={kindFilter} onValueChange={(value) => onKindChange(value as CaseKindFilter)}>
            <SelectTrigger size="sm" className="w-[92px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {caseKinds.map((kind) => <SelectItem key={kind} value={kind}>{caseKindLabel(kind)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>共 {total} 条</span>
          <span>每页 {pageSize} 条</span>
        </div>
      </div>

      {gateOpen ? (
        <div className="grid gap-4 p-4">
          <div className="flex items-start gap-3 rounded-md border border-amber-300/70 bg-amber-50/70 p-3 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
            <LockKeyholeIcon className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium">输入治理理由后读取队列</div>
              <p className="mt-1 text-xs leading-5 opacity-85">请说明本次查看案件队列的目的，成功读取后这里会切换为案件列表。</p>
            </div>
          </div>
          <textarea
            className="min-h-28 resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={gateReason}
            onChange={(event) => onGateReasonChange(event.target.value)}
            placeholder="例如：处理用户举报，需要查看待审核案件队列并判断处置方式。"
          />
          <Button onClick={onUnlock} disabled={loading || !gateReasonReady}>
            {loading ? <Loader2Icon className="animate-spin" /> : <FileSearchIcon />}
            读取队列
          </Button>
        </div>
      ) : error ? (
        <div className="p-3">
          <EmptyState title="队列加载失败" description={error} action={<Button variant="outline" onClick={onRetry}>重试</Button>} />
        </div>
      ) : loading ? (
        <QueueSkeleton />
      ) : cases.length === 0 ? (
        <div className="p-3">
          <EmptyState title="暂无案件" description={repository?.mode === "demo" ? "当前演示数据无匹配案件。" : "没有匹配当前筛选条件的案件。"} />
        </div>
      ) : (
        <>
          <div className="min-h-[420px] p-2">
            {cases.map((item) => (
              <button
                key={item.id}
                className={[
                  "mb-2 grid w-full gap-2 rounded-md border bg-background p-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-foreground/20 hover:bg-muted/35",
                  selectedCaseId === item.id ? "border-primary/50 ring-1 ring-primary/25" : "border-border",
                ].join(" ")}
                onClick={() => onSelectCase(item.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">{caseKindLabel(item.kind)}</span>
                  <StatusPill status={item.status} />
                </div>
                <div className="line-clamp-2 text-xs leading-5 text-muted-foreground">{item.reason}</div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{targetTypeLabel(item.target_type)}</span>
                  <span className="shrink-0">{formatDate(item.opened_at)}</span>
                </div>
              </button>
            ))}
          </div>
          <AdminPagination
            className="px-3"
            disabled={loading}
            total={total}
            page={page}
            pageSize={pageSize}
            pageSizeOptions={queuePageSizeOptions}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}
    </aside>
  )
}

function CreateCaseDialog({
  createForm,
  createNeedsFamilyReason,
  createState,
  disabled,
  open,
  onOpenChange,
  onSubmit,
  onUpdate,
}: {
  createForm: CreateCaseForm
  createNeedsFamilyReason: boolean
  createState: OperationState
  disabled: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
  onUpdate: (form: CreateCaseForm) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建案件</DialogTitle>
          <DialogDescription>填写目标和治理理由后创建待审核案件。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 px-6">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={createForm.kind} onValueChange={(value) => onUpdate({ ...createForm, kind: value as ModerationCaseKind })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {caseKinds.map((kind) => <SelectItem key={kind} value={kind}>{caseKindLabel(kind)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={createForm.targetType} onValueChange={(value) => onUpdate({ ...createForm, targetType: value as CaseTargetType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {targetTypes.map((type) => <SelectItem key={type} value={type}>{targetTypeLabel(type)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input value={createForm.targetId} onChange={(event) => onUpdate({ ...createForm, targetId: event.target.value })} placeholder="目标 ID" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={createForm.familyId} onChange={(event) => onUpdate({ ...createForm, familyId: event.target.value })} placeholder="家庭 ID（可选）" />
            <Input value={createForm.assignedTo} onChange={(event) => onUpdate({ ...createForm, assignedTo: event.target.value })} placeholder="分派给（可选）" />
          </div>
          <textarea
            className="min-h-28 resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={createForm.reason}
            onChange={(event) => onUpdate({ ...createForm, reason: event.target.value })}
            placeholder="治理理由：说明来源、目标对象和创建目的。"
          />
          {createNeedsFamilyReason ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              <LockKeyholeIcon className="mt-0.5 size-4 shrink-0" />
              <span>涉及家庭边界，请填写明确治理理由。</span>
            </div>
          ) : null}
          <OperationNotice state={createState} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={onSubmit} disabled={disabled}>
            {createState.phase === "pending" ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResolutionPanel({
  disabled,
  form,
  governanceSettings,
  onSubmit,
  onUpdate,
  state,
}: {
  disabled: boolean
  form: ResolutionForm
  governanceSettings: ReturnType<typeof useGovernanceAuthorizationSettings>
  onSubmit: () => void
  onUpdate: (form: ResolutionForm) => void
  state: OperationState
}) {
  return (
    <section className="rounded-md border bg-background shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">处理案件</h2>
        <p className="mt-1 text-xs text-muted-foreground">选择结论并填写处理说明，提交前需要再次确认。</p>
      </div>
      <div className="grid gap-3 p-4">
        <Select value={form.status} onValueChange={(value) => onUpdate({ ...form, status: value as ResolutionStatus })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {resolutionStatuses.map((status) => <SelectItem key={status} value={status}>{caseStatusLabel(status)}</SelectItem>)}
          </SelectContent>
        </Select>
        <textarea
          className="min-h-28 resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={form.resolutionNote}
          onChange={(event) => onUpdate({ ...form, resolutionNote: event.target.value })}
          placeholder="处理备注：说明结论、依据和后续边界。"
        />
        {governanceSettings.manualAuthorizationEnabled ? (
          <textarea
            className="min-h-24 resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={form.governanceReason}
            onChange={(event) => onUpdate({ ...form, governanceReason: event.target.value })}
            placeholder="治理理由：说明为什么可以执行本次处理。"
          />
        ) : (
          <div className="rounded-md border bg-muted/25 px-3 py-2 text-xs text-muted-foreground">治理授权已就绪，提交时会记录本次处理。</div>
        )}
        <OperationNotice state={state} />
        <Button onClick={onSubmit} disabled={disabled}>
          {state.phase === "pending" ? <Loader2Icon className="animate-spin" /> : <GavelIcon />}
          提交处理
        </Button>
      </div>
    </section>
  )
}

export function ModerationPage() {
  const [repository, setRepository] = React.useState<AdminRepository | null>(null)
  const [caseModel, setCaseModel] = React.useState<AdminReadModel<ModerationCase> | null>(null)
  const [cases, setCases] = React.useState<ModerationCase[]>([])
  const [currentSummary, setCurrentSummary] = React.useState<RoleCapabilitySummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [caseError, setCaseError] = React.useState<string | null>(null)
  const [permissionError, setPermissionError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [caseStatus, setCaseStatus] = React.useState<CaseStatusFilter>("open")
  const [caseKind, setCaseKind] = React.useState<CaseKindFilter>("all")
  const [gateReason, setGateReason] = React.useState("")
  const [listGovernanceReason, setListGovernanceReason] = React.useState("")
  const [queueUnlocked, setQueueUnlocked] = React.useState(false)
  const [selectedCaseId, setSelectedCaseId] = React.useState<string | null>(null)
  const [mobilePane, setMobilePane] = React.useState<MobilePane>("list")
  const [queuePage, setQueuePage] = React.useState(1)
  const [queuePageSize, setQueuePageSize] = React.useState(defaultQueuePageSize)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [resolveConfirmOpen, setResolveConfirmOpen] = React.useState(false)
  const [createForm, setCreateForm] = React.useState<CreateCaseForm>({
    kind: "record_review",
    targetType: "record",
    targetId: "",
    familyId: "",
    assignedTo: "",
    reason: "",
  })
  const [resolutionForm, setResolutionForm] = React.useState<ResolutionForm>({
    status: "resolved",
    resolutionNote: "",
    governanceReason: "",
  })
  const [createState, setCreateState] = React.useState<OperationState>({ phase: "idle", message: null })
  const [resolveState, setResolveState] = React.useState<OperationState>({ phase: "idle", message: null })
  const governanceSettings = useGovernanceAuthorizationSettings()

  const canManageCases = Boolean(currentSummary?.capabilities.includes("moderation.case.manage"))
  const canWriteLive = Boolean(repository && repository.mode !== "demo" && canManageCases)
  const createNeedsFamilyReason = isFamilyPrivateCase(createForm)
  const createReasonValid = isExplicitGovernanceReason(createForm.reason)
  const resolutionReasonValid = !governanceSettings.manualAuthorizationEnabled || isGovernanceReasonReady(resolutionForm.governanceReason, explicitReasonMinLength)
  const resolutionNoteValid = resolutionForm.resolutionNote.trim().length >= explicitReasonMinLength

  const visibleCases = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return cases
      .filter((item) => caseStatus === "all" || item.status === caseStatus)
      .filter((item) => caseKind === "all" || item.kind === caseKind)
      .filter((item) => caseMatches(item, query))
      .sort((left, right) => new Date(right.opened_at).getTime() - new Date(left.opened_at).getTime())
  }, [caseKind, caseStatus, cases, search])

  const queueTotalPages = Math.max(1, Math.ceil(visibleCases.length / queuePageSize))
  const safeQueuePage = Math.min(queuePage, queueTotalPages)
  const pagedCases = React.useMemo(() => {
    const start = (safeQueuePage - 1) * queuePageSize
    return visibleCases.slice(start, start + queuePageSize)
  }, [queuePageSize, safeQueuePage, visibleCases])

  const selectedCase = React.useMemo(() => {
    if (selectedCaseId) return visibleCases.find((item) => item.id === selectedCaseId) ?? cases.find((item) => item.id === selectedCaseId) ?? null
    return visibleCases[0] ?? null
  }, [cases, selectedCaseId, visibleCases])

  const selectedCaseMutable = Boolean(selectedCase && isMutableStatus(selectedCase.status))
  const pendingCount = cases.filter((item) => item.status === "open" || item.status === "in_review").length
  const gateOpen = Boolean(repository?.mode === "live" && governanceSettings.manualAuthorizationEnabled && !queueUnlocked)
  const disableCreate = !canWriteLive || createState.phase === "pending" || !createForm.targetId.trim() || !createReasonValid
  const disableResolve = !canWriteLive || resolveState.phase === "pending" || !selectedCaseMutable || !resolutionNoteValid || !resolutionReasonValid

  React.useEffect(() => {
    setQueuePage(1)
  }, [caseKind, caseStatus, search])

  React.useEffect(() => {
    if (queuePage > queueTotalPages) {
      setQueuePage(queueTotalPages)
    }
  }, [queuePage, queueTotalPages])

  const loadCases = React.useCallback(async (reasonOverride?: string, selectCaseId?: string) => {
    if (!repository) return
    setLoading(true)
    setCaseError(null)
    try {
      const reasonForRead = repository.mode === "demo"
        ? "[DEMO] moderation case list read"
        : governanceSettings.manualAuthorizationEnabled
          ? resolveGovernanceReason(reasonOverride ?? listGovernanceReason)
          : governanceSettings.automaticReason

      if (repository.mode === "live" && !isGovernanceReasonReady(reasonForRead, explicitReasonMinLength)) {
        setCases([])
        setCaseModel({
          status: "permission_denied",
          source: "live",
          generatedAt: new Date().toISOString(),
          items: [],
          permissionDeniedReason: `读取案件需要至少 ${explicitReasonMinLength} 个字符的治理理由。`,
        })
        return
      }

      const model = await repository.listModerationCases({
        limit: 100,
        status: caseStatus,
        kind: caseKind,
        search: search.trim() || undefined,
        governanceReason: reasonForRead,
      })
      setCaseModel(model)
      setCases(model.items)
      setSelectedCaseId((current) => {
        if (selectCaseId && model.items.some((item) => item.id === selectCaseId)) return selectCaseId
        if (current && model.items.some((item) => item.id === current)) return current
        return model.items[0]?.id ?? null
      })
    } catch (error) {
      setCases([])
      setCaseError(error instanceof Error ? error.message : "案件队列加载失败")
    } finally {
      setLoading(false)
    }
  }, [caseKind, caseStatus, governanceSettings.automaticReason, governanceSettings.manualAuthorizationEnabled, listGovernanceReason, repository, search])

  React.useEffect(() => {
    let active = true

    async function bootstrap() {
      setLoading(true)
      try {
        const adminRepository = await openRepository()
        if (!active) return
        setRepository(adminRepository)

        try {
          const current = await adminRepository.getPermissionSummary()
          if (active) setCurrentSummary(current)
        } catch (error) {
          if (!active) return
          setCurrentSummary(null)
          setPermissionError(error instanceof Error ? error.message : "当前账号权限不可用")
        }

        if (adminRepository.mode === "demo" || !governanceSettings.manualAuthorizationEnabled) {
          if (active) {
            setListGovernanceReason(adminRepository.mode === "demo" ? "[DEMO] moderation case list read" : governanceSettings.automaticReason)
            setQueueUnlocked(true)
          }
        } else if (active) {
          setLoading(false)
        }
      } catch (error) {
        if (!active) return
        setCaseError(error instanceof Error ? error.message : "审核工作台初始化失败")
        setLoading(false)
      }
    }

    void bootstrap()
    return () => {
      active = false
    }
  }, [governanceSettings.automaticReason, governanceSettings.manualAuthorizationEnabled])

  React.useEffect(() => {
    if (!repository || !queueUnlocked) return
    void loadCases()
  }, [loadCases, queueUnlocked, repository])

  function unlockQueue() {
    const reason = resolveGovernanceReason(gateReason)
    if (!isGovernanceReasonReady(reason, explicitReasonMinLength)) return
    setListGovernanceReason(reason)
    setQueueUnlocked(true)
  }

  async function createCase() {
    if (!repository || !canWriteLive) return
    if (!createForm.targetId.trim()) {
      setCreateState({ phase: "error", message: "必须填写目标 ID。" })
      return
    }
    if (!createReasonValid) {
      setCreateState({ phase: "error", message: `治理理由至少需要 ${explicitReasonMinLength} 个字符。` })
      return
    }

    setCreateState({ phase: "pending", message: "正在创建案件..." })
    try {
      const reason = createForm.reason.trim()
      const created = await repository.createModerationCase({
        kind: createForm.kind,
        targetType: createForm.targetType,
        targetId: createForm.targetId.trim(),
        familyId: createForm.familyId.trim() || null,
        assignedTo: createForm.assignedTo.trim() || null,
        reason,
      })
      setCreateState({ phase: "success", message: `已创建案件 ${created.id}。` })
      setSelectedCaseId(created.id)
      setMobilePane("detail")
      setListGovernanceReason(reason)
      setCreateForm((form) => ({ ...form, targetId: "", familyId: "", assignedTo: "", reason: "" }))
      setCreateOpen(false)
      await loadCases(reason, created.id)
    } catch (error) {
      setCreateState({ phase: "error", message: error instanceof Error ? error.message : "创建案件失败" })
    }
  }

  async function resolveCase() {
    if (!repository || !selectedCase || !canWriteLive) return
    if (!selectedCaseMutable) {
      setResolveState({ phase: "error", message: "当前状态不可处理。" })
      return
    }
    if (!resolutionNoteValid) {
      setResolveState({ phase: "error", message: `处理备注至少需要 ${explicitReasonMinLength} 个字符。` })
      return
    }
    if (!resolutionReasonValid) {
      setResolveState({ phase: "error", message: `治理理由至少需要 ${explicitReasonMinLength} 个字符。` })
      return
    }

    setResolveState({ phase: "pending", message: "正在提交处理..." })
    try {
      const reason = governanceSettings.manualAuthorizationEnabled
        ? resolveGovernanceReason(resolutionForm.governanceReason)
        : governanceSettings.automaticReason
      const updated = await repository.resolveModerationCase({
        caseId: selectedCase.id,
        status: resolutionForm.status,
        resolutionNote: resolutionForm.resolutionNote.trim(),
        governanceReason: reason,
      })
      setResolveConfirmOpen(false)
      setResolveState({ phase: "success", message: `案件已${caseStatusLabel(updated.status)}。` })
      setListGovernanceReason(reason)
      setResolutionForm((form) => ({ ...form, resolutionNote: "" }))
      await loadCases(reason, updated.id)
    } catch (error) {
      setResolveState({ phase: "error", message: error instanceof Error ? error.message : "处理案件失败" })
    }
  }

  function requestResolveCase() {
    if (!selectedCaseMutable) {
      setResolveState({ phase: "error", message: "当前状态不可处理。" })
      return
    }
    if (!resolutionNoteValid) {
      setResolveState({ phase: "error", message: `处理备注至少需要 ${explicitReasonMinLength} 个字符。` })
      return
    }
    if (!resolutionReasonValid) {
      setResolveState({ phase: "error", message: `治理理由至少需要 ${explicitReasonMinLength} 个字符。` })
      return
    }
    setResolveConfirmOpen(true)
  }

  function selectCase(id: string) {
    setSelectedCaseId(id)
    setMobilePane("detail")
    setResolveState({ phase: "idle", message: null })
  }

  return (
    <main className="admin-page @container/main flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-normal">审核工作台</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>待处理 {loading ? "..." : pendingCount}</span>
            {repository?.mode === "demo" ? <span>只读演示模式</span> : null}
            {permissionError ? <span>权限信息不可用：{permissionError}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadCases()} disabled={loading || gateOpen || !repository}>
            {loading ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
            刷新
          </Button>
          {canWriteLive ? (
            <Button variant="secondary" onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              新建案件
            </Button>
          ) : null}
        </div>
      </div>

      {!gateOpen && queueUnlocked ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
          <CheckCircle2Icon className="size-4" />
          <span>{repository?.mode === "demo" ? "演示数据只读展示" : "已授权读取，访问会被记录"}</span>
        </div>
      ) : null}

      <OperationNotice state={createState} />

      <div className="grid grid-cols-2 gap-2 md:hidden">
        <Button variant={mobilePane === "list" ? "default" : "outline"} onClick={() => setMobilePane("list")}>列表</Button>
        <Button variant={mobilePane === "detail" ? "default" : "outline"} onClick={() => setMobilePane("detail")} disabled={!selectedCase}>详情</Button>
      </div>

      <div className="lg:flex lg:items-start lg:gap-4">
        <div className={mobilePane === "detail" ? "hidden md:block" : "block"}>
          <QueuePanel
            cases={pagedCases}
            error={caseError || caseModel?.permissionDeniedReason || null}
            gateOpen={gateOpen}
            gateReason={gateReason}
            kindFilter={caseKind}
            loading={loading}
            page={safeQueuePage}
            pageSize={queuePageSize}
            repository={repository}
            search={search}
            selectedCaseId={selectedCase?.id ?? null}
            statusFilter={caseStatus}
            total={visibleCases.length}
            onGateReasonChange={setGateReason}
            onKindChange={setCaseKind}
            onPageChange={setQueuePage}
            onPageSizeChange={(pageSize) => {
              setQueuePageSize(pageSize)
              setQueuePage(1)
            }}
            onRetry={() => void loadCases()}
            onSearchChange={setSearch}
            onSelectCase={selectCase}
            onStatusChange={setCaseStatus}
            onUnlock={unlockQueue}
          />
        </div>

        <div className={["min-w-0 flex-1 space-y-4", mobilePane === "list" ? "hidden md:block" : "block"].join(" ")}>
          {selectedCase ? (
            <CaseDetail item={selectedCase} onBack={() => setMobilePane("list")} />
          ) : (
            <EmptyState title="未选择案件" description="从队列中选择案件查看详情。" />
          )}

          {canWriteLive && selectedCaseMutable ? (
            <ResolutionPanel
              disabled={disableResolve}
              form={resolutionForm}
              governanceSettings={governanceSettings}
              state={resolveState}
              onSubmit={requestResolveCase}
              onUpdate={setResolutionForm}
            />
          ) : null}
        </div>
      </div>

      <CreateCaseDialog
        createForm={createForm}
        createNeedsFamilyReason={createNeedsFamilyReason}
        createState={createState}
        disabled={disableCreate}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={() => void createCase()}
        onUpdate={setCreateForm}
      />

      <ConfirmActionDialog
        open={resolveConfirmOpen}
        title="确认处理案件"
        description="请确认处理结论和说明无误。确认后会提交本次处理。"
        confirmLabel={`确认${caseStatusLabel(resolutionForm.status)}`}
        loading={resolveState.phase === "pending"}
        disabled={disableResolve}
        destructive={resolutionForm.status === "rejected" || resolutionForm.status === "closed"}
        onOpenChange={setResolveConfirmOpen}
        onConfirm={() => void resolveCase()}
      >
        {selectedCase ? (
          <div className="grid gap-3 text-sm">
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">案件</span>
              <span>{caseKindLabel(selectedCase.kind)} · {targetTypeLabel(selectedCase.target_type)}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">处理结论</span>
              <StatusPill status={resolutionForm.status} />
            </div>
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">处理说明</span>
              <p className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-2 text-sm leading-6">
                {resolutionForm.resolutionNote.trim()}
              </p>
            </div>
            <OperationNotice state={resolveState} />
          </div>
        ) : null}
      </ConfirmActionDialog>
    </main>
  )
}

export default ModerationPage
