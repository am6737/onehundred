import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FilterBar } from './_components/filter-bar'

const perspectiveLabel: Record<string, string> = {
  parent: '父母视角',
  child: '孩子视角',
  together: '共同视角',
}

function tokenStatus(token: {
  is_active: boolean
  expires_at: string
}): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (!token.is_active) return { label: '已停用', variant: 'destructive' }
  if (new Date(token.expires_at) < new Date()) return { label: '已过期', variant: 'secondary' }
  return { label: '活跃', variant: 'default' }
}

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    expired?: string
    opened?: string
    page?: string
  }>
}) {
  const {
    q = '',
    status = 'all',
    expired = '',
    opened = '',
    page: pageStr = '1',
  } = await searchParams
  const page = Math.max(1, parseInt(pageStr) || 1)
  const pageSize = 20
  const now = new Date().toISOString()

  // Fetch all tokens (admin view)
  const { data: allTokens } = await supabaseAdmin
    .from('invite_tokens')
    .select('id, family_id, created_by, level_title, kid_name, perspective, is_active, expires_at, opened_at, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)

  const tokens = allTokens ?? []

  // Stats
  const statsTotal = tokens.length
  const statsActive = tokens.filter((t) => t.is_active && new Date(t.expires_at) >= new Date()).length
  const statsOpened = tokens.filter((t) => t.opened_at != null).length
  const statsExpired = tokens.filter((t) => new Date(t.expires_at) < new Date()).length

  // Fetch family invite_codes for search and display
  const familyIds = [...new Set(tokens.map((t) => t.family_id))]
  const { data: families } = familyIds.length
    ? await supabaseAdmin
        .from('families')
        .select('id, invite_code')
        .in('id', familyIds)
    : { data: [] }
  const familyMap = new Map((families ?? []).map((f) => [f.id, f]))

  // Fetch creator profiles
  const creatorIds = [...new Set(tokens.map((t) => t.created_by))]
  const { data: profiles } = creatorIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username')
        .in('id', creatorIds)
    : { data: [] }
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  // Fetch memory counts per token
  const tokenIds = tokens.map((t) => t.id)
  const { data: memRows } = tokenIds.length
    ? await supabaseAdmin
        .from('memories')
        .select('invite_token_id')
        .in('invite_token_id', tokenIds)
    : { data: [] }
  const memCount = new Map<string, number>()
  for (const m of memRows ?? []) {
    if (m.invite_token_id)
      memCount.set(m.invite_token_id, (memCount.get(m.invite_token_id) ?? 0) + 1)
  }
  const statsWithMemory = tokens.filter((t) => (memCount.get(t.id) ?? 0) > 0).length

  // Filter
  let filtered = tokens
  if (q.trim()) {
    const qLow = q.trim().toLowerCase()
    filtered = filtered.filter((t) => {
      if (t.id.toLowerCase().includes(qLow)) return true
      const family = familyMap.get(t.family_id)
      if (family?.invite_code?.toLowerCase().includes(qLow)) return true
      return false
    })
  }
  if (status === 'active') filtered = filtered.filter((t) => t.is_active)
  if (status === 'inactive') filtered = filtered.filter((t) => !t.is_active)
  if (expired === '1') filtered = filtered.filter((t) => new Date(t.expires_at) < new Date())
  if (opened === '1') filtered = filtered.filter((t) => t.opened_at != null)

  const total = filtered.length
  const totalPages = Math.ceil(total / pageSize)
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize)

  function pageHref(p: number) {
    return `/invites?q=${encodeURIComponent(q)}&status=${status}&expired=${expired}&opened=${opened}&page=${p}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">邀请管理</h1>
        <span className="text-sm text-muted-foreground">共 {total} 条（过滤后）</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm text-muted-foreground">总创建</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{statsTotal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm text-muted-foreground">活跃</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-green-600">{statsActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm text-muted-foreground">已打开</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{statsOpened}</div>
            <div className="text-xs text-muted-foreground">
              打开率 {statsTotal ? Math.round((statsOpened / statsTotal) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm text-muted-foreground">已过期</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-muted-foreground">{statsExpired}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm text-muted-foreground">完成率</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {statsTotal ? Math.round((statsWithMemory / statsTotal) * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground">{statsWithMemory} 个有回忆</div>
          </CardContent>
        </Card>
      </div>

      <FilterBar defaults={{ q, status, expired, opened }} />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">令牌 ID</th>
                  <th className="p-3 font-medium">创建者</th>
                  <th className="p-3 font-medium">目标活动</th>
                  <th className="p-3 font-medium">孩子</th>
                  <th className="p-3 font-medium">视角</th>
                  <th className="p-3 font-medium">状态</th>
                  <th className="p-3 font-medium">创建时间</th>
                  <th className="p-3 font-medium">过期时间</th>
                  <th className="p-3 font-medium">已打开</th>
                  <th className="p-3 font-medium">回忆数</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((token) => {
                  const family = familyMap.get(token.family_id)
                  const creator = profileMap.get(token.created_by)
                  const { label: statusLabel, variant: statusVariant } = tokenStatus(token)
                  return (
                    <tr key={token.id} className="border-b hover:bg-muted/40 transition-colors">
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {token.id.slice(0, 10)}…
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{creator?.username ?? '—'}</div>
                        {family && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {family.invite_code}
                          </div>
                        )}
                      </td>
                      <td className="p-3 max-w-36 truncate">{token.level_title}</td>
                      <td className="p-3">{token.kid_name ?? '—'}</td>
                      <td className="p-3 text-muted-foreground">
                        {perspectiveLabel[token.perspective] ?? token.perspective}
                      </td>
                      <td className="p-3">
                        <Badge variant={statusVariant}>{statusLabel}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(token.created_at).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(token.expires_at).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="p-3">
                        {token.opened_at ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">{memCount.get(token.id) ?? 0}</td>
                      <td className="p-3">
                        <Link href={`/invites/${token.id}`}>
                          <Button variant="outline" size="xs">
                            详情
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-muted-foreground">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)}>
              <Button variant="outline" size="sm">
                上一页
              </Button>
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          {page < totalPages && (
            <Link href={pageHref(page + 1)}>
              <Button variant="outline" size="sm">
                下一页
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
