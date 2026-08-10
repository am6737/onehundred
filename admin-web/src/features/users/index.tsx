import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { AdminPagination } from "@/components/admin"
import { minimumGovernanceReasonLength } from "@/components/admin/governance-access-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createAdminRepository, isGovernanceReasonReady, resolveGovernanceReason } from "@/lib/admin"
import type {
  AdminRepository,
  AdminUserRow,
  AuditLogRow,
  FamilyRow,
  MemoryRow,
  RoleCapabilitySummary,
} from "@/lib/admin/types"

type UserFilter = "all" | "admin" | "member"
type UserSort = "created_desc" | "created_asc" | "name_asc"

type UserPrivateContext = {
  userId: string
  reason: string
  auditEventId?: string | null
  families: FamilyRow[]
  memories: MemoryRow[]
  auditLogs: AuditLogRow[]
}

const defaultPageSize = 12
const userPageSizeOptions = [10, 12, 20, 50]
const detailItemLimit = 5

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function userName(user: AdminUserRow) {
  return user.username || user.generatedEmail || user.id
}

function shortId(value: string) {
  if (value.length <= 12) return value
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

function familyRole(user: AdminUserRow) {
  return user.customRole || user.role || "未设置"
}

function adminRoleLabel(role: AdminUserRow["adminRole"]) {
  if (role === "system_admin" || role === "super_admin" || role === "admin") return "系统管理员"
  if (role === "content_editor") return "内容编辑"
  if (role === "content_reviewer" || role === "operator") return "内容审核"
  if (role === "family_support" || role === "support") return "家庭支持"
  return "普通用户"
}

function canViewGovernedFamilyData(summary: RoleCapabilitySummary | null) {
  return Boolean(
    summary?.capabilities.includes("record.view_governed") ||
      summary?.capabilities.includes("family.support"),
  )
}

function targetLabel(value: string) {
  if (value === "activity" || value === "activity_version") return "事情"
  if (value === "asset") return "资产"
  if (value === "family") return "家庭"
  if (value === "member") return "成员"
  if (value === "message") return "消息"
  if (value === "record" || value === "memory") return "记录"
  if (value === "system") return "系统"
  if (value === "repository") return "数据源"
  return "其他对象"
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

function StatePanel({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-lg border bg-background p-6 text-center">
      <div className="text-base font-medium">{title}</div>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}

function LoadingRows() {
  return Array.from({ length: 6 }).map((_, index) => (
    <TableRow key={index}>
      <TableCell><Skeleton className="h-5 w-44" /></TableCell>
      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
      <TableCell><Skeleton className="ml-auto h-8 w-16" /></TableCell>
    </TableRow>
  ))
}

function CopyIdButton({ value, label = "复制 ID" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard?.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={() => void copy()}
      aria-label={copied ? "已复制" : label}
      title={copied ? "已复制" : label}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  )
}

function EmptyTab({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function SmallStatus({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "strong" }) {
  return (
    <span className={tone === "strong" ? "font-medium text-foreground" : "text-muted-foreground"}>
      {children}
    </span>
  )
}

export function UsersPage() {
  const [repository, setRepository] = useState<AdminRepository | null>(null)
  const [permissionSummary, setPermissionSummary] = useState<RoleCapabilitySummary | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<UserFilter>("all")
  const [sort, setSort] = useState<UserSort>("created_desc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detailReason, setDetailReason] = useState("")
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [privateContext, setPrivateContext] = useState<UserPrivateContext | null>(null)

  async function ensureRepository() {
    if (repository) return repository
    const adminRepository = await createAdminRepository()
    setRepository(adminRepository)
    return adminRepository
  }

  async function loadUsers() {
    setLoading(true)
    setError(null)
    try {
      const adminRepository = await ensureRepository()
      const [userRows, summary] = await Promise.all([
        adminRepository.listUsers({ limit: 300 }),
        adminRepository.getPermissionSummary(),
      ])
      setUsers(userRows)
      setPermissionSummary(summary)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "用户目录加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, filter, sort])

  useEffect(() => {
    setDetailReason("")
    setDetailError(null)
    setDetailLoading(false)
    setPrivateContext(null)
  }, [selectedUserId])

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return users
      .filter((user) => {
        const matchesSearch = !normalizedSearch || [
          user.username,
          user.generatedEmail,
          user.id,
          user.role,
          user.customRole,
          user.adminRole,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
        const matchesFilter =
          filter === "all" || (filter === "admin" && user.adminRole) || (filter === "member" && !user.adminRole)
        return matchesSearch && matchesFilter
      })
      .sort((left, right) => {
        if (sort === "created_asc") return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        if (sort === "name_asc") return userName(left).localeCompare(userName(right), "zh-CN")
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })
  }, [filter, search, sort, users])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null
  const canOpenPrivateContext = canViewGovernedFamilyData(permissionSummary)

  async function loadPrivateContext(user: AdminUserRow) {
    const reason = resolveGovernanceReason(detailReason)
    if (!isGovernanceReasonReady(detailReason, minimumGovernanceReasonLength)) {
      setDetailError(`治理理由至少需要 ${minimumGovernanceReasonLength} 个字符。`)
      return
    }
    setDetailLoading(true)
    setDetailError(null)
    try {
      const adminRepository = await ensureRepository()
      const auditEvent = await adminRepository.requestGovernedPrivateAccess({
        targetType: "member",
        targetId: user.id,
        governanceReason: reason,
      })
      const [familyRows, memoryRows, auditRows] = await Promise.all([
        adminRepository.listFamilies({ limit: 300, governanceReason: reason }),
        adminRepository.listMemories({ limit: 300, governanceReason: reason }),
        adminRepository.listAuditLogs({ limit: 200 }),
      ])
      setPrivateContext({
        userId: user.id,
        reason,
        auditEventId: auditEvent.id,
        families: familyRows,
        memories: memoryRows,
        auditLogs: auditRows,
      })
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : "用户关联详情加载失败")
    } finally {
      setDetailLoading(false)
    }
  }

  function renderList() {
    return (
      <>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">用户目录</h1>
            <p className="text-sm text-muted-foreground">按身份与账号线索定位用户，进入详情后再读取家庭上下文。</p>
          </div>
          <Button variant="outline" onClick={() => void loadUsers()} disabled={loading}>
            <RefreshCwIcon className={loading ? "animate-spin" : undefined} />
            刷新
          </Button>
        </div>

        <section className="rounded-lg border bg-background">
          <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              匹配 <SmallStatus tone="strong">{filteredUsers.length}</SmallStatus> 个用户
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative md:min-w-80">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索名称、邮箱、角色或 ID"
                  aria-label="搜索用户"
                />
              </div>
              <Select value={filter} onValueChange={(value) => setFilter(value as UserFilter)}>
                <SelectTrigger className="w-full md:w-36" aria-label="筛选用户类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部身份</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="member">普通用户</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(value) => setSort(value as UserSort)}>
                <SelectTrigger className="w-full md:w-40" aria-label="用户排序">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_desc">最新注册</SelectItem>
                  <SelectItem value="created_asc">最早注册</SelectItem>
                  <SelectItem value="name_asc">名称 A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-4">
            {error ? (
              <StatePanel title="用户目录加载失败" description={error} action={<Button onClick={() => void loadUsers()}>重试</Button>} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>家庭角色</TableHead>
                    <TableHead>后台身份</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead className="w-12 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? <LoadingRows /> : null}
                  {!loading && pagedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <StatePanel title="没有匹配用户" description="调整搜索词或筛选条件后再试。" />
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!loading && pagedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="py-2">
                        <div className="flex min-w-56 flex-col gap-0.5">
                          <span className="truncate font-medium">{userName(user)}</span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span title={user.id}>ID {shortId(user.id)}</span>
                            <CopyIdButton value={user.id} />
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">{familyRole(user)}</TableCell>
                      <TableCell className="py-2">
                        <span className={user.adminRole ? "inline-flex items-center gap-1 font-medium" : "text-muted-foreground"}>
                          {user.adminRole ? <ShieldCheckIcon className="size-4" /> : null}
                          {adminRoleLabel(user.adminRole)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2">{formatDate(user.createdAt)}</TableCell>
                      <TableCell className="py-2 text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => setSelectedUserId(user.id)} aria-label={`查看 ${userName(user)} 详情`}>
                          <EyeIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          {!error ? (
            <AdminPagination
              total={filteredUsers.length}
              page={currentPage}
              pageSize={pageSize}
              pageSizeOptions={userPageSizeOptions}
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
      </>
    )
  }

  function renderDetail(user: AdminUserRow) {
    const relatedFamilyIds = new Set<string>()
    if (privateContext?.userId === user.id) {
      for (const family of privateContext.families) {
        if (family.createdBy === user.id) relatedFamilyIds.add(family.id)
      }
      for (const memory of privateContext.memories) {
        if (memory.userId === user.id) relatedFamilyIds.add(memory.familyId)
      }
    }
    const allRelatedFamilies = privateContext?.families.filter((family) => relatedFamilyIds.has(family.id)) ?? []
    const relatedFamilies = allRelatedFamilies.slice(0, detailItemLimit)
    const recentMemories = privateContext?.memories
      .filter((memory) => memory.userId === user.id)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, detailItemLimit) ?? []
    const recentAuditLogs = privateContext?.auditLogs
      .filter((log) => log.adminUserId === user.id || log.targetId === user.id)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, detailItemLimit) ?? []

    return (
      <>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" className="w-fit" onClick={() => setSelectedUserId(null)}>
              <ArrowLeftIcon />
              返回用户目录
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">{userName(user)}</h1>
              <p className="text-sm text-muted-foreground">{user.generatedEmail || "未设置邮箱"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <SmallStatus>注册于 {formatDate(user.createdAt)}</SmallStatus>
            <CopyIdButton value={user.id} />
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.4fr)]">
          <div className="rounded-lg border bg-background p-4">
            <h2 className="text-base font-medium">用户概览</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">后台身份</dt>
                <dd className="font-medium">{adminRoleLabel(user.adminRole)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">家庭角色</dt>
                <dd>{familyRole(user)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">账号邮箱</dt>
                <dd className="max-w-72 truncate text-right">{user.generatedEmail || "未设置"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">家庭上下文</dt>
                <dd className={canOpenPrivateContext ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {canOpenPrivateContext ? "可按理由读取" : "无读取权限"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">用户 ID</dt>
                <dd className="flex items-center gap-1 text-right text-muted-foreground">
                  <span title={user.id}>{shortId(user.id)}</span>
                  <CopyIdButton value={user.id} />
                </dd>
              </div>
            </dl>
            <details className="mt-4 rounded-md border bg-muted/20 p-3 text-sm">
              <summary className="cursor-pointer font-medium">账号细节</summary>
              <dl className="mt-3 grid gap-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">完整用户 ID</dt>
                  <dd className="max-w-64 truncate text-right" title={user.id}>{user.id}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">后台角色</dt>
                  <dd>{adminRoleLabel(user.adminRole)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">注册时间</dt>
                  <dd>{formatDate(user.createdAt)}</dd>
                </div>
              </dl>
            </details>
          </div>

          <div className="rounded-lg border bg-background p-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-medium">关联上下文</h2>
              <p className="text-sm text-muted-foreground">家庭私有上下文只在详情内读取，并保留本次治理查看记录。</p>
            </div>

            {!canOpenPrivateContext ? (
              <StatePanel
                title="没有家庭上下文读取权限"
                description="当前后台身份不能读取该用户的家庭、记录和关联操作信息。"
              />
            ) : privateContext?.userId === user.id ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  已记录本次访问 · {privateContext.auditEventId ? `审计事件 ${privateContext.auditEventId}` : "审计事件已生成"}
                </div>

                <Tabs defaultValue="families" className="gap-3">
                  <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                    <TabsTrigger value="families">关联家庭</TabsTrigger>
                    <TabsTrigger value="records">最近记录</TabsTrigger>
                    <TabsTrigger value="actions">操作记录</TabsTrigger>
                    <TabsTrigger value="governance">治理信息</TabsTrigger>
                  </TabsList>

                  <TabsContent value="families" className="grid gap-2">
                    <div className="text-xs text-muted-foreground">
                      显示 {relatedFamilies.length} / {allRelatedFamilies.length} 个关联家庭
                    </div>
                    {relatedFamilies.length ? relatedFamilies.map((family) => (
                      <div key={family.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium" title={family.id}>{shortId(family.id)}</span>
                          <span className="shrink-0 text-muted-foreground">{formatShortDate(family.createdAt)}</span>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {family.createdBy === user.id ? "创建者" : "记录关联"} · 记录 {family.memoryCount ?? "未汇总"} · 孩子 {family.kidCount ?? "未汇总"}
                        </div>
                      </div>
                    )) : <EmptyTab>没有可见关联家庭。</EmptyTab>}
                  </TabsContent>

                  <TabsContent value="records" className="grid gap-2">
                    <div className="text-xs text-muted-foreground">最多显示最近 {detailItemLimit} 条记录</div>
                    {recentMemories.length ? recentMemories.map((memory) => (
                      <div key={memory.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{memory.title || memory.levelNum}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatShortDate(memory.createdAt)}</span>
                        </div>
                        <div className="mt-1 line-clamp-2 text-muted-foreground">{memory.caption || memory.moderationStatus}</div>
                        <div className="mt-2 text-xs text-muted-foreground">{memory.type} · 孩子 {shortId(memory.kidId)}</div>
                      </div>
                    )) : <EmptyTab>没有可见记录。</EmptyTab>}
                  </TabsContent>

                  <TabsContent value="actions" className="grid gap-2">
                    <div className="text-xs text-muted-foreground">最多显示最近 {detailItemLimit} 条操作记录</div>
                    {recentAuditLogs.length ? recentAuditLogs.map((log) => (
                      <div key={log.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{actionLabel(log.action)}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatShortDate(log.createdAt)}</span>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {targetLabel(log.targetType)} · {shortId(log.targetId)}
                        </div>
                      </div>
                    )) : <EmptyTab>没有可见操作记录。</EmptyTab>}
                  </TabsContent>

                  <TabsContent value="governance" className="grid gap-3">
                    <dl className="grid gap-3 rounded-md border p-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">读取权限</dt>
                        <dd className="font-medium">已授权本次查看</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">治理理由</dt>
                        <dd className="max-w-80 truncate text-right" title={privateContext.reason}>{privateContext.reason}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">审计事件</dt>
                        <dd>{privateContext.auditEventId ?? "已记录"}</dd>
                      </div>
                    </dl>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 rounded-md border bg-muted/20 p-3">
                <div>
                  <h3 className="text-sm font-medium">需要治理理由</h3>
                  <p className="mt-1 text-sm text-muted-foreground">读取家庭、记录和操作上下文前，需要留下明确理由并写入审计。</p>
                </div>
                <Input
                  value={detailReason}
                  onChange={(event) => setDetailReason(event.target.value)}
                  placeholder={`输入治理理由，至少 ${minimumGovernanceReasonLength} 个字符`}
                  aria-label="用户详情治理理由"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={() => void loadPrivateContext(user)}
                    disabled={detailLoading || !isGovernanceReasonReady(detailReason, minimumGovernanceReasonLength)}
                  >
                    <EyeIcon />
                    {detailLoading ? "读取中" : "查看关联信息"}
                  </Button>
                </div>
                {detailError ? <StatePanel title="关联信息加载失败" description={detailError} /> : null}
              </div>
            )}
          </div>
        </section>
      </>
    )
  }

  return (
    <main className="admin-page @container/main flex flex-1 flex-col gap-4 md:gap-6">
      {selectedUser ? renderDetail(selectedUser) : renderList()}
    </main>
  )
}

export default UsersPage
