import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FilterBar } from './_components/filter-bar'

const PER_PAGE = 25

const typeLabel: Record<string, string> = {
  photo: '照片',
  video: '视频',
  voice: '语音',
  text: '文字',
}
const perspectiveLabel: Record<string, string> = {
  parent: '父母视角',
  child: '孩子视角',
  together: '共同视角',
}
const modStatusLabel: Record<string, string> = {
  approved: '已通过',
  pending: '待审核',
  flagged: '已标记',
  removed: '已移除',
}
const modStatusVariant: Record<string, 'outline' | 'secondary' | 'destructive' | 'default'> = {
  approved: 'outline',
  pending: 'secondary',
  flagged: 'default',
  removed: 'destructive',
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    type?: string
    perspective?: string
    moderation?: string
    sealed?: string
    dateFrom?: string
    dateTo?: string
    page?: string
  }>
}) {
  const { q, type, perspective, moderation, sealed, dateFrom, dateTo, page: pageStr } =
    await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  // Base query
  let query = supabaseAdmin
    .from('memories')
    .select(
      'id, family_id, kid_id, level_num, title, type, perspective, date, sealed, seal_label, moderation_status, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (type) query = query.eq('type', type)
  if (perspective) query = query.eq('perspective', perspective)
  if (moderation) query = query.eq('moderation_status', moderation)
  if (sealed === 'true') query = query.eq('sealed', true)
  if (sealed === 'false') query = query.eq('sealed', false)
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)

  const { data: memories, count } = await query

  const memList = memories ?? []

  // Fetch family invite codes
  const familyIds = [...new Set(memList.map((m) => m.family_id))]
  const { data: families } = familyIds.length
    ? await supabaseAdmin
        .from('families')
        .select('id, invite_code')
        .in('id', familyIds)
    : { data: [] }
  const familyMap = new Map((families ?? []).map((f) => [f.id, f.invite_code]))

  // Fetch kid names
  const kidIds = [...new Set(memList.map((m) => m.kid_id))]
  const { data: kids } = kidIds.length
    ? await supabaseAdmin.from('kids').select('id, name').in('id', kidIds)
    : { data: [] }
  const kidMap = new Map((kids ?? []).map((k) => [k.id, k.name]))

  // Filter by search query (invite code / title / kid name) - post-filter since Supabase can't
  // do cross-table text search easily in one query
  let filtered = memList
  if (q?.trim()) {
    const ql = q.trim().toLowerCase()
    filtered = memList.filter((m) => {
      const code = familyMap.get(m.family_id) ?? ''
      const kidName = kidMap.get(m.kid_id) ?? ''
      return (
        code.toLowerCase().includes(ql) ||
        kidName.toLowerCase().includes(ql) ||
        m.title.toLowerCase().includes(ql)
      )
    })
  }

  const total = q?.trim() ? filtered.length : (count ?? 0)
  const totalPages = Math.ceil(total / PER_PAGE)
  const rows = q?.trim() ? filtered.slice(0, PER_PAGE) : filtered

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (type) params.set('type', type)
    if (perspective) params.set('perspective', perspective)
    if (moderation) params.set('moderation', moderation)
    if (sealed) params.set('sealed', sealed)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">内容管理</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">共 {total} 条记录</span>
          <Link href="/content/storage">
            <Button variant="outline" size="sm">
              存储概览
            </Button>
          </Link>
        </div>
      </div>

      <FilterBar current={{ q, type, perspective, moderation, sealed, dateFrom, dateTo }} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">标题</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>视角</TableHead>
                <TableHead>孩子</TableHead>
                <TableHead>家庭邀请码</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>封存</TableHead>
                <TableHead>审核状态</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-4 font-medium max-w-48 truncate">{m.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{typeLabel[m.type] ?? m.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {perspectiveLabel[m.perspective] ?? m.perspective}
                  </TableCell>
                  <TableCell className="text-sm">{kidMap.get(m.kid_id) ?? m.kid_id}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono tracking-wider text-xs">
                      {familyMap.get(m.family_id) ?? m.family_id.slice(0, 8)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.date}</TableCell>
                  <TableCell>
                    {m.sealed ? (
                      <Badge variant="secondary">已封存</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={modStatusVariant[m.moderation_status] ?? 'outline'}>
                      {modStatusLabel[m.moderation_status] ?? m.moderation_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/content/${m.id}`}>
                      <Button variant="outline" size="xs">
                        查看详情
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                    暂无记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && !q?.trim() && (
        <div className="flex items-center justify-center gap-2">
          <Link href={pageUrl(page - 1)}>
            <Button variant="outline" size="sm" disabled={page <= 1}>
              上一页
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          <Link href={pageUrl(page + 1)}>
            <Button variant="outline" size="sm" disabled={page >= totalPages}>
              下一页
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
