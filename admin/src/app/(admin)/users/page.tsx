import { supabaseAdmin } from '@/lib/supabase-admin'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Link from 'next/link'
import { SearchBar } from './search-bar'
import { Button } from '@/components/ui/button'

const PER_PAGE = 20

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page } = await searchParams
  const currentPage = Math.max(1, Number(page ?? 1))
  const from = (currentPage - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  let profilesQuery = supabaseAdmin
    .from('profiles')
    .select('id, username, generated_email, role, custom_role, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    profilesQuery = profilesQuery.or(`username.ilike.%${q}%,generated_email.ilike.%${q}%`)
  }

  const { data: profiles, count } = await profilesQuery

  const userIds = profiles?.map((p) => p.id) ?? []

  const [authUsers, membersResult] = await Promise.all([
    Promise.all(
      userIds.map((id) =>
        supabaseAdmin.auth.admin.getUserById(id).then((r) => r.data.user)
      )
    ),
    userIds.length
      ? supabaseAdmin
          .from('family_members')
          .select('user_id, family_id, role, custom_role')
          .in('user_id', userIds)
      : Promise.resolve({ data: [] as { user_id: string; family_id: string; role: string; custom_role: string }[] }),
  ])

  const authUserMap = new Map(
    authUsers.filter(Boolean).map((u) => [u!.id, u!])
  )
  const membershipByUser = new Map(
    (membersResult.data ?? []).map((m) => [m.user_id, m])
  )

  const familyIds = [...new Set((membersResult.data ?? []).map((m) => m.family_id))]
  const { data: families } = familyIds.length
    ? await supabaseAdmin.from('families').select('id, invite_code').in('id', familyIds)
    : { data: [] as { id: string; invite_code: string }[] }

  const familyMap = new Map((families ?? []).map((f) => [f.id, f]))

  const total = count ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">用户管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">共 {total} 名用户</p>
        </div>
        <SearchBar defaultValue={q} />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">用户名</TableHead>
              <TableHead>手机号 / 邮箱</TableHead>
              <TableHead>所属家庭</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead className="pr-4">状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles?.map((p) => {
              const authUser = authUserMap.get(p.id)
              const membership = membershipByUser.get(p.id)
              const family = membership ? familyMap.get(membership.family_id) : null
              const isBanned =
                authUser?.banned_until &&
                new Date(authUser.banned_until) > new Date()
              const initial = (p.username ?? '?').slice(0, 1).toUpperCase()

              return (
                <TableRow key={p.id}>
                  <TableCell className="pl-4">
                    <Link
                      href={`/users/${p.id}`}
                      className="flex items-center gap-2.5 font-medium hover:underline"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                        {initial}
                      </span>
                      {p.username ?? (
                        <span className="text-muted-foreground">未设置</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {authUser?.phone || p.generated_email || authUser?.email || '-'}
                  </TableCell>
                  <TableCell>
                    {family ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {family.invite_code}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {membership
                      ? membership.custom_role || membership.role
                      : p.custom_role || p.role}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {new Date(p.created_at).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell className="pr-4">
                    {isBanned ? (
                      <Badge variant="destructive">已封禁</Badge>
                    ) : (
                      <Badge variant="secondary">正常</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {(!profiles || profiles.length === 0) && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground"
                >
                  {q ? `未找到与"${q}"相关的用户` : '暂无用户'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Link href={pageUrl(currentPage - 1)}>
            <Button variant="outline" size="sm" disabled={currentPage <= 1}>
              上一页
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground">
            第 {currentPage} / {totalPages} 页
          </span>
          <Link href={pageUrl(currentPage + 1)}>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages}>
              下一页
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
