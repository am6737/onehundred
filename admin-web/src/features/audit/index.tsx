import * as React from "react"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"

import { AdminPagination } from "@/components/admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createAdminRepository } from "@/lib/admin"
import type { AdminRepository, AuditLogRow, RoleCapabilitySummary } from "@/lib/admin"
import { cn } from "@/lib/utils"

type TargetFilter = "all" | "record" | "activity" | "asset" | "family" | "member" | "message" | "system" | "other"
type TimeFilter = "all" | "today" | "7d" | "30d"

const pageSize = 12

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function getDateBoundary(filter: TimeFilter) {
  if (filter === "all") return null
  const date = new Date()
  if (filter === "today") date.setHours(0, 0, 0, 0)
  if (filter === "7d") date.setDate(date.getDate() - 7)
  if (filter === "30d") date.setDate(date.getDate() - 30)
  return date
}

function targetBucket(targetType: string): TargetFilter {
  const normalized = targetType.toLowerCase()
  if (normalized.includes("memory") || normalized.includes("record")) return "record"
  if (normalized.includes("activity") || normalized.includes("version")) return "activity"
  if (normalized.includes("asset") || normalized.includes("cover") || normalized.includes("illustration")) return "asset"
  if (normalized.includes("family")) return "family"
  if (normalized.includes("member") || normalized.includes("user") || normalized.includes("profile")) return "member"
  if (normalized.includes("notification") || normalized.includes("message")) return "message"
  if (normalized.includes("system") || normalized.includes("setting") || normalized.includes("permission")) return "system"
  return "other"
}

function targetLabel(value: TargetFilter | string) {
  if (value === "record") return "完成记录"
  if (value === "activity") return "事情/版本"
  if (value === "asset") return "资产"
  if (value === "family") return "家庭"
  if (value === "member") return "成员"
  if (value === "message") return "消息"
  if (value === "system") return "系统设置"
  if (value === "other") return "其他对象"
  return value
}

function actionLabel(action: string) {
  const normalized = action.toLowerCase()
  if (normalized.includes("approve")) return "审核通过"
  if (normalized.includes("reject") || normalized.includes("remove") || normalized.includes("hide")) return "驳回/隐藏"
  if (normalized.includes("publish")) return normalized.includes("unpublish") ? "下架" : "发布"
  if (normalized.includes("archive")) return "归档"
  if (normalized.includes("delete")) return "删除"
  if (normalized.includes("copy")) return "复制"
  if (normalized.includes("grant")) return "授权"
  if (normalized.includes("revoke")) return "取消授权"
  if (normalized.includes("view")) return "治理查看"
  if (normalized.includes("moderation") || normalized.includes("moderate")) return "处理审核"
  if (normalized.includes("create")) return "创建"
  if (normalized.includes("update")) return "更新"
  return action.replaceAll("_", " ").replaceAll(".", " / ")
}

function resultLabel(log: AuditLogRow) {
  const status = stringDetail(log.details, ["status", "result", "to_status", "moderation_status"])
  if (status) return statusLabel(status)
  const normalized = log.action.toLowerCase()
  if (normalized.includes("fail") || normalized.includes("error")) return "失败"
  if (normalized.includes("reject") || normalized.includes("remove") || normalized.includes("hide")) return "已处理"
  return "已记录"
}

function resultTone(log: AuditLogRow) {
  const normalizedAction = log.action.toLowerCase()
  const status = stringDetail(log.details, ["status", "result", "to_status", "moderation_status"])?.toLowerCase()

  if (normalizedAction.includes("fail") || normalizedAction.includes("error")) {
    return "border-destructive/30 bg-destructive/10 text-destructive"
  }
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
  }
  if (status === "rejected" || status === "flagged" || normalizedAction.includes("reject")) {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
  }
  if (status === "removed" || status === "hidden" || normalizedAction.includes("remove") || normalizedAction.includes("hide")) {
    return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-200"
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"
}

function statusLabel(value: string) {
  const normalized = value.toLowerCase()
  if (normalized === "approved") return "已通过"
  if (normalized === "pending") return "待处理"
  if (normalized === "rejected" || normalized === "flagged") return "需复核"
  if (normalized === "removed" || normalized === "hidden") return "已隐藏"
  if (normalized === "published") return "已发布"
  if (normalized === "unpublished") return "已下架"
  if (normalized === "archived") return "已归档"
  return value
}

function reasonLabel(details: Record<string, unknown>) {
  const reason = stringDetail(details, ["governanceReason", "governance_reason", "reason", "note", "moderation_note"])
  return reason || "未记录"
}

function objectLabel(log: AuditLogRow) {
  const title = stringDetail(log.details, ["title", "target_title", "activity_title", "family_name", "name"])
  const bucket = targetLabel(targetBucket(log.targetType))
  return title ? `${bucket} · ${title}` : bucket
}

function actorLabel(log: AuditLogRow) {
  return stringDetail(log.details, ["actor_name", "admin_name", "email", "phone"]) || shortId(log.adminUserId)
}

function stringDetail(details: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = details[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" || typeof value === "boolean") return String(value)
  }
  return null
}

function shortId(value: string) {
  if (value.length <= 14) return value
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

function jsonText(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function canViewAudit(summary: RoleCapabilitySummary | null) {
  return Boolean(summary?.capabilities.includes("audit.view"))
}

function LoadingRows() {
  return Array.from({ length: 8 }).map((_, index) => (
    <TableRow key={index}>
      <TableCell className="py-2"><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-4 w-44" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell className="py-2"><Skeleton className="h-4 w-36" /></TableCell>
    </TableRow>
  ))
}

function StateBlock({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-3 border-t bg-muted/10 px-4 text-center">
      <div className="text-sm font-medium">{title}</div>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value}</div>
    </div>
  )
}

function SelectedEventPanel({ log }: { log: AuditLogRow }) {
  return (
    <section className="border-t bg-muted/10 p-4" aria-label="选中事件详情">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="text-xs text-muted-foreground">事件详情</div>
          <h2 className="mt-1 text-base font-semibold">{actionLabel(log.action)} · {objectLabel(log)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(log.createdAt)} 由 {actorLabel(log)} 操作，结果为 {resultLabel(log)}。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailField label="治理理由" value={reasonLabel(log.details)} />
          <DetailField label="对象" value={objectLabel(log)} />
          <DetailField label="动作" value={actionLabel(log.action)} />
          <DetailField label="结果" value={resultLabel(log)} />
        </div>
      </div>

      <details className="mt-4 rounded-md border bg-background/80">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          原始信息
        </summary>
        <div className="grid gap-3 border-t p-3 text-sm md:grid-cols-2">
          <DetailField label="事件 ID" value={log.id} />
          <DetailField label="操作者 ID" value={log.adminUserId} />
          <DetailField label="对象类型" value={log.targetType} />
          <DetailField label="对象 ID" value={log.targetId} />
          <DetailField label="请求来源" value={log.ipAddress ?? "未记录"} />
          <div className="md:col-span-2">
            <div className="mb-2 text-xs text-muted-foreground">元数据</div>
            <pre className="max-h-72 overflow-auto rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap">
              {jsonText(log.details)}
            </pre>
          </div>
        </div>
      </details>
    </section>
  )
}

export function AuditLogPage() {
  const [repository, setRepository] = React.useState<AdminRepository | null>(null)
  const [permissions, setPermissions] = React.useState<RoleCapabilitySummary | null>(null)
  const [logs, setLogs] = React.useState<AuditLogRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [target, setTarget] = React.useState<TargetFilter>("all")
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>("all")
  const [page, setPage] = React.useState(1)
  const [selectedLogId, setSelectedLogId] = React.useState<number | null>(null)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const adminRepository = await createAdminRepository()
      setRepository(adminRepository)
      if (adminRepository.mode !== "live") {
        setPermissions(null)
        setLogs([])
        setSelectedLogId(null)
        setError("当前后台连接不可用于审计事件。请登录具备审计权限的后台账号，或连接正式后台。")
        return
      }

      const permissionSummary = await adminRepository.getPermissionSummary()
      setPermissions(permissionSummary)
      if (!canViewAudit(permissionSummary)) {
        setLogs([])
        setSelectedLogId(null)
        return
      }

      const auditRows = await adminRepository.listAuditLogs({ limit: 200 })
      setLogs(auditRows)
      setSelectedLogId((current) => current && auditRows.some((log) => log.id === current) ? current : null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "审计事件加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  React.useEffect(() => {
    setPage(1)
  }, [search, target, timeFilter])

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    const boundary = getDateBoundary(timeFilter)
    return logs
      .filter((log) => target === "all" || targetBucket(log.targetType) === target)
      .filter((log) => !boundary || new Date(log.createdAt) >= boundary)
      .filter((log) => !query || [
        actionLabel(log.action),
        log.action,
        objectLabel(log),
        log.targetType,
        log.targetId,
        actorLabel(log),
        log.adminUserId,
        reasonLabel(log.details),
        resultLabel(log),
        log.ipAddress ?? "",
        jsonText(log.details),
      ].join(" ").toLowerCase().includes(query))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  }, [logs, search, target, timeFilter])

  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, maxPage)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedLog = filtered.find((log) => log.id === selectedLogId) ?? null
  const hasAuditAccess = canViewAudit(permissions)

  return (
    <main className="admin-page @container/main flex flex-1 flex-col gap-6">
      <Card className="rounded-lg" size="sm">
        <CardHeader className="border-b pb-3">
          <div>
            <CardTitle>事件列表</CardTitle>
            <CardDescription>按时间查看关键操作，点击行查看详情。</CardDescription>
          </div>
          <CardAction>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCwIcon className={loading ? "animate-spin" : ""} />
              刷新
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b bg-muted/15 p-3 md:flex-row md:items-center">
            <div className="relative md:min-w-96 md:flex-1">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
              <Input className="h-8 pl-8" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索操作者、对象、动作、理由或结果" />
            </div>
            <Select value={target} onValueChange={(value) => setTarget(value as TargetFilter)}>
              <SelectTrigger size="sm" className="w-full md:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部对象</SelectItem>
                <SelectItem value="record">完成记录</SelectItem>
                <SelectItem value="activity">事情/版本</SelectItem>
                <SelectItem value="asset">资产</SelectItem>
                <SelectItem value="family">家庭</SelectItem>
                <SelectItem value="member">成员</SelectItem>
                <SelectItem value="message">消息</SelectItem>
                <SelectItem value="system">系统设置</SelectItem>
                <SelectItem value="other">其他对象</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as TimeFilter)}>
              <SelectTrigger size="sm" className="w-full md:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部时间</SelectItem>
                <SelectItem value="today">今天</SelectItem>
                <SelectItem value="7d">近 7 天</SelectItem>
                <SelectItem value="30d">近 30 天</SelectItem>
              </SelectContent>
            </Select>
            <div className="shrink-0 text-xs text-muted-foreground md:min-w-28 md:text-right">
              {filtered.length} 条
            </div>
          </div>

          {error ? (
            <StateBlock title="审计事件加载失败" description={error} action={<Button variant="outline" onClick={loadData}>重试</Button>} />
          ) : !loading && repository && !hasAuditAccess ? (
            <StateBlock title="无法查看审计事件" description="当前角色没有审计查看权限。" />
          ) : !loading && filtered.length === 0 ? (
            <StateBlock title="暂无审计事件" description="当前筛选条件下没有匹配的事件。" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">时间</TableHead>
                      <TableHead>操作者</TableHead>
                      <TableHead>对象</TableHead>
                      <TableHead>动作</TableHead>
                      <TableHead>结果</TableHead>
                      <TableHead>治理理由</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? <LoadingRows /> : rows.map((log) => {
                      const selected = selectedLogId === log.id
                      const ToggleIcon = selected ? ChevronDownIcon : ChevronRightIcon
                      return (
                        <TableRow
                          key={log.id}
                          className="cursor-pointer"
                          data-state={selected ? "selected" : undefined}
                          onClick={() => setSelectedLogId(selected ? null : log.id)}
                        >
                          <TableCell className="py-2 align-middle text-sm text-muted-foreground">{formatDate(log.createdAt)}</TableCell>
                          <TableCell className="max-w-48 py-2 align-middle">
                            <div className="truncate text-sm font-medium">{actorLabel(log)}</div>
                          </TableCell>
                          <TableCell className="max-w-64 py-2 align-middle">
                            <div className="truncate text-sm font-medium">{objectLabel(log)}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{targetLabel(targetBucket(log.targetType))}</div>
                          </TableCell>
                          <TableCell className="py-2 align-middle text-sm font-medium">{actionLabel(log.action)}</TableCell>
                          <TableCell className="py-2 align-middle">
                            <Badge variant="outline" className={cn("h-5 rounded-md border-transparent px-1.5 ring-1", resultTone(log))}>
                              {resultLabel(log)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-72 py-2 align-middle">
                            <div className="flex items-center gap-2 text-sm">
                              <ToggleIcon className="size-4 shrink-0 text-muted-foreground" />
                              <span className="line-clamp-2">{reasonLabel(log.details)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <AdminPagination
                total={filtered.length}
                page={currentPage}
                pageSize={pageSize}
                onPageChange={setPage}
                disabled={loading}
                className="px-4"
              />
              {selectedLog ? <SelectedEventPanel log={selectedLog} /> : null}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
