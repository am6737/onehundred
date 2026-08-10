import * as React from "react"
import {
  ArchiveIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  CopyIcon,
  EyeIcon,
  GitBranchIcon,
  ImageIcon,
  ImageOffIcon,
  LinkIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  SendIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { AdminPagination, ConfirmActionDialog } from "@/components/admin"
import { minimumGovernanceReasonLength } from "@/components/admin/governance-access-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createAdminRepository, createDemoAdminRepository, isGovernanceReasonReady, resolveGovernanceReason, useGovernanceAuthorizationSettings } from "@/lib/admin"
import type {
  ActivityDetail,
  ActivityLifecycleStatus,
  ActivityListItem,
  ActivitySourceType,
  ActivityVersion,
  AdminCapability,
  AdminRepository,
  CaptureMode,
  IllustrationSource,
  RoleCapabilitySummary,
  SealRecommendationKind,
  VersionStatus,
} from "@/lib/admin"

type SourceFilter = ActivitySourceType | "all"
type StatusFilter = ActivityLifecycleStatus | "all"
type ActionState = "idle" | "pending" | "success" | "error"
type PageView = "list" | "detail" | "edit-current" | "new-version"

type DraftCreateState = {
  sourceType: Extract<ActivitySourceType, "system" | "family">
  title: string
  why: string
  how: string
  recordHint: string
  familyId: string
  governanceReason: string
  allowedCaptureModes: CaptureMode[]
  suggestMode: CaptureMode
}

type VersionFormState = {
  title: string
  why: string
  how: string
  record_hint: string
  suggest_mode: CaptureMode
  allowed_capture_modes: CaptureMode[]
  illustration_source: IllustrationSource
  illustration_path: string
  family_id: string
  perspective: "parent" | "child" | "together" | "none"
  tone: string
  category: string
  scene: string
  tags: string
  min_age: string
  max_age: string
  seasonal: boolean
  seal_default_state: "recommend_unsealed" | "recommend_sealed"
  seal_kind: SealRecommendationKind
  seal_default_until: string
  seal_label: string
  seal_reason: string
  governanceReason: string
}

type ConfirmState = {
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  content?: React.ReactNode
  onConfirm: () => Promise<void>
}

const defaultPageSize = 10
const captureModes: CaptureMode[] = ["text", "photo", "video", "voice"]
const sourceTypes: DraftCreateState["sourceType"][] = ["system", "family"]
const illustrationSources: IllustrationSource[] = ["none", "system_asset", "family_private", "motif_fallback"]
const sealKinds: SealRecommendationKind[] = ["none", "until_date", "age_based", "manual_prompt"]

const initialDraftCreate: DraftCreateState = {
  sourceType: "system",
  title: "",
  why: "",
  how: "",
  recordHint: "",
  familyId: "",
  governanceReason: "",
  allowedCaptureModes: ["text", "photo", "video", "voice"],
  suggestMode: "photo",
}

const emptyVersionForm: VersionFormState = {
  title: "",
  why: "",
  how: "",
  record_hint: "",
  suggest_mode: "text",
  allowed_capture_modes: ["text", "photo", "video", "voice"],
  illustration_source: "none",
  illustration_path: "",
  family_id: "",
  perspective: "none",
  tone: "",
  category: "",
  scene: "",
  tags: "",
  min_age: "",
  max_age: "",
  seasonal: false,
  seal_default_state: "recommend_unsealed",
  seal_kind: "none",
  seal_default_until: "",
  seal_label: "",
  seal_reason: "",
  governanceReason: "",
}

async function openRepository() {
  if (import.meta.env.VITE_ADMIN_DATA_MODE?.trim().toLowerCase() === "demo") {
    return createDemoAdminRepository("演示数据")
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

function sourceLabel(source: ActivitySourceType) {
  if (source === "system") return "系统事情"
  if (source === "copied_family") return "家庭复制"
  return "家庭自定义"
}

function statusLabel(status: ActivityLifecycleStatus | VersionStatus) {
  if (status === "draft") return "草稿"
  if (status === "published") return "已发布"
  if (status === "archived") return "已归档"
  if (status === "unpublished") return "已下架"
  return "已删除"
}

function modeLabel(mode: CaptureMode) {
  if (mode === "photo") return "照片"
  if (mode === "video") return "视频"
  if (mode === "voice") return "语音"
  return "文字"
}

function illustrationSourceLabel(source: IllustrationSource) {
  if (source === "system_asset") return "平台插画"
  if (source === "family_private") return "家庭私有封面"
  if (source === "motif_fallback") return "备用图案"
  return "无插画"
}

function pathFileName(path?: string | null) {
  const value = path?.trim()
  if (!value) return "未记录"
  const withoutQuery = value.split(/[?#]/)[0]
  const parts = withoutQuery.split("/")
  return parts[parts.length - 1] || value
}

function pathExtension(path?: string | null) {
  const fileName = pathFileName(path)
  const extension = fileName.includes(".") ? fileName.split(".").pop() : ""
  return extension ? extension.toUpperCase() : "未知"
}

function isRemotePath(path: string) {
  return /^(https?:|data:|blob:)/i.test(path)
}

function illustrationPreviewUrl(path?: string | null) {
  const value = path?.trim()
  if (!value) return null
  if (isRemotePath(value) || value.startsWith("/")) return value
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  if (!supabaseUrl) return null
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/illustrations/${value.replace(/^\/+/, "")}`
}

function illustrationSummary(version?: ActivityVersion | null) {
  const illustration = version?.illustration
  if (!illustration || illustration.source === "none") return "无插画"
  const source = illustrationSourceLabel(illustration.source)
  if (illustration.source === "motif_fallback") return source
  return illustration.path ? `${source} · ${pathFileName(illustration.path)}` : `${source} · 未记录路径`
}

function statusTone(status: ActivityLifecycleStatus | VersionStatus) {
  if (status === "published") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
  if (status === "draft") return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
  if (status === "unpublished" || status === "archived") return "border-border bg-muted/45 text-muted-foreground"
  return "border-destructive/30 bg-destructive/10 text-destructive"
}

function hasCapability(summary: RoleCapabilitySummary | null, capability: AdminCapability) {
  return Boolean(summary?.capabilities.includes(capability))
}

function normalizeAllowedModes(modes: CaptureMode[], suggested: CaptureMode) {
  const uniqueModes = captureModes.filter((mode) => modes.includes(mode))
  const allowed = uniqueModes.length ? uniqueModes : [suggested]
  return allowed.includes(suggested) ? allowed : [...allowed, suggested]
}

function setAllowedModes(
  currentModes: CaptureMode[],
  currentSuggest: CaptureMode,
  mode: CaptureMode,
  enabled: boolean,
): { allowedCaptureModes: CaptureMode[]; suggestMode: CaptureMode } {
  const nextModes = enabled ? [...currentModes, mode] : currentModes.filter((item) => item !== mode)
  const allowedCaptureModes = normalizeAllowedModes(nextModes, currentSuggest)
  return {
    allowedCaptureModes,
    suggestMode: allowedCaptureModes.includes(currentSuggest) ? currentSuggest : allowedCaptureModes[0],
  }
}

function versionToForm(version?: ActivityVersion | null, fallbackReason = ""): VersionFormState {
  if (!version) return { ...emptyVersionForm, governanceReason: fallbackReason }
  const recommendation = version.seal_recommendation
  return {
    title: version.title ?? "",
    why: version.why ?? "",
    how: version.how ?? "",
    record_hint: version.record_hint ?? "",
    suggest_mode: version.suggest_mode,
    allowed_capture_modes: normalizeAllowedModes(version.allowed_capture_modes, version.suggest_mode),
    illustration_source: version.illustration?.source ?? "none",
    illustration_path: version.illustration?.path ?? "",
    family_id: version.family_id ?? "",
    perspective: version.perspective ?? "none",
    tone: version.tone ?? "",
    category: version.category ?? "",
    scene: version.scene ?? "",
    tags: version.tags?.join(", ") ?? "",
    min_age: version.min_age === null || version.min_age === undefined ? "" : String(version.min_age),
    max_age: version.max_age === null || version.max_age === undefined ? "" : String(version.max_age),
    seasonal: Boolean(version.seasonal),
    seal_default_state: recommendation?.default_state ?? "recommend_unsealed",
    seal_kind: recommendation?.kind ?? "none",
    seal_default_until: recommendation?.default_until ?? "",
    seal_label: recommendation?.label ?? "",
    seal_reason: recommendation?.reason ?? "",
    governanceReason: fallbackReason,
  }
}

function optionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formToPatch(form: VersionFormState, baseVersion?: ActivityVersion | null): Partial<ActivityVersion> {
  const minAge = optionalNumber(form.min_age)
  const maxAge = optionalNumber(form.max_age)
  const tags = form.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
  const illustrationPath = form.illustration_path.trim() || null
  const baseIllustration = baseVersion?.illustration
  const preserveIllustrationReference = Boolean(
    baseIllustration?.asset_id &&
    baseIllustration.source === form.illustration_source &&
    (baseIllustration.path ?? "") === (illustrationPath ?? ""),
  )
  return {
    title: form.title.trim(),
    why: form.why.trim(),
    how: form.how.trim(),
    record_hint: form.record_hint.trim(),
    suggest_mode: form.suggest_mode,
    allowed_capture_modes: normalizeAllowedModes(form.allowed_capture_modes, form.suggest_mode),
    illustration: {
      source: form.illustration_source,
      path: illustrationPath,
      asset_id: preserveIllustrationReference ? baseIllustration?.asset_id ?? null : null,
    },
    family_id: form.family_id.trim() || null,
    perspective: form.perspective === "none" ? null : form.perspective,
    tone: form.tone.trim() || null,
    category: form.category.trim() || null,
    scene: form.scene.trim() || null,
    tags: tags.length ? tags : null,
    min_age: Number.isNaN(minAge) ? undefined : minAge,
    max_age: Number.isNaN(maxAge) ? undefined : maxAge,
    seasonal: form.seasonal,
    seal_recommendation: {
      default_state: form.seal_default_state,
      kind: form.seal_kind,
      default_until: form.seal_default_until.trim() || null,
      label: form.seal_label.trim() || null,
      reason: form.seal_reason.trim() || null,
    },
  }
}

function validateVersionForm(form: VersionFormState) {
  const required = [
    ["标题", form.title],
    ["为什么值得做", form.why],
    ["可以怎么做", form.how],
    ["记录些什么", form.record_hint],
    ["治理理由", form.governanceReason],
  ] as const
  const missing = required.filter(([, value]) => !value.trim()).map(([label]) => label)
  if (missing.length) return `缺少必填字段：${missing.join("、")}`
  if (!isGovernanceReasonReady(form.governanceReason, minimumGovernanceReasonLength)) return `治理理由至少需要 ${minimumGovernanceReasonLength} 个字符。`
  if (!form.allowed_capture_modes.length) return "至少要选择一种记录方式。"
  if (!form.allowed_capture_modes.includes(form.suggest_mode)) return "推荐记录方式必须属于允许记录方式。"
  if (Number.isNaN(optionalNumber(form.min_age)) || Number.isNaN(optionalNumber(form.max_age))) return "年龄范围必须是数字。"
  const minAge = optionalNumber(form.min_age)
  const maxAge = optionalNumber(form.max_age)
  if (typeof minAge === "number" && typeof maxAge === "number" && maxAge < minAge) return "最大年龄必须大于等于最小年龄。"
  if ((form.illustration_source === "system_asset" || form.illustration_source === "family_private") && !form.illustration_path.trim()) return "平台插画或家庭私有封面必须填写 storage path 或完整 URL。"
  if ((form.illustration_source === "none" || form.illustration_source === "motif_fallback") && form.illustration_path.trim()) return "无插画或备用图案不应填写插画路径。"
  return null
}

function detailToListItem(detail: ActivityDetail): ActivityListItem {
  return {
    ...detail,
    read_model_source: detail.audit_metadata.read_model_source,
  }
}

function StatusPill({ status }: { status: ActivityLifecycleStatus | VersionStatus }) {
  return <Badge variant="outline" className={`h-5 rounded-md px-1.5 ${statusTone(status)}`}>{statusLabel(status)}</Badge>
}

function InlineAlert({ state, message }: { state: Exclude<ActionState, "idle">; message: string }) {
  const className = state === "error"
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : state === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"
      : "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100"
  return <div className={`rounded-lg border px-3 py-2 text-sm ${className}`}>{message}</div>
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="grid min-h-52 place-items-center rounded-xl border border-dashed bg-muted/15 p-6 text-center">
      <div>
        <div className="text-base font-medium">{title}</div>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  )
}

function LoadingRows() {
  return Array.from({ length: 6 }).map((_, index) => (
    <TableRow key={index}>
      <TableCell><Skeleton className="h-5 w-48" /></TableCell>
      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
    </TableRow>
  ))
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  required?: boolean
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}{required ? " *" : ""}</Label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
    </div>
  )
}

function CaptureModePicker({
  value,
  suggestMode,
  onChange,
}: {
  value: CaptureMode[]
  suggestMode: CaptureMode
  onChange: (value: CaptureMode[], suggestMode: CaptureMode) => void
}) {
  return (
    <div className="grid gap-2">
      <Label>允许记录方式 *</Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {captureModes.map((mode) => (
          <label key={mode} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Checkbox
              checked={value.includes(mode)}
              onCheckedChange={(checked) => {
                const next = setAllowedModes(value, suggestMode, mode, Boolean(checked))
                onChange(next.allowedCaptureModes, next.suggestMode)
              }}
            />
            {modeLabel(mode)}
          </label>
        ))}
      </div>
    </div>
  )
}

function ActionButton({
  capability,
  summary,
  repository,
  busy,
  children,
  onClick,
  variant = "default",
}: {
  capability: AdminCapability
  summary: RoleCapabilitySummary | null
  repository: AdminRepository | null
  busy: boolean
  children: React.ReactNode
  onClick: () => void
  variant?: React.ComponentProps<typeof Button>["variant"]
}) {
  if (!hasCapability(summary, capability)) return null
  return (
    <Button variant={variant} onClick={onClick} disabled={busy || repository?.mode === "demo"}>
      {busy ? <Loader2Icon className="animate-spin" /> : null}
      {children}
    </Button>
  )
}

function InfoGrid({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-background p-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 min-w-0 truncate text-sm font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function VersionContent({ version }: { version: ActivityVersion | null | undefined }) {
  if (!version) return <EmptyState title="暂无当前版本" description="该事情还没有可展示的内容版本。" />
  return (
    <div className="rounded-xl border bg-background">
      {[
        ["为什么值得做", version.why],
        ["可以怎么做", version.how],
        ["记录些什么", version.record_hint],
      ].map(([label, value], index) => (
        <div key={label} className={index ? "border-t p-4" : "p-4"}>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{value || "未填写"}</p>
        </div>
      ))}
    </div>
  )
}

function IllustrationPreview({ version }: { version: ActivityVersion | null | undefined }) {
  const [failedPath, setFailedPath] = React.useState<string | null>(null)
  const illustration = version?.illustration
  const path = illustration?.path?.trim() || ""
  const previewUrl = illustrationPreviewUrl(path)
  const canPreview = Boolean(previewUrl && failedPath !== path)
  const source = illustration?.source ?? "none"

  React.useEffect(() => {
    setFailedPath(null)
  }, [path])

  if (!version) return <EmptyState title="暂无当前版本" description="该事情还没有可展示的插画信息。" />

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,420px)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-lg border bg-muted/20">
        <div className="grid aspect-[4/3] place-items-center">
          {canPreview ? (
            <img src={previewUrl ?? ""} alt="" className="size-full object-cover" loading="lazy" onError={() => setFailedPath(path)} />
          ) : (
            <div className="grid gap-2 text-center text-muted-foreground">
              {source === "none" ? <ImageOffIcon className="mx-auto size-8" /> : <ImageIcon className="mx-auto size-8" />}
              <div className="text-sm">{source === "motif_fallback" ? "使用备用图案" : path ? "无法预览该路径" : "当前版本未设置插画路径"}</div>
            </div>
          )}
        </div>
      </div>
      <div className="grid content-start gap-3">
        <InfoGrid
          items={[
            { label: "版本", value: `v${version.version_no}` },
            { label: "来源", value: illustrationSourceLabel(source) },
            { label: "文件名", value: pathFileName(path) },
            { label: "文件类型", value: path ? pathExtension(path) : "未记录" },
          ]}
        />
        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs text-muted-foreground">storage path / URL</div>
          <div className="mt-1 break-all text-sm font-medium">{path || "未记录"}</div>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
          插画随事情版本保存。家庭私有封面仍属于家庭事情版本，读取和治理理由要求不变。
        </div>
      </div>
    </div>
  )
}

function VersionList({
  detail,
  targetVersionId,
  onTargetVersionChange,
}: {
  detail: ActivityDetail
  targetVersionId: string
  onTargetVersionChange: (id: string) => void
}) {
  const versions = detail.versions.slice().sort((a, b) => b.version_no - a.version_no)
  if (!versions.length) return <EmptyState title="暂无版本" description="还没有可操作的版本。" />
  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-xl border">
        {versions.map((version, index) => {
          const selected = targetVersionId === version.id
          return (
            <button
              key={version.id}
              type="button"
              onClick={() => onTargetVersionChange(version.id)}
              className={`grid w-full gap-2 p-4 text-left transition hover:bg-muted/35 sm:grid-cols-[120px_minmax(0,1fr)_160px] sm:items-center ${selected ? "bg-primary/[0.05]" : ""} ${index ? "border-t" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">v{version.version_no}</span>
                <StatusPill status={version.status} />
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{version.title || "未命名版本"}</div>
                <div className="mt-1 line-clamp-1 text-sm text-muted-foreground">{version.why || "未填写内容说明"}</div>
                <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  <ImageIcon className="size-3.5 shrink-0" />
                  <span className="truncate">{illustrationSummary(version)}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground sm:text-right">{formatDate(version.published_at ?? version.updated_at)}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function VersionEditor({
  form,
  inheritedVersion,
  onChange,
}: {
  form: VersionFormState
  inheritedVersion?: ActivityVersion | null
  onChange: (patch: Partial<VersionFormState>) => void
}) {
  const governanceSettings = useGovernanceAuthorizationSettings()
  const inheritedIllustration = inheritedVersion?.illustration
  const inheritIllustration = () => {
    onChange({
      illustration_source: inheritedIllustration?.source ?? "none",
      illustration_path: inheritedIllustration?.path ?? "",
    })
  }
  const removeIllustration = () => onChange({ illustration_source: "none", illustration_path: "" })
  return (
    <div className="grid gap-5">
      <Section title="内容">
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>标题 *</Label>
            <Input value={form.title} onChange={(event) => onChange({ title: event.target.value })} />
          </div>
          <TextAreaField label="为什么值得做" required value={form.why} onChange={(why) => onChange({ why })} />
          <TextAreaField label="可以怎么做" required value={form.how} onChange={(how) => onChange({ how })} rows={4} />
          <TextAreaField label="记录些什么" required value={form.record_hint} onChange={(record_hint) => onChange({ record_hint })} />
        </div>
      </Section>

      <Section title="记录方式">
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <CaptureModePicker
            value={form.allowed_capture_modes}
            suggestMode={form.suggest_mode}
            onChange={(allowed_capture_modes, suggest_mode) => onChange({ allowed_capture_modes, suggest_mode })}
          />
          <div className="grid content-start gap-1.5">
            <Label>推荐记录方式 *</Label>
            <Select
              value={form.suggest_mode}
              onValueChange={(value) => {
                const suggest_mode = value as CaptureMode
                onChange({
                  suggest_mode,
                  allowed_capture_modes: normalizeAllowedModes(form.allowed_capture_modes, suggest_mode),
                })
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{captureModes.map((mode) => <SelectItem key={mode} value={mode}>{modeLabel(mode)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <details className="rounded-xl border bg-background">
        <summary className="cursor-pointer list-none px-4 py-3 font-medium">高级信息</summary>
        <div className="grid gap-5 border-t p-4">
          <section className="grid gap-3">
            <div className="text-sm font-medium">适用范围</div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="grid gap-1.5"><Label>家庭 ID</Label><Input value={form.family_id} onChange={(event) => onChange({ family_id: event.target.value })} /></div>
              <div className="grid gap-1.5">
                <Label>视角</Label>
                <Select value={form.perspective} onValueChange={(value) => onChange({ perspective: value as VersionFormState["perspective"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未设置</SelectItem>
                    <SelectItem value="parent">家长</SelectItem>
                    <SelectItem value="child">孩子</SelectItem>
                    <SelectItem value="together">一起</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>语气</Label><Input value={form.tone} onChange={(event) => onChange({ tone: event.target.value })} /></div>
              <div className="grid gap-1.5"><Label>分类</Label><Input value={form.category} onChange={(event) => onChange({ category: event.target.value })} /></div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="grid gap-1.5"><Label>场景</Label><Input value={form.scene} onChange={(event) => onChange({ scene: event.target.value })} /></div>
              <div className="grid gap-1.5"><Label>标签</Label><Input value={form.tags} onChange={(event) => onChange({ tags: event.target.value })} placeholder="逗号分隔" /></div>
              <div className="grid gap-1.5"><Label>最小年龄</Label><Input value={form.min_age} onChange={(event) => onChange({ min_age: event.target.value })} /></div>
              <div className="grid gap-1.5"><Label>最大年龄</Label><Input value={form.max_age} onChange={(event) => onChange({ max_age: event.target.value })} /></div>
            </div>
          </section>

          <section className="grid gap-3 border-t pt-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-medium">插画</div>
                <p className="mt-1 text-xs text-muted-foreground">直接编辑当前版本的插画字段。当前契约支持写入来源和 storage path / URL。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={inheritIllustration} disabled={!inheritedVersion}>
                  <CopyIcon />
                  继承当前版本
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={removeIllustration}>
                  <Trash2Icon />
                  移除插画
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="grid gap-1.5">
                <Label>插画来源</Label>
                <Select
                  value={form.illustration_source}
                  onValueChange={(value) => {
                    const illustration_source = value as IllustrationSource
                    onChange({
                      illustration_source,
                      illustration_path: illustration_source === "none" || illustration_source === "motif_fallback" ? "" : form.illustration_path,
                    })
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{illustrationSources.map((source) => <SelectItem key={source} value={source}>{illustrationSourceLabel(source)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>storage path / URL</Label>
                <Input
                  value={form.illustration_path}
                  onChange={(event) => onChange({ illustration_path: event.target.value })}
                  placeholder="family-id/custom-cover.png 或 https://..."
                  disabled={form.illustration_source === "none" || form.illustration_source === "motif_fallback"}
                />
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <LinkIcon className="size-4" />
                当前表单摘要
              </div>
              <div className="mt-2 break-all text-sm text-muted-foreground">
                {form.illustration_source === "none"
                  ? "保存后该版本不设置插画。"
                  : form.illustration_source === "motif_fallback"
                    ? "保存后该版本使用备用图案。"
                    : form.illustration_path.trim() || "请填写该版本插画的 storage path 或完整 URL。"}
              </div>
            </div>
          </section>

          <section className="grid gap-3 border-t pt-5">
            <div className="text-sm font-medium">封存建议</div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <Checkbox checked={form.seasonal} onCheckedChange={(checked) => onChange({ seasonal: Boolean(checked) })} />
                季节限定
              </label>
              <div className="grid gap-1.5">
                <Label>封存默认</Label>
                <Select value={form.seal_default_state} onValueChange={(value) => onChange({ seal_default_state: value as VersionFormState["seal_default_state"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommend_unsealed">默认不封存</SelectItem>
                    <SelectItem value="recommend_sealed">默认封存</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>封存类型</Label>
                <Select value={form.seal_kind} onValueChange={(value) => onChange({ seal_kind: value as SealRecommendationKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{sealKinds.map((kind) => <SelectItem key={kind} value={kind}>{kind}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>封存至</Label><Input value={form.seal_default_until} onChange={(event) => onChange({ seal_default_until: event.target.value })} placeholder="YYYY-MM-DD" /></div>
            </div>
            <div className="grid gap-3 md:grid-cols-[280px_1fr]">
              <div className="grid gap-1.5"><Label>封存标签</Label><Input value={form.seal_label} onChange={(event) => onChange({ seal_label: event.target.value })} /></div>
              <TextAreaField label="封存建议原因" value={form.seal_reason} onChange={(seal_reason) => onChange({ seal_reason })} rows={2} />
            </div>
          </section>
        </div>
      </details>

      {governanceSettings.manualAuthorizationEnabled ? (
        <div className="grid gap-1.5 rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/8">
          <Label>本次操作治理理由 *</Label>
          <Input className="bg-background" value={form.governanceReason} onChange={(event) => onChange({ governanceReason: event.target.value })} placeholder={`至少 ${minimumGovernanceReasonLength} 个字符`} />
        </div>
      ) : null}
    </div>
  )
}

function CreateDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  onCreate,
  canCreate,
  busy,
  demoReadonly,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: DraftCreateState
  setDraft: React.Dispatch<React.SetStateAction<DraftCreateState>>
  onCreate: () => void
  canCreate: boolean
  busy: boolean
  demoReadonly: boolean
}) {
  const governanceSettings = useGovernanceAuthorizationSettings()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>新建事情草稿</DialogTitle>
          <DialogDescription>先建立可编辑草稿，创建后进入详情继续处理版本。</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-2">
            <Label>事情来源</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {sourceTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, sourceType: type, familyId: type === "system" ? "" : current.familyId }))}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${draft.sourceType === type ? "border-primary bg-primary/8" : "bg-background"}`}
                >
                  <span className="font-medium">{type === "system" ? "系统事情" : "家庭自定义事情"}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{type === "system" ? "面向所有家庭" : "仅属于指定家庭"}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>标题 *</Label>
              <Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} autoFocus />
            </div>
            {draft.sourceType === "family" ? (
              <div className="grid gap-1.5">
                <Label>家庭 ID *</Label>
                <Input value={draft.familyId} onChange={(event) => setDraft((current) => ({ ...current, familyId: event.target.value }))} />
              </div>
            ) : null}
            <TextAreaField label="为什么值得做" required value={draft.why} onChange={(why) => setDraft((current) => ({ ...current, why }))} />
            <TextAreaField label="可以怎么做" required value={draft.how} onChange={(how) => setDraft((current) => ({ ...current, how }))} rows={4} />
            <TextAreaField label="记录些什么" required value={draft.recordHint} onChange={(recordHint) => setDraft((current) => ({ ...current, recordHint }))} />
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_200px]">
            <CaptureModePicker
              value={draft.allowedCaptureModes}
              suggestMode={draft.suggestMode}
              onChange={(allowedCaptureModes, suggestMode) => setDraft((current) => ({ ...current, allowedCaptureModes, suggestMode }))}
            />
            <div className="grid content-start gap-1.5">
              <Label>推荐记录方式 *</Label>
              <Select
                value={draft.suggestMode}
                onValueChange={(value) => {
                  const suggestMode = value as CaptureMode
                  setDraft((current) => ({
                    ...current,
                    suggestMode,
                    allowedCaptureModes: normalizeAllowedModes(current.allowedCaptureModes, suggestMode),
                  }))
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{captureModes.map((mode) => <SelectItem key={mode} value={mode}>{modeLabel(mode)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {governanceSettings.manualAuthorizationEnabled ? (
            <div className="grid gap-1.5 rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/8">
              <Label>治理理由 *</Label>
              <Input className="bg-background" value={draft.governanceReason} onChange={(event) => setDraft((current) => ({ ...current, governanceReason: event.target.value }))} placeholder={`至少 ${minimumGovernanceReasonLength} 个字符`} />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          {canCreate ? (
            <Button onClick={onCreate} disabled={busy || demoReadonly}>
              {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              创建并打开
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ActivityLibraryPage() {
  const [repository, setRepository] = React.useState<AdminRepository | null>(null)
  const [permissionSummary, setPermissionSummary] = React.useState<RoleCapabilitySummary | null>(null)
  const [activities, setActivities] = React.useState<ActivityListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [source, setSource] = React.useState<SourceFilter>("system")
  const [status, setStatus] = React.useState<StatusFilter>("all")
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(defaultPageSize)
  const [governanceReason, setGovernanceReason] = React.useState("")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [selectedActivity, setSelectedActivity] = React.useState<ActivityListItem | null>(null)
  const [detail, setDetail] = React.useState<ActivityDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detailError, setDetailError] = React.useState<string | null>(null)
  const [actionState, setActionState] = React.useState<ActionState>("idle")
  const [actionMessage, setActionMessage] = React.useState<string | null>(null)
  const [busyAction, setBusyAction] = React.useState<string | null>(null)
  const [draftCreate, setDraftCreate] = React.useState<DraftCreateState>(initialDraftCreate)
  const [editForm, setEditForm] = React.useState<VersionFormState>(emptyVersionForm)
  const [newVersionForm, setNewVersionForm] = React.useState<VersionFormState>(emptyVersionForm)
  const [targetVersionId, setTargetVersionId] = React.useState("")
  const [versionActionReason, setVersionActionReason] = React.useState("")
  const [copyFamilyId, setCopyFamilyId] = React.useState("")
  const [copyReason, setCopyReason] = React.useState("")
  const [view, setView] = React.useState<PageView>("list")
  const [confirmState, setConfirmState] = React.useState<ConfirmState | null>(null)
  const governanceSettings = useGovernanceAuthorizationSettings()

  const requiresGovernance = source !== "system"
  const canLoadPrivate = !requiresGovernance || repository?.mode === "demo" || isGovernanceReasonReady(governanceReason, minimumGovernanceReasonLength)
  const demoReadonly = repository?.mode === "demo"
  const canCreate = hasCapability(permissionSummary, "activity.draft.create")
  const canUpdateDraft = hasCapability(permissionSummary, "activity.draft.update")
  const selectedTitle = detail?.current_version?.title ?? selectedActivity?.current_version?.title ?? "未命名事情"

  const showAction = React.useCallback((state: ActionState, message: string) => {
    setActionState(state)
    setActionMessage(message)
    if (state === "success") toast.success(message)
    if (state === "error") toast.error(message)
    if (state === "pending") toast.loading(message, { id: "activity-library-action" })
    if (state !== "pending") toast.dismiss("activity-library-action")
  }, [])

  const ensureRepository = React.useCallback(async () => {
    const adminRepository = repository ?? await openRepository()
    setRepository(adminRepository)
    if (!permissionSummary) {
      const summary = await adminRepository.getPermissionSummary()
      setPermissionSummary(summary)
    }
    return adminRepository
  }, [permissionSummary, repository])

  const loadData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const adminRepository = await ensureRepository()
      if (!permissionSummary) {
        const summary = await adminRepository.getPermissionSummary()
        setPermissionSummary(summary)
      }
      if (source !== "system" && adminRepository.mode === "live" && !isGovernanceReasonReady(governanceReason, minimumGovernanceReasonLength)) {
        setActivities([])
        return
      }
      const model = await adminRepository.listActivities({
        limit: 200,
        sourceType: source,
        status,
        search: search.trim() || undefined,
        governanceReason: source === "system" ? undefined : resolveGovernanceReason(governanceReason),
      })
      const visible = source === "all" ? model.items : model.items.filter((item) => item.source_type === source)
      setActivities(visible)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "事情库加载失败")
    } finally {
      setLoading(false)
    }
  }, [ensureRepository, governanceReason, permissionSummary, search, source, status])

  const refreshDetail = React.useCallback(async (activityId: string, reason?: string) => {
    const adminRepository = await ensureRepository()
    const activityDetail = reason?.trim()
      ? await adminRepository.getActivityDetail(activityId, { governanceReason: reason.trim() })
      : await adminRepository.getActivityDetail(activityId)
    setDetail(activityDetail)
    setSelectedActivity(detailToListItem(activityDetail))
    return activityDetail
  }, [ensureRepository])

  React.useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  React.useEffect(() => {
    setPage(1)
  }, [search, source, status])

  React.useEffect(() => {
    setTargetVersionId(detail?.current_version_id ?? detail?.current_version?.id ?? detail?.versions[0]?.id ?? "")
    setEditForm(versionToForm(detail?.current_version, versionActionReason))
    setNewVersionForm(versionToForm(detail?.current_version, versionActionReason))
  }, [detail, versionActionReason])

  async function openDetail(activity: ActivityListItem) {
    setSelectedActivity(activity)
    setDetail(null)
    setDetailError(null)
    setView("detail")
    if ((activity.source_type === "family" || activity.source_type === "copied_family") && repository?.mode === "live" && !isGovernanceReasonReady(governanceReason, minimumGovernanceReasonLength)) {
      setDetailError(`查看家庭事情详情必须填写至少 ${minimumGovernanceReasonLength} 个字符的治理理由。`)
      return
    }
    setDetailLoading(true)
    try {
      const reason = resolveGovernanceReason(governanceReason)
      await refreshDetail(activity.id, reason || undefined)
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : "事情详情加载失败")
    } finally {
      setDetailLoading(false)
    }
  }

  async function runAction(label: string, action: (adminRepository: AdminRepository) => Promise<ActivityDetail | ActivityVersion | void>, refreshActivityId?: string, refreshReason?: string) {
    setBusyAction(label)
    showAction("pending", `${label}处理中...`)
    try {
      const adminRepository = await ensureRepository()
      if (adminRepository.mode === "demo") throw new Error("演示数据只读，不能执行写操作。")
      await action(adminRepository)
      showAction("success", `${label}成功。`)
      await loadData()
      if (refreshActivityId) await refreshDetail(refreshActivityId, refreshReason)
    } catch (actionError) {
      showAction("error", actionError instanceof Error ? actionError.message : `${label}失败`)
    } finally {
      setBusyAction(null)
      setConfirmState(null)
    }
  }

  async function createDraft() {
    const title = draftCreate.title.trim()
    const why = draftCreate.why.trim()
    const how = draftCreate.how.trim()
    const recordHint = draftCreate.recordHint.trim()
    const reason = resolveGovernanceReason(draftCreate.governanceReason)
    const familyId = draftCreate.familyId.trim()
    if (!title) return showAction("error", "创建草稿必须填写标题。")
    if (!why) return showAction("error", "创建草稿必须填写为什么值得做。")
    if (!how) return showAction("error", "创建草稿必须填写可以怎么做。")
    if (!recordHint) return showAction("error", "创建草稿必须填写记录些什么。")
    if (!isGovernanceReasonReady(draftCreate.governanceReason, minimumGovernanceReasonLength)) return showAction("error", `创建草稿的治理理由至少需要 ${minimumGovernanceReasonLength} 个字符。`)
    if (draftCreate.sourceType === "family" && !familyId) return showAction("error", "家庭事情快速创建必须填写家庭 ID。")
    const allowed = normalizeAllowedModes(draftCreate.allowedCaptureModes, draftCreate.suggestMode)
    await runAction("创建草稿", async (adminRepository) => {
      const activityDetail = await adminRepository.createActivityDraft({
        sourceType: draftCreate.sourceType,
        title,
        why,
        how,
        recordHint,
        familyId: draftCreate.sourceType === "family" ? familyId : undefined,
        allowedCaptureModes: allowed,
        suggestMode: draftCreate.suggestMode,
        governanceReason: reason,
      })
      setDetail(activityDetail)
      setSelectedActivity(detailToListItem(activityDetail))
      setView("detail")
      if (draftCreate.sourceType === "family") setGovernanceReason(reason)
      setDraftCreate(initialDraftCreate)
      setCreateOpen(false)
    }, undefined, reason)
  }

  async function updateCurrentDraft() {
    if (!detail?.current_version) return showAction("error", "当前事情没有可编辑版本。")
    if (detail.current_version.status !== "draft") return showAction("error", "只能编辑当前草稿版本。")
    const validation = validateVersionForm(editForm)
    if (validation) return showAction("error", validation)
    await runAction("保存草稿", (adminRepository) => adminRepository.updateActivityDraft({
      activityId: detail.id,
      versionId: detail.current_version!.id,
      patch: formToPatch(editForm, detail.current_version),
      governanceReason: resolveGovernanceReason(editForm.governanceReason),
    }), detail.id, resolveGovernanceReason(editForm.governanceReason))
    setView("detail")
  }

  async function createNewVersion() {
    if (!detail?.current_version) return showAction("error", "当前事情没有可复制的版本字段。")
    const validation = validateVersionForm(newVersionForm)
    if (validation) return showAction("error", validation)
    await runAction("创建新版本", (adminRepository) => adminRepository.createActivityVersion({
      activity_id: detail.id,
      ...formToPatch(newVersionForm, detail.current_version),
      governanceReason: resolveGovernanceReason(newVersionForm.governanceReason),
    }), detail.id, resolveGovernanceReason(newVersionForm.governanceReason))
    setView("detail")
  }

  async function runVersionCommand(label: string, command: keyof Pick<AdminRepository, "approveActivityVersionReview" | "publishActivityVersion" | "unpublishActivityVersion" | "archiveActivityVersion">) {
    if (!detail) return showAction("error", "请先打开事情详情。")
    if (!targetVersionId) return showAction("error", "请选择操作目标版本。")
    const reason = resolveGovernanceReason(versionActionReason)
    if (!isGovernanceReasonReady(versionActionReason, minimumGovernanceReasonLength)) return showAction("error", `${label}的治理理由至少需要 ${minimumGovernanceReasonLength} 个字符。`)
    await runAction(label, (adminRepository) => adminRepository[command]({
      activityId: detail.id,
      versionId: targetVersionId,
      governanceReason: reason,
    }), detail.id, reason)
  }

  async function copySystemToFamily() {
    if (!detail) return showAction("error", "请先打开系统事情详情。")
    if (detail.source_type !== "system") return showAction("error", "只有系统事情可以复制为独立家庭事情。")
    const familyId = copyFamilyId.trim()
    const reason = resolveGovernanceReason(copyReason)
    if (!familyId) return showAction("error", "复制为家庭事情必须填写家庭 ID。")
    if (!isGovernanceReasonReady(copyReason, minimumGovernanceReasonLength)) return showAction("error", `复制为家庭事情的治理理由至少需要 ${minimumGovernanceReasonLength} 个字符。`)
    await runAction("复制为家庭事情", async (adminRepository) => {
      const activityDetail = await adminRepository.copySystemActivityToFamily({
        activityId: detail.id,
        activityVersionId: targetVersionId || detail.current_version_id,
        familyId,
        governanceReason: reason,
      })
      setGovernanceReason(reason)
      setDetail(activityDetail)
      setSelectedActivity(detailToListItem(activityDetail))
    }, undefined, reason)
  }

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return activities
      .filter((activity) => status === "all" || activity.status === status)
      .filter((activity) => {
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
        ].join(" ").toLowerCase().includes(query)
      })
      .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
  }, [activities, search, status])

  const summary = React.useMemo(() => ({
    total: filtered.length,
    system: activities.filter((item) => item.source_type === "system").length,
    family: activities.filter((item) => item.source_type === "family" || item.source_type === "copied_family").length,
    published: activities.filter((item) => item.status === "published").length,
    inactive: activities.filter((item) => item.status === "archived" || item.status === "unpublished").length,
  }), [activities, filtered.length])

  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, maxPage)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const publishVersion = detail?.versions.find((version) => version.id === targetVersionId) ?? detail?.current_version ?? null
  const publishRequirements = [
    { label: "标题", ok: Boolean(publishVersion?.title.trim()) },
    { label: "为什么值得做", ok: Boolean(publishVersion?.why.trim()) },
    { label: "可以怎么做", ok: Boolean(publishVersion?.how.trim()) },
    { label: "记录提示", ok: Boolean(publishVersion?.record_hint.trim()) },
    { label: "记录方式", ok: Boolean(publishVersion?.allowed_capture_modes.length) },
    { label: "推荐方式有效", ok: Boolean(publishVersion && publishVersion.allowed_capture_modes.includes(publishVersion.suggest_mode)) },
    { label: "插画来源", ok: Boolean(publishVersion?.illustration?.source) },
  ]
  const topAlert = error
    ? { state: "error" as const, message: error }
    : detailError
      ? { state: "error" as const, message: detailError }
      : actionState !== "idle" && actionMessage
        ? { state: actionState as Exclude<ActionState, "idle">, message: actionMessage }
        : null

  function requestConfirm(state: ConfirmState) {
    setConfirmState(state)
  }

  function backToList() {
    setView("list")
    setSelectedActivity(null)
    setDetail(null)
    setDetailError(null)
  }

  const listView = (
    <>
      <div className="grid gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">事情库</h1>
              {repository?.mode === "demo" ? <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">演示只读</span> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">管理系统和家庭事情的内容版本、发布状态与复制范围。</p>
          </div>
        </div>

        <div className={`grid gap-2 rounded-md border bg-background p-2 ${canCreate ? "lg:grid-cols-[minmax(240px,1fr)_180px_180px_auto]" : "lg:grid-cols-[minmax(240px,1fr)_180px_180px]"}`}>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题、内容或记录提示" />
          </div>
          <Select value={source} onValueChange={(value) => setSource(value as SourceFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="system">系统事情</SelectItem>
              <SelectItem value="family">家庭自定义</SelectItem>
              <SelectItem value="copied_family">家庭复制</SelectItem>
              <SelectItem value="all">全部来源</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="published">已发布</SelectItem>
              <SelectItem value="unpublished">已下架</SelectItem>
              <SelectItem value="archived">已归档</SelectItem>
            </SelectContent>
          </Select>
          {canCreate ? (
            <Button onClick={() => setCreateOpen(true)} disabled={demoReadonly}>
              <PlusIcon />
              新建事情
            </Button>
          ) : null}
        </div>

        {requiresGovernance ? (
          <div className="grid gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 p-3 dark:border-amber-500/30 dark:bg-amber-500/8 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-1.5">
              <Label>{governanceSettings.manualAuthorizationEnabled ? "家庭事情访问理由" : "家庭事情访问"}</Label>
              {governanceSettings.manualAuthorizationEnabled ? (
                <Input className="bg-background" value={governanceReason} onChange={(event) => setGovernanceReason(event.target.value)} placeholder={`至少 ${minimumGovernanceReasonLength} 个字符`} />
              ) : (
                <div className="text-sm text-muted-foreground">{governanceSettings.automaticReason}</div>
              )}
            </div>
            <Button onClick={() => void loadData()} disabled={loading || !canLoadPrivate}>
              <ShieldAlertIcon />
              加载
            </Button>
          </div>
        ) : null}

        <div className="text-xs text-muted-foreground">
          共 <span className="font-medium text-foreground">{summary.total}</span> 条，
          系统 <span className="font-medium text-foreground">{summary.system}</span>，
          家庭 <span className="font-medium text-foreground">{summary.family}</span>，
          已发布 <span className="font-medium text-foreground">{summary.published}</span>，
          下架/归档 <span className="font-medium text-foreground">{summary.inactive}</span>
        </div>
      </div>

      {requiresGovernance && !canLoadPrivate ? (
        <EmptyState title="等待治理理由" description="填写访问理由后再加载家庭来源的事情。" />
      ) : !loading && filtered.length === 0 ? (
        <EmptyState title="没有匹配结果" description="调整来源、状态或搜索关键词后再试。" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>更新</TableHead>
                <TableHead className="w-12 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <LoadingRows /> : rows.map((activity) => {
                const version = activity.current_version
                return (
                  <TableRow key={activity.id}>
                    <TableCell className="min-w-64 whitespace-normal">
                      <div className="font-medium leading-5 text-foreground">{version?.title || "未命名事情"}</div>
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{activity.display_no || activity.source_key}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sourceLabel(activity.source_type)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{version ? `v${version.version_no}` : "无版本"}</span>
                        <StatusPill status={activity.status} />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(activity.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label="打开操作菜单">
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onSelect={() => void openDetail(activity)}>
                            <EyeIcon />
                            打开详情
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
            disabled={loading}
          />
        </>
      )}
    </>
  )

  const detailView = detailLoading ? (
    <EmptyState title="详情加载中" description="正在读取当前版本和版本历史。" />
  ) : detail ? (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="rounded-lg border bg-background p-4">
        <Tabs defaultValue="content" className="gap-4">
          <TabsList>
            <TabsTrigger value="content">内容</TabsTrigger>
            <TabsTrigger value="illustration">插画</TabsTrigger>
            <TabsTrigger value="versions">版本</TabsTrigger>
            <TabsTrigger value="info">基本信息</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="grid gap-3">
            <div>
              <h2 className="text-lg font-semibold">当前内容</h2>
              <p className="mt-1 text-sm text-muted-foreground">当前版本面向家庭展示的主要文案。</p>
            </div>
            <VersionContent version={detail.current_version} />
          </TabsContent>

          <TabsContent value="illustration" className="grid gap-3">
            <div>
              <h2 className="text-lg font-semibold">当前版本插画</h2>
              <p className="mt-1 text-sm text-muted-foreground">插画跟随事情版本保存，发布切换后按目标版本展示。</p>
            </div>
            <IllustrationPreview version={detail.current_version} />
          </TabsContent>

          <TabsContent value="versions" className="grid gap-3">
            <div>
              <h2 className="text-lg font-semibold">版本</h2>
              <p className="mt-1 text-sm text-muted-foreground">共 {detail.versions.length} 个版本，选中的版本会用于右侧动作。</p>
            </div>
            <VersionList detail={detail} targetVersionId={targetVersionId} onTargetVersionChange={setTargetVersionId} />
          </TabsContent>

          <TabsContent value="info" className="grid gap-4">
            <InfoGrid
              items={[
                { label: "来源", value: sourceLabel(detail.source_type) },
                { label: "可见范围", value: detail.visibility },
                { label: "当前版本", value: detail.current_version ? `v${detail.current_version.version_no}` : "无版本" },
                { label: "最后更新", value: formatDate(detail.updated_at) },
              ]}
            />
            <details className="rounded-lg border bg-background">
              <summary className="cursor-pointer list-none px-4 py-3 font-medium">高级信息</summary>
              <div className="grid gap-4 border-t p-4 text-sm">
                <InfoGrid
                  items={[
                    { label: "家庭", value: detail.family_id || "不限定" },
                    { label: "创建时间", value: formatDate(detail.created_at) },
                    { label: "插画", value: illustrationSourceLabel(detail.current_version?.illustration?.source ?? "none") },
                    { label: "记录方式", value: detail.current_version?.allowed_capture_modes.map(modeLabel).join("、") || "未配置" },
                  ]}
                />
                {detail.current_version ? (
                  <InfoGrid
                    items={[
                      { label: "视角", value: detail.current_version.perspective || "未设置" },
                      { label: "语气", value: detail.current_version.tone || "未设置" },
                      { label: "分类", value: detail.current_version.category || "未设置" },
                      { label: "场景", value: detail.current_version.scene || "未设置" },
                    ]}
                  />
                ) : null}
              </div>
            </details>
          </TabsContent>
        </Tabs>
      </div>

      <aside className="grid gap-4 lg:sticky lg:top-4">
        <div className="grid gap-4 rounded-lg border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">状态与动作</h2>
              <p className="mt-1 text-sm text-muted-foreground">确认后执行发布、下架、归档或复制。</p>
            </div>
            <StatusPill status={detail.status} />
          </div>

          <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">当前版本</span>
              <span className="font-medium">{detail.current_version ? `v${detail.current_version.version_no}` : "无版本"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">来源</span>
              <span className="font-medium">{sourceLabel(detail.source_type)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">更新</span>
              <span className="font-medium">{formatDate(detail.updated_at)}</span>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>目标版本</Label>
            <Select value={targetVersionId} onValueChange={setTargetVersionId}>
              <SelectTrigger><SelectValue placeholder="选择版本" /></SelectTrigger>
              <SelectContent>
                {detail.versions.slice().sort((a, b) => b.version_no - a.version_no).map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    v{version.version_no} · {statusLabel(version.status)} · {version.title || "未命名"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-muted/20 p-3 text-sm">
            <div className="font-medium">{publishVersion ? `v${publishVersion.version_no} · ${publishVersion.title || "未命名"}` : "未选择版本"}</div>
            <div className="mt-1 line-clamp-2 text-muted-foreground">{publishVersion?.why || "该版本暂无内容说明。"}</div>
          </div>

          {governanceSettings.manualAuthorizationEnabled ? (
            <div className="grid gap-1.5">
              <Label>操作治理理由 *</Label>
              <Input value={versionActionReason} onChange={(event) => setVersionActionReason(event.target.value)} placeholder={`至少 ${minimumGovernanceReasonLength} 个字符`} />
            </div>
          ) : null}

          <details className="rounded-md border border-amber-300/60 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/8">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium">发布检查</summary>
            <div className="grid gap-2 border-t border-amber-300/60 p-3 dark:border-amber-500/30">
              {publishRequirements.map((requirement) => (
                <div key={requirement.label} className="flex items-center gap-2 text-sm">
                  {requirement.ok ? <CheckCircle2Icon className="size-4 text-emerald-600" /> : <ShieldAlertIcon className="size-4 text-amber-600" />}
                  <span>{requirement.label}</span>
                </div>
              ))}
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            <ActionButton
              capability="activity.review.approve"
              summary={permissionSummary}
              repository={repository}
              busy={busyAction === "批准版本"}
              onClick={() => requestConfirm({
                title: "批准版本",
                description: "确认该版本内容已通过审核。",
                confirmLabel: "确认批准",
                onConfirm: () => runVersionCommand("批准版本", "approveActivityVersionReview"),
              })}
              variant="outline"
            >
              <CheckCircle2Icon />
              批准
            </ActionButton>
            <ActionButton
              capability="activity.version.publish"
              summary={permissionSummary}
              repository={repository}
              busy={busyAction === "发布版本"}
              onClick={() => requestConfirm({
                title: "发布版本",
                description: "发布后，该版本会成为当前可用内容。",
                confirmLabel: "确认发布",
                content: <div className="rounded-lg border bg-muted/30 p-3 text-sm">目标版本：{publishVersion ? `v${publishVersion.version_no} · ${publishVersion.title || "未命名"}` : "未选择"}</div>,
                onConfirm: () => runVersionCommand("发布版本", "publishActivityVersion"),
              })}
            >
              <SendIcon />
              发布
            </ActionButton>
            <ActionButton
              capability="activity.version.unpublish"
              summary={permissionSummary}
              repository={repository}
              busy={busyAction === "下架版本"}
              onClick={() => requestConfirm({
                title: "下架版本",
                description: "确认将目标版本下架。",
                confirmLabel: "确认下架",
                destructive: true,
                onConfirm: () => runVersionCommand("下架版本", "unpublishActivityVersion"),
              })}
              variant="outline"
            >
              下架
            </ActionButton>
            <ActionButton
              capability="activity.version.archive"
              summary={permissionSummary}
              repository={repository}
              busy={busyAction === "归档版本"}
              onClick={() => requestConfirm({
                title: "归档版本",
                description: "归档后目标版本将退出常规使用。",
                confirmLabel: "确认归档",
                destructive: true,
                onConfirm: () => runVersionCommand("归档版本", "archiveActivityVersion"),
              })}
              variant="outline"
            >
              <ArchiveIcon />
              归档
            </ActionButton>
          </div>

          {detail.source_type === "system" && hasCapability(permissionSummary, "activity.copy_to_family") ? (
            <div className="grid gap-3 border-t pt-4">
              <div className="font-medium">复制为家庭事情</div>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>家庭 ID *</Label>
                  <Input value={copyFamilyId} onChange={(event) => setCopyFamilyId(event.target.value)} />
                </div>
                {governanceSettings.manualAuthorizationEnabled ? (
                  <div className="grid gap-1.5">
                    <Label>治理理由 *</Label>
                    <Input value={copyReason} onChange={(event) => setCopyReason(event.target.value)} />
                  </div>
                ) : null}
                <Button
                  variant="outline"
                  disabled={busyAction === "复制为家庭事情" || demoReadonly}
                  onClick={() => requestConfirm({
                    title: "复制为家庭事情",
                    description: "确认把目标版本复制为指定家庭的独立事情。",
                    confirmLabel: "确认复制",
                    onConfirm: copySystemToFamily,
                  })}
                >
                  {busyAction === "复制为家庭事情" ? <Loader2Icon className="animate-spin" /> : <CopyIcon />}
                  复制
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  ) : (
    <EmptyState title="选择事情" description="从列表打开一条事情后查看详情与版本历史。" />
  )

  const editView = (
    <Section title={view === "edit-current" ? "编辑当前草稿" : "创建新版本"} description={view === "edit-current" ? "只编辑当前草稿版本，保存后回到详情。" : "从当前版本带入字段，保存为新的版本。"}>
      <VersionEditor
        form={view === "edit-current" ? editForm : newVersionForm}
        inheritedVersion={detail?.current_version}
        onChange={(patch) => view === "edit-current"
          ? setEditForm((current) => ({ ...current, ...patch }))
          : setNewVersionForm((current) => ({ ...current, ...patch }))}
      />
      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
        <Button variant="outline" onClick={() => setView("detail")}>取消</Button>
        {view === "edit-current" ? (
          <ActionButton capability="activity.draft.update" summary={permissionSummary} repository={repository} busy={busyAction === "保存草稿"} onClick={() => void updateCurrentDraft()}>
            <SaveIcon />
            保存草稿
          </ActionButton>
        ) : (
          <ActionButton capability="activity.draft.create" summary={permissionSummary} repository={repository} busy={busyAction === "创建新版本"} onClick={() => void createNewVersion()}>
            <GitBranchIcon />
            创建版本
          </ActionButton>
        )}
      </div>
    </Section>
  )

  return (
    <main className="admin-page @container/main flex flex-1 flex-col gap-4 md:gap-6">
      {topAlert ? <InlineAlert state={topAlert.state} message={topAlert.message} /> : null}

      {view === "list" ? listView : (
        <>
          <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={backToList}>
                <ArrowLeftIcon />
                返回列表
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">{selectedTitle}</h1>
                {detail ? <StatusPill status={detail.status} /> : null}
                {detail ? <span className="text-sm text-muted-foreground">{sourceLabel(detail.source_type)}</span> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{view === "detail" ? "查看内容、版本和必要操作。" : "补全内容后保存，返回详情继续处理。"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {view !== "detail" ? <Button variant="outline" onClick={() => setView("detail")}>回到详情</Button> : null}
              {view === "detail" && detail?.current_version?.status === "draft" && canUpdateDraft ? (
                <Button onClick={() => setView("edit-current")}>
                  <SaveIcon />
                  编辑草稿
                </Button>
              ) : null}
              {view === "detail" && canCreate ? (
                <Button variant={detail?.current_version?.status === "draft" && canUpdateDraft ? "outline" : "default"} onClick={() => setView("new-version")}>
                  <GitBranchIcon />
                  创建版本
                </Button>
              ) : null}
            </div>
          </div>
          {view === "detail" ? detailView : editView}
        </>
      )}

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        draft={draftCreate}
        setDraft={setDraftCreate}
        onCreate={() => void createDraft()}
        canCreate={canCreate}
        busy={busyAction === "创建草稿"}
        demoReadonly={demoReadonly}
      />

      <ConfirmActionDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        destructive={confirmState?.destructive}
        loading={Boolean(busyAction)}
        onConfirm={() => void confirmState?.onConfirm()}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null)
        }}
      >
        {confirmState?.content}
      </ConfirmActionDialog>
    </main>
  )
}

export default ActivityLibraryPage
