import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { AdminPagination } from "@/components/admin"
import { minimumGovernanceReasonLength } from "@/components/admin/governance-access-card"
import { Badge } from "@/components/ui/badge"
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
  FamilyRow,
  MemoryRow,
  NotificationRow,
  RoleCapabilitySummary,
} from "@/lib/admin/types"

type FamilyFilter = "all" | "with_kids" | "with_records" | "quiet"
type FamilySort = "created_desc" | "created_asc" | "members_desc" | "records_desc"

type FamilyPrivateDetail = {
  familyId: string
  reason: string
  auditEventId?: string | null
  memories: MemoryRow[]
  notifications: NotificationRow[]
}

const defaultPageSize = 12

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

function userName(user: AdminUserRow | undefined) {
  if (!user) return "未知用户"
  return user.username || user.generatedEmail || user.id
}

function memoryTypeLabel(type: MemoryRow["type"]) {
  if (type === "photo") return "照片"
  if (type === "voice") return "语音"
  if (type === "video") return "视频"
  return "文字"
}

function moderationLabel(status: MemoryRow["moderationStatus"]) {
  if (status === "pending") return "待审核"
  if (status === "approved") return "已通过"
  if (status === "flagged") return "已标记"
  return "已移除"
}

function shortId(value: string) {
  if (value.length <= 13) return value
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

function notificationStatusLabel(status: NotificationRow["status"]) {
  if (status === "pending") return "待处理"
  if (status === "processing") return "处理中"
  if (status === "done") return "已完成"
  return "失败"
}

function canViewGovernedFamilyData(summary: RoleCapabilitySummary | null) {
  return Boolean(
    summary?.capabilities.includes("record.view_governed") ||
      summary?.capabilities.includes("family.support"),
  )
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
      <TableCell><Skeleton className="h-5 w-48" /></TableCell>
      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
      <TableCell><Skeleton className="ml-auto h-8 w-16" /></TableCell>
    </TableRow>
  ))
}

function CopyIconButton({ value, label = "复制" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard?.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Button variant="ghost" size="icon-xs" onClick={() => void copy()} disabled={!value} aria-label={label} title={copied ? "已复制" : label}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  )
}

export function FamiliesPage() {
  const [repository, setRepository] = useState<AdminRepository | null>(null)
  const [permissionSummary, setPermissionSummary] = useState<RoleCapabilitySummary | null>(null)
  const [families, setFamilies] = useState<FamilyRow[]>([])
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [directoryReason, setDirectoryReason] = useState("")
  const [loadedReason, setLoadedReason] = useState<string | null>(null)
  const [authorizationPanelOpen, setAuthorizationPanelOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FamilyFilter>("all")
  const [sort, setSort] = useState<FamilySort>("created_desc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [privateDetail, setPrivateDetail] = useState<FamilyPrivateDetail | null>(null)

  async function ensureRepository() {
    if (repository) return repository
    const adminRepository = await createAdminRepository()
    setRepository(adminRepository)
    return adminRepository
  }

  async function loadDirectory() {
    const reason = resolveGovernanceReason(directoryReason)
    if (!isGovernanceReasonReady(directoryReason, minimumGovernanceReasonLength)) {
      setError(`治理理由至少需要 ${minimumGovernanceReasonLength} 个字符。`)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const adminRepository = await ensureRepository()
      const [familyRows, userRows, summary] = await Promise.all([
        adminRepository.listFamilies({ limit: 300, governanceReason: reason }),
        adminRepository.listUsers({ limit: 300 }),
        adminRepository.getPermissionSummary(),
      ])
      setFamilies(familyRows)
      setUsers(userRows)
      setPermissionSummary(summary)
      setLoadedReason(reason)
      setAuthorizationPanelOpen(false)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "家庭目录加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [search, filter, sort])

  useEffect(() => {
    setDetailError(null)
    setDetailLoading(false)
    setPrivateDetail(null)
  }, [selectedFamilyId])

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])
  const canOpenDetail = canViewGovernedFamilyData(permissionSummary)

  const filteredFamilies = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return families
      .filter((family) => {
        const creator = usersById.get(family.createdBy)
        const matchesSearch = !normalizedSearch || [
          family.id,
          family.createdBy,
          creator?.username,
          creator?.generatedEmail,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
        const kidCount = family.kidCount ?? 0
        const recordCount = family.memoryCount ?? 0
        const matchesFilter =
          filter === "all" ||
          (filter === "with_kids" && kidCount > 0) ||
          (filter === "with_records" && recordCount > 0) ||
          (filter === "quiet" && kidCount === 0 && recordCount === 0)
        return matchesSearch && matchesFilter
      })
      .sort((left, right) => {
        if (sort === "created_asc") return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        if (sort === "members_desc") return (right.memberCount ?? 0) - (left.memberCount ?? 0)
        if (sort === "records_desc") return (right.memoryCount ?? 0) - (left.memoryCount ?? 0)
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })
  }, [families, filter, search, sort, usersById])

  const totalPages = Math.max(1, Math.ceil(filteredFamilies.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedFamilies = filteredFamilies.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedFamily = families.find((family) => family.id === selectedFamilyId) ?? null

  async function loadFamilyDetail(family: FamilyRow) {
    if (!loadedReason) return
    setDetailLoading(true)
    setDetailError(null)
    try {
      const adminRepository = await ensureRepository()
      const auditEvent = await adminRepository.requestGovernedPrivateAccess({
        targetType: "family",
        targetId: family.id,
        governanceReason: loadedReason,
      })
      const [memoryRows, notificationRows] = await Promise.all([
        adminRepository.listMemories({ limit: 300, governanceReason: loadedReason }),
        adminRepository.listNotifications({ limit: 200, governanceReason: loadedReason }),
      ])
      setPrivateDetail({
        familyId: family.id,
        reason: loadedReason,
        auditEventId: auditEvent.id,
        memories: memoryRows
          .filter((memory) => memory.familyId === family.id)
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
        notifications: notificationRows
          .filter((notification) => notification.familyId === family.id)
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
      })
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : "家庭详情加载失败")
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedFamily || !loadedReason || !canOpenDetail) return
    void loadFamilyDetail(selectedFamily)
  }, [selectedFamilyId, loadedReason, canOpenDetail])

  function renderGate() {
    return (
      <section className="rounded-lg border bg-background p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-2">
            <h2 className="text-base font-medium">读取家庭目录</h2>
            <p className="text-sm text-muted-foreground">
              当前尚未授权读取家庭目录。填写明确理由后才会加载家庭摘要；进入详情会复用该理由并保留访问记录。
            </p>
            <Input
              value={directoryReason}
              onChange={(event) => setDirectoryReason(event.target.value)}
              placeholder={`输入治理理由，至少 ${minimumGovernanceReasonLength} 个字符`}
              aria-label="家庭目录治理理由"
            />
          </div>
          <Button onClick={() => void loadDirectory()} disabled={loading || !isGovernanceReasonReady(directoryReason, minimumGovernanceReasonLength)}>
            <EyeIcon />
            {loading ? "读取中" : "加载目录"}
          </Button>
        </div>
      </section>
    )
  }

  function renderAuthorizationStrip() {
    if (!loadedReason) return null

    return (
      <div className="flex flex-col gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <ShieldCheckIcon className="size-3.5" />
            已授权读取家庭目录
          </span>
          <span>详情读取会复用本次理由并保留访问记录。</span>
          {!canOpenDetail ? <span>当前角色不能打开家庭私有详情。</span> : null}
        </div>
        <Button variant="ghost" size="xs" onClick={() => setAuthorizationPanelOpen((value) => !value)}>
          {authorizationPanelOpen ? "收起理由" : "调整理由"}
        </Button>
      </div>
    )
  }

  function renderList() {
    return (
      <>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">家庭目录</h1>
            <p className="text-sm text-muted-foreground">按家庭边界定位成员与记录问题，私有记录只在详情中显示。</p>
          </div>
          <Button variant="outline" onClick={() => void loadDirectory()} disabled={loading || !loadedReason}>
            <RefreshCwIcon className={loading ? "animate-spin" : undefined} />
            刷新
          </Button>
        </div>

        {loadedReason ? renderAuthorizationStrip() : null}
        {!loadedReason || authorizationPanelOpen ? renderGate() : null}

        <section className="rounded-lg border bg-background">
          <div className="grid gap-3 border-b p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="text-sm font-medium">家庭列表</div>
              <div className="text-xs text-muted-foreground">
                {loadedReason
                  ? `已加载 ${families.length} 个家庭，当前匹配 ${filteredFamilies.length} 个`
                  : "填写治理理由并加载后显示家庭摘要。"}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(220px,320px)_144px_160px]">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索家庭 ID 或创建者"
                  aria-label="搜索家庭"
                />
              </div>
              <Select value={filter} onValueChange={(value) => setFilter(value as FamilyFilter)}>
                <SelectTrigger className="w-full md:w-36" aria-label="筛选家庭">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部家庭</SelectItem>
                  <SelectItem value="with_kids">有孩子</SelectItem>
                  <SelectItem value="with_records">有记录</SelectItem>
                  <SelectItem value="quiet">暂无记录</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(value) => setSort(value as FamilySort)}>
                <SelectTrigger className="w-full md:w-40" aria-label="家庭排序">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_desc">最新创建</SelectItem>
                  <SelectItem value="created_asc">最早创建</SelectItem>
                  <SelectItem value="members_desc">成员最多</SelectItem>
                  <SelectItem value="records_desc">记录最多</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-4">
            {error ? (
              <StatePanel title="家庭目录加载失败" description={error} action={<Button variant="outline" onClick={() => void loadDirectory()}>重试</Button>} />
            ) : !loadedReason ? (
              <StatePanel title="尚未授权读取" description="请输入本次查询目的。授权前不会加载家庭目录、记录或通知。" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">家庭</TableHead>
                      <TableHead>创建者</TableHead>
                      <TableHead>成员 / 孩子</TableHead>
                      <TableHead>记录</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? <LoadingRows /> : null}
                    {!loading && pagedFamilies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <StatePanel title="没有匹配家庭" description="调整搜索词或筛选条件后再试。" />
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {!loading && pagedFamilies.map((family) => (
                      <TableRow key={family.id}>
                        <TableCell className="py-2">
                          <div className="min-w-48">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-sm font-medium" title={family.id}>{shortId(family.id)}</span>
                              <CopyIconButton value={family.id} label="复制家庭 ID" />
                            </div>
                            <div className="text-xs text-muted-foreground">创建于 {formatDate(family.createdAt)}</div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-56 truncate py-2" title={family.createdBy}>
                          {userName(usersById.get(family.createdBy))}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline">{family.memberCount ?? 0} 成员</Badge>
                            <Badge variant="secondary">{family.kidCount ?? 0} 孩子</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">{family.memoryCount ?? 0}</TableCell>
                        <TableCell className="py-2 text-right">
                          {canOpenDetail ? (
                            <Button variant="ghost" size="sm" onClick={() => setSelectedFamilyId(family.id)} aria-label={`查看家庭 ${family.id} 详情`}>
                              <EyeIcon />
                              详情
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">无详情权限</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {loadedReason && !error ? (
            <AdminPagination
              total={filteredFamilies.length}
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
      </>
    )
  }

  function renderDetail(family: FamilyRow) {
    const detail = privateDetail?.familyId === family.id ? privateDetail : null
    const recordAuthors = Array.from(new Set(detail?.memories.map((memory) => memory.userId).filter(Boolean) ?? []))
    const kids = Array.from(new Set(detail?.memories.map((memory) => memory.kidId) ?? []))
    const visibleRecords = detail?.memories.slice(0, 6) ?? []
    const visibleNotifications = detail?.notifications.slice(0, 4) ?? []

    return (
      <>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" className="w-fit" onClick={() => setSelectedFamilyId(null)}>
              <ArrowLeftIcon />
              返回家庭目录
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">家庭详情</h1>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono" title={family.id}>{shortId(family.id)}</span>
                <span className="mx-2">·</span>
                创建于 {formatDate(family.createdAt)}
              </p>
            </div>
          </div>
          <CopyIconButton value={family.id} label="复制家庭 ID" />
        </div>

        <section className="rounded-lg border bg-background p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-medium">家庭概览</h2>
              <p className="mt-1 text-sm text-muted-foreground">家庭摘要来自目录读取，记录和通知只在下方详情区展示。</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm" title={family.id}>{shortId(family.id)}</span>
              <CopyIconButton value={family.id} label="复制家庭 ID" />
            </div>
          </div>

          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border bg-muted/20 p-3">
              <dt className="text-muted-foreground">创建者</dt>
              <dd className="mt-1 truncate font-medium" title={family.createdBy}>{userName(usersById.get(family.createdBy))}</dd>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <dt className="text-muted-foreground">成员 / 孩子</dt>
              <dd className="mt-1 font-medium">{family.memberCount ?? 0} / {family.kidCount ?? 0}</dd>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <dt className="text-muted-foreground">完成记录</dt>
              <dd className="mt-1 font-medium">{family.memoryCount ?? 0}</dd>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <dt className="text-muted-foreground">邀请码</dt>
              <dd className="mt-1 flex items-center gap-1.5">
                <span className="truncate font-medium">{family.inviteCode || "未设置"}</span>
                {family.inviteCode ? <CopyIconButton value={family.inviteCode} label="复制邀请码" /> : null}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border bg-background p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-medium">家庭关联信息</h2>
            <p className="text-sm text-muted-foreground">记录和通知读取使用目录治理理由；每次进入家庭详情都会保留访问记录。</p>
          </div>

          {detailLoading ? (
            <div className="mt-4 grid gap-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : detailError ? (
            <div className="mt-4">
              <StatePanel title="家庭详情加载失败" description={detailError} action={<Button variant="outline" onClick={() => void loadFamilyDetail(family)}>重试</Button>} />
            </div>
          ) : !canOpenDetail ? (
            <div className="mt-4">
              <StatePanel title="没有详情权限" description="当前角色可以查看家庭摘要，但不能读取家庭私有详情。" />
            </div>
          ) : detail ? (
            <Tabs defaultValue="members" className="mt-4 gap-4">
              <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="members">成员</TabsTrigger>
                <TabsTrigger value="kids">孩子</TabsTrigger>
                <TabsTrigger value="records">最近记录</TabsTrigger>
                <TabsTrigger value="notifications">最近通知</TabsTrigger>
                <TabsTrigger value="governance">治理信息</TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="grid gap-2">
                <div className="rounded-md border p-3">
                  <div className="font-medium">{userName(usersById.get(family.createdBy))}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>创建者</span>
                    <span className="font-mono" title={family.createdBy}>{shortId(family.createdBy)}</span>
                    <CopyIconButton value={family.createdBy} label="复制创建者 ID" />
                  </div>
                </div>
                {recordAuthors
                  .filter((userId): userId is string => Boolean(userId) && userId !== family.createdBy)
                  .map((userId) => (
                    <div key={userId} className="rounded-md border p-3">
                      <div className="font-medium">{userName(usersById.get(userId))}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{detail.memories.filter((memory) => memory.userId === userId).length} 条记录</span>
                        <span className="font-mono" title={userId}>{shortId(userId)}</span>
                        <CopyIconButton value={userId} label="复制用户 ID" />
                      </div>
                    </div>
                  ))}
                {recordAuthors.filter((userId) => userId && userId !== family.createdBy).length === 0 ? (
                  <p className="rounded-md border p-3 text-muted-foreground">没有更多可见成员。</p>
                ) : null}
              </TabsContent>

              <TabsContent value="kids" className="grid gap-2">
                {kids.length ? kids.map((kidId) => (
                  <div key={kidId} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono font-medium" title={kidId}>{shortId(kidId)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">可见孩子</div>
                    </div>
                    <Badge variant="outline">{detail.memories.filter((memory) => memory.kidId === kidId).length} 条记录</Badge>
                  </div>
                )) : <p className="rounded-md border p-3 text-muted-foreground">没有可见孩子。</p>}
              </TabsContent>

              <TabsContent value="records" className="grid gap-2">
                {visibleRecords.length ? visibleRecords.map((memory) => (
                  <div key={memory.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{memory.title || memory.levelNum}</div>
                        <div className="mt-1 line-clamp-2 text-muted-foreground">{memory.caption || memory.transcript || "无正文摘要"}</div>
                      </div>
                      <Badge variant="outline">{moderationLabel(memory.moderationStatus)}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {memoryTypeLabel(memory.type)} · {shortId(memory.kidId)} · {formatShortDate(memory.createdAt)}
                    </div>
                  </div>
                )) : <p className="rounded-md border p-3 text-muted-foreground">没有可见记录。</p>}
                <div className="pt-1">
                  <Button asChild variant="ghost" size="sm">
                    <a href="#/records">
                      查看完成记录
                      <ExternalLinkIcon />
                    </a>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="notifications" className="grid gap-2">
                {visibleNotifications.length ? visibleNotifications.map((notification) => (
                  <div key={notification.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{notification.event}</div>
                        <div className="mt-1 text-muted-foreground">
                          尝试 {notification.attempts}/{notification.maxAttempts} · {formatShortDate(notification.createdAt)}
                        </div>
                      </div>
                      <Badge variant="outline">{notificationStatusLabel(notification.status)}</Badge>
                    </div>
                  </div>
                )) : <p className="rounded-md border p-3 text-muted-foreground">没有可见通知。</p>}
                <div className="pt-1">
                  <Button asChild variant="ghost" size="sm">
                    <a href="#/notifications">
                      查看消息任务
                      <ExternalLinkIcon />
                    </a>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="governance" className="grid gap-3">
                <dl className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <dt className="text-muted-foreground">访问记录</dt>
                    <dd className="mt-1 truncate font-medium">{detail.auditEventId ?? "已请求，未返回编号"}</dd>
                  </div>
                  <div className="rounded-md border p-3">
                    <dt className="text-muted-foreground">读取理由</dt>
                    <dd className="mt-1 line-clamp-2 font-medium">{detail.reason}</dd>
                  </div>
                  <div className="rounded-md border p-3">
                    <dt className="text-muted-foreground">家庭 ID</dt>
                    <dd className="mt-1 flex items-center gap-1.5">
                      <span className="truncate font-mono font-medium" title={family.id}>{shortId(family.id)}</span>
                      <CopyIconButton value={family.id} label="复制家庭 ID" />
                    </dd>
                  </div>
                  <div className="rounded-md border p-3">
                    <dt className="text-muted-foreground">创建时间</dt>
                    <dd className="mt-1 font-medium">{formatDate(family.createdAt)}</dd>
                  </div>
                </dl>
                <div>
                  <Button asChild variant="ghost" size="sm">
                    <a href="#/audit">
                      查看操作审计
                      <ExternalLinkIcon />
                    </a>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <StatePanel title="详情未加载" description="返回目录后重新进入，或刷新目录后再试。" />
          )}
        </section>
      </>
    )
  }

  return (
    <main className="admin-page @container/main flex flex-1 flex-col gap-4 md:gap-6">
      {selectedFamily ? renderDetail(selectedFamily) : renderList()}
    </main>
  )
}

export default FamiliesPage
