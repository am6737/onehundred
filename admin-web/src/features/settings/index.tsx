import * as React from "react"
import {
  AlertTriangleIcon,
  RefreshCwIcon,
  SaveIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { createAdminRepository, createDemoAdminRepository, getSupabaseConfigStatus, useGovernanceAuthorizationSettings } from "@/lib/admin"
import type { AdminRepository, RoleCapabilitySummary } from "@/lib/admin"
import { cn } from "@/lib/utils"

interface SettingsState {
  repository: AdminRepository | null
  permission: RoleCapabilitySummary | null
  loading: boolean
  error: string | null
}

type NoticeTone = "success" | "warning" | "error" | "neutral"
type SaveStatus = "idle" | "saving" | "success" | "error"

const roleLabels: Record<RoleCapabilitySummary["normalizedRole"], string> = {
  content_editor: "内容编辑",
  content_reviewer: "内容审核",
  family_support: "家庭支持",
  system_admin: "系统管理员",
}

function isExplicitDemoMode() {
  return import.meta.env.VITE_ADMIN_DATA_MODE?.trim().toLowerCase() === "demo"
}

async function openRepository() {
  if (isExplicitDemoMode()) {
    return createDemoAdminRepository("当前为演示数据。")
  }
  return createAdminRepository()
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null
  const code = (error as { code?: unknown }).code
  return typeof code === "string" ? code : null
}

function formatSettingsError(error: unknown) {
  const code = getErrorCode(error)
  if (code === "missing_supabase_config") return "后台连接配置不完整。"
  if (code === "not_authenticated") return "需要管理员登录后才能查看设置。"
  if (code === "not_admin" || code === "admin_permission_denied") return "当前账号没有查看系统设置的权限。"
  if (code === "rpc_not_available" || code === "unsupported_admin_operation") return "后台能力尚未部署。"
  return "系统设置加载失败。"
}

function StatusNotice({
  tone,
  children,
}: {
  tone: NoticeTone
  children: React.ReactNode
}) {
  const toneClass = {
    success: "border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
    warning: "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
    neutral: "border-border bg-muted/30 text-muted-foreground",
  }[tone]

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}>
      {children}
    </div>
  )
}

function StatusRow({
  label,
  value,
  description,
  tone = "neutral",
  loading = false,
}: {
  label: string
  value: string
  description?: string
  tone?: NoticeTone
  loading?: boolean
}) {
  const dotClass = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-destructive",
    neutral: "bg-muted-foreground",
  }[tone]

  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="min-w-0">
        {loading ? (
          <Skeleton className="h-5 w-36" />
        ) : (
          <div className="flex min-h-5 items-center gap-2 text-sm font-medium">
            <span className={`size-2 rounded-full ${dotClass}`} aria-hidden="true" />
            <span>{value}</span>
          </div>
        )}
        {description ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  )
}

function SettingsSection({
  title,
  description,
  children,
  action,
  footer,
}: {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <Card className="rounded-lg" size="sm">
      <CardHeader className="border-b pb-3">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="px-4">
        <div className="divide-y">
          {children}
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-3 px-4 py-3">
        {footer}
      </CardFooter>
    </Card>
  )
}

function StatusBadge({ tone, children }: { tone: NoticeTone; children: React.ReactNode }) {
  const toneClass = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
    neutral: "border-border bg-background text-muted-foreground",
  }[tone]

  return (
    <Badge variant="outline" className={cn("h-5 rounded-md border-transparent px-1.5 ring-1", toneClass)}>
      {children}
    </Badge>
  )
}

export function SettingsPage() {
  const [state, setState] = React.useState<SettingsState>({ repository: null, permission: null, loading: true, error: null })
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle")
  const governanceSettings = useGovernanceAuthorizationSettings()
  const [manualAuthorizationDraft, setManualAuthorizationDraft] = React.useState(governanceSettings.manualAuthorizationEnabled)

  const config = getSupabaseConfigStatus()

  const loadData = React.useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const repository = await openRepository()
      try {
        const permission = await repository.getPermissionSummary()
        setState({ repository, permission, loading: false, error: null })
      } catch (error) {
        setState({ repository, permission: null, loading: false, error: formatSettingsError(error) })
      }
    } catch (error) {
      setState({ repository: null, permission: null, loading: false, error: formatSettingsError(error) })
    }
  }, [])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const repositoryMode = state.repository?.mode ?? null
  const canManageGovernance = state.permission?.normalizedRole === "system_admin"
  const hasGovernanceChanges = manualAuthorizationDraft !== governanceSettings.manualAuthorizationEnabled
  const governanceTone = manualAuthorizationDraft ? "success" : "warning"

  function saveGovernanceSettings() {
    setSaveStatus("saving")
    try {
      governanceSettings.setManualAuthorizationEnabled(manualAuthorizationDraft)
      setSaveStatus("success")
    } catch {
      setSaveStatus("error")
    }
  }

  function resetGovernanceDraft() {
    setManualAuthorizationDraft(governanceSettings.manualAuthorizationEnabled)
    setSaveStatus("idle")
  }

  const governanceFooterMessage =
    saveStatus === "success"
      ? "治理授权设置已保存。"
      : saveStatus === "error"
        ? "设置未保存，请重试。"
        : hasGovernanceChanges
          ? "有未保存更改。"
          : "当前设置已保存。"

  return (
    <main className="admin-page @container/main flex flex-1 flex-col gap-6">
      <SettingsSection
        title="连接与权限"
        description="当前会话可用状态。"
        action={
          <Button variant="outline" size="sm" onClick={loadData} disabled={state.loading}>
            <RefreshCwIcon className={state.loading ? "animate-spin" : ""} />
            刷新
          </Button>
        }
        footer={
          <>
            <span className="text-xs text-muted-foreground">连接、配置和角色只在此查看。</span>
            <StatusBadge tone={repositoryMode === "live" ? "success" : repositoryMode === "demo" ? "warning" : state.loading ? "neutral" : "error"}>
              {repositoryMode === "live" ? "可用" : repositoryMode === "demo" ? "演示" : state.loading ? "读取中" : "不可用"}
            </StatusBadge>
          </>
        }
      >
        <StatusRow
          label="后台连接"
          value={repositoryMode === "live" ? "已连接" : repositoryMode === "demo" ? "演示数据" : "未连接"}
          tone={repositoryMode === "live" ? "success" : repositoryMode === "demo" ? "warning" : state.loading ? "neutral" : "error"}
          description={repositoryMode === "demo" ? "预览状态不会写入生产后台。" : repositoryMode === "live" ? "可以读取当前管理员可访问的数据。" : "连接恢复后再调整设置。"}
          loading={state.loading}
        />
        <StatusRow
          label="连接配置"
          value={config.configured ? "完整" : "缺失"}
          tone={config.configured ? "success" : "error"}
          description={config.configured ? "已具备后台连接所需配置。" : "请先补齐部署配置。"}
        />
        {state.permission ? (
          <StatusRow
            label="当前职责"
            value={roleLabels[state.permission.normalizedRole]}
            tone={canManageGovernance ? "success" : "neutral"}
            description={canManageGovernance ? "可调整系统级设置。" : "只显示当前状态；无权修改系统级设置。"}
          />
        ) : null}
        {state.error || repositoryMode === "demo" ? (
          <div className="grid gap-2 py-3">
            {state.error ? <StatusNotice tone="error">{state.error}</StatusNotice> : null}
            {repositoryMode === "demo" ? <StatusNotice tone="warning">当前为演示数据，只用于预览，不保存生产设置。</StatusNotice> : null}
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="治理访问"
        description="访问受限家庭、记录和私有内容前是否要求填写理由。"
        footer={canManageGovernance ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="button" size="sm" onClick={saveGovernanceSettings} disabled={!hasGovernanceChanges || saveStatus === "saving"}>
              {saveStatus === "saving" ? <RefreshCwIcon className="animate-spin" /> : <SaveIcon />}
              保存设置
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={resetGovernanceDraft} disabled={!hasGovernanceChanges || saveStatus === "saving"}>
              放弃更改
            </Button>
            <span className={cn("text-xs", saveStatus === "error" ? "text-destructive" : "text-muted-foreground")}>
              {governanceFooterMessage}
            </span>
          </div>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">当前账号没有可编辑的系统设置。</span>
            <StatusBadge tone="neutral">只读</StatusBadge>
          </>
        )}
      >
        <StatusRow
          label="当前规则"
          value={governanceSettings.manualAuthorizationEnabled ? "需要填写理由" : "已关闭手动输入"}
          tone={governanceSettings.manualAuthorizationEnabled ? "success" : "warning"}
          description={governanceSettings.manualAuthorizationEnabled ? "访问受限数据前需要管理员填写治理理由。" : "会自动填写理由；完成排查后应恢复开启。"}
        />
        <div className="py-3">
          {canManageGovernance ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {manualAuthorizationDraft ? <ShieldCheckIcon className="size-4 text-emerald-600" /> : <AlertTriangleIcon className="size-4 text-amber-600" />}
                  手动填写治理理由
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {manualAuthorizationDraft ? "开启后，管理员需要先填写理由再访问受限数据。" : "关闭后，当前浏览器会自动填写理由；完成排查后应恢复开启。"}
                </p>
              </div>
              <Switch
                checked={manualAuthorizationDraft}
                onCheckedChange={(checked) => {
                  setManualAuthorizationDraft(checked)
                  setSaveStatus("idle")
                }}
                aria-label="手动填写治理理由"
              />
            </div>
          ) : (
            <StatusNotice tone="neutral">当前角色只能查看治理访问状态。</StatusNotice>
          )}
        </div>
        <StatusRow
          label="保存后状态"
          value={manualAuthorizationDraft ? "日常保护" : "临时排查"}
          tone={governanceTone}
          description={manualAuthorizationDraft ? "更适合日常治理。" : "低保护状态，只建议短时间使用。"}
        />
      </SettingsSection>

      <SettingsSection
        title="只读边界"
        description="高风险项保持固定策略。"
        footer={
          <>
            <span className="text-xs text-muted-foreground">这些项目不在页面内修改。</span>
            <StatusBadge tone="success">已锁定</StatusBadge>
          </>
        }
      >
        <StatusRow
          label="后台环境"
          value="由部署决定"
          tone="neutral"
          description="设置页只显示当前状态，不在浏览器内切换生产数据。"
        />
        <StatusRow
          label="连接凭据"
          value="不可编辑"
          tone="neutral"
          description="连接信息不在后台页面展示或修改。"
        />
        <StatusRow
          label="操作记录"
          value="不可关闭"
          tone="success"
          description="敏感操作需要保留操作记录。"
        />
      </SettingsSection>
    </main>
  )
}
