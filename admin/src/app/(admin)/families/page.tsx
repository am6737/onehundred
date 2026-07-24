import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchBar } from './_components/search-bar'

export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; order?: string; page?: string }>
}) {
  const { q = '', sort = 'created_at', order = 'desc', page: pageStr = '1' } =
    await searchParams
  const page = Math.max(1, parseInt(pageStr) || 1)
  const pageSize = 20

  // Fetch all families (admin view, max 1000)
  const { data: allFamilies } = await supabaseAdmin
    .from('families')
    .select('id, invite_code, created_at, created_by')
    .order('created_at', { ascending: false })
    .limit(1000)

  const allIds = allFamilies?.map((f) => f.id) ?? []

  // Fetch creator profiles
  const creatorIds = [...new Set(allFamilies?.map((f) => f.created_by) ?? [])]
  const { data: creatorProfiles } = creatorIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username, generated_email')
        .in('id', creatorIds)
    : { data: [] }

  const creatorMap = new Map(creatorProfiles?.map((p) => [p.id, p]) ?? [])

  // Filter by search query
  let filtered = allFamilies ?? []
  if (q.trim()) {
    const qLow = q.trim().toLowerCase()
    filtered = filtered.filter((f) => {
      if (f.invite_code.toLowerCase().includes(qLow)) return true
      const c = creatorMap.get(f.created_by)
      if (c?.generated_email?.toLowerCase().includes(qLow)) return true
      if (c?.username?.toLowerCase().includes(qLow)) return true
      return false
    })
  }

  const filteredIds = filtered.map((f) => f.id)

  // Fetch counts
  const [memberRows, kidRows, memoryRows] = await Promise.all([
    filteredIds.length
      ? supabaseAdmin.from('family_members').select('family_id').in('family_id', filteredIds)
      : { data: [] },
    filteredIds.length
      ? supabaseAdmin.from('kids').select('family_id').in('family_id', filteredIds)
      : { data: [] },
    filteredIds.length
      ? supabaseAdmin.from('memories').select('family_id').in('family_id', filteredIds)
      : { data: [] },
  ])

  const memberCount = new Map<string, number>()
  for (const m of memberRows.data ?? [])
    memberCount.set(m.family_id, (memberCount.get(m.family_id) ?? 0) + 1)

  const kidCount = new Map<string, number>()
  for (const k of kidRows.data ?? [])
    kidCount.set(k.family_id, (kidCount.get(k.family_id) ?? 0) + 1)

  const memoryCount = new Map<string, number>()
  for (const m of memoryRows.data ?? [])
    memoryCount.set(m.family_id, (memoryCount.get(m.family_id) ?? 0) + 1)

  // Sort
  const asc = order === 'asc' ? 1 : -1
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'member_count')
      return ((memberCount.get(a.id) ?? 0) - (memberCount.get(b.id) ?? 0)) * asc
    if (sort === 'memory_count')
      return ((memoryCount.get(a.id) ?? 0) - (memoryCount.get(b.id) ?? 0)) * asc
    return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * asc
  })

  const total = sorted.length
  const totalPages = Math.ceil(total / pageSize)
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)

  function sortHref(col: string) {
    const newOrder = sort === col && order === 'desc' ? 'asc' : 'desc'
    return `/families?sort=${col}&order=${newOrder}&q=${encodeURIComponent(q)}&page=1`
  }

  function sortIcon(col: string) {
    if (sort !== col) return ' ↕'
    return order === 'asc' ? ' ↑' : ' ↓'
  }

  function pageHref(p: number) {
    return `/families?q=${encodeURIComponent(q)}&sort=${sort}&order=${order}&page=${p}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">家庭管理</h1>
        <span className="text-sm text-muted-foreground">共 {total} 个家庭</span>
      </div>

      <SearchBar defaultValue={q} />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">家庭 ID</th>
                  <th className="p-3 font-medium">邀请码</th>
                  <th className="p-3 font-medium">创建者</th>
                  <th className="p-3 font-medium">
                    <Link href={sortHref('member_count')} className="hover:text-foreground">
                      成员数{sortIcon('member_count')}
                    </Link>
                  </th>
                  <th className="p-3 font-medium">孩子数</th>
                  <th className="p-3 font-medium">
                    <Link href={sortHref('memory_count')} className="hover:text-foreground">
                      记录数{sortIcon('memory_count')}
                    </Link>
                  </th>
                  <th className="p-3 font-medium">
                    <Link href={sortHref('created_at')} className="hover:text-foreground">
                      创建时间{sortIcon('created_at')}
                    </Link>
                  </th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => {
                  const creator = creatorMap.get(f.created_by)
                  return (
                    <tr key={f.id} className="border-b hover:bg-muted/40 transition-colors">
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {f.id.slice(0, 8)}…
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="font-mono tracking-wider">
                          {f.invite_code}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{creator?.username ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {creator?.generated_email ?? '—'}
                        </div>
                      </td>
                      <td className="p-3">{memberCount.get(f.id) ?? 0}</td>
                      <td className="p-3">{kidCount.get(f.id) ?? 0}</td>
                      <td className="p-3">{memoryCount.get(f.id) ?? 0}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(f.created_at).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="p-3">
                        <Link href={`/families/${f.id}`}>
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
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
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
