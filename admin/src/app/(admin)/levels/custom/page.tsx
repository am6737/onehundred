import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { illustrationUrl } from '@/lib/illustration'

const SUGGEST_LABELS: Record<string, string> = {
  photo: '拍照',
  voice: '录音',
  video: '视频',
  text: '文字',
}

const TONE_COLORS: Record<string, string> = {
  orange: '#f97316',
  green: '#22c55e',
  pink: '#ec4899',
}

export default async function CustomLevelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; view?: string }>
}) {
  const { q = '', page: pageStr = '1', view: viewParam = 'list' } = await searchParams
  const view = viewParam === 'agg' ? 'agg' : viewParam === 'grid' ? 'grid' : 'list'
  const page = Math.max(1, parseInt(pageStr) || 1)
  const pageSize = view === 'grid' ? 24 : 20

  const { data: allRows } = await supabaseAdmin
    .from('custom_levels')
    .select('id, family_id, num, title, why, suggest, perspective, tone, illustration_path, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)

  const rows = allRows ?? []

  // Filter by search
  const filtered = q.trim()
    ? rows.filter((r) => {
        const ql = q.toLowerCase()
        return (
          r.title.toLowerCase().includes(ql) ||
          r.family_id.toLowerCase().includes(ql) ||
          r.num.toLowerCase().includes(ql)
        )
      })
    : rows

  // Aggregate by title
  const titleAgg = new Map<string, { count: number; suggest: string; familyIds: Set<string> }>()
  for (const r of rows) {
    const key = r.title.trim()
    if (!titleAgg.has(key)) titleAgg.set(key, { count: 0, suggest: r.suggest, familyIds: new Set() })
    const entry = titleAgg.get(key)!
    entry.count++
    entry.familyIds.add(r.family_id)
  }
  const aggSorted = [...titleAgg.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 50)

  // Paginate list view
  const total = filtered.length
  const totalPages = Math.ceil(total / pageSize)
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  function pageHref(p: number) {
    return `/levels/custom?q=${encodeURIComponent(q)}&page=${p}&view=${view}`
  }

  function viewHref(v: string) {
    return `/levels/custom?q=${encodeURIComponent(q)}&page=1&view=${v}`
  }

  function searchHref(newQ: string) {
    return `/levels/custom?q=${encodeURIComponent(newQ)}&page=1&view=${view}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">自定义活动</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {rows.length} 条，跨 {new Set(rows.map((r) => r.family_id)).size} 个家庭
          </p>
        </div>
        <Link href="/levels" className="text-sm text-muted-foreground hover:text-foreground">
          ← 内置活动
        </Link>
      </div>

      {/* Search + View toggle */}
      <div className="flex items-center gap-3">
        <form action="/levels/custom" method="get" className="flex-1 max-w-sm flex gap-2">
          <input type="hidden" name="view" value={view} />
          <input
            name="q"
            defaultValue={q}
            placeholder="搜索标题、家庭 ID…"
            className="flex-1 h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors"
          />
          <Button type="submit" size="sm">搜索</Button>
          {q && (
            <Link href={searchHref('')}>
              <Button type="button" variant="outline" size="sm">清除</Button>
            </Link>
          )}
        </form>
        <div className="flex items-center gap-1">
          <Link href={viewHref('list')}>
            <Button variant={view === 'list' ? 'secondary' : 'outline'} size="sm">明细</Button>
          </Link>
          <Link href={viewHref('grid')}>
            <Button variant={view === 'grid' ? 'secondary' : 'outline'} size="sm">网格</Button>
          </Link>
          <Link href={viewHref('agg')}>
            <Button variant={view === 'agg' ? 'secondary' : 'outline'} size="sm">聚合统计</Button>
          </Link>
        </div>
      </div>

      {view === 'agg' ? (
        /* Aggregated view */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">排名</th>
                    <th className="p-3 font-medium">自定义活动标题</th>
                    <th className="p-3 font-medium">出现次数</th>
                    <th className="p-3 font-medium">涉及家庭数</th>
                    <th className="p-3 font-medium">常用类型</th>
                  </tr>
                </thead>
                <tbody>
                  {aggSorted.map(([title, info], i) => (
                    <tr key={title} className="border-b hover:bg-muted/40 transition-colors">
                      <td className="p-3 text-muted-foreground">#{i + 1}</td>
                      <td className="p-3 font-medium">{title}</td>
                      <td className="p-3">{info.count}</td>
                      <td className="p-3">{info.familyIds.size}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {SUGGEST_LABELS[info.suggest] ?? info.suggest}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {aggSorted.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">暂无数据</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* List / Grid view */
        <>
          {view === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {pageRows.map((r) => {
                const url = illustrationUrl(r.illustration_path)
                const toneColor = TONE_COLORS[r.tone] ?? r.tone
                return (
                  <div
                    key={r.id}
                    className="flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] bg-muted">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={r.title} className="h-full w-full object-cover" />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{ backgroundColor: `${toneColor}22` }}
                        >
                          <span className="text-2xl font-bold" style={{ color: toneColor }}>
                            {r.title.slice(0, 1)}
                          </span>
                        </div>
                      )}
                      <Badge className="absolute left-2 top-2 font-mono" variant="secondary">
                        {r.num}
                      </Badge>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium" title={r.title}>
                            {r.title}
                          </div>
                          {r.why && (
                            <div
                              className="mt-0.5 truncate text-xs text-muted-foreground"
                              title={r.why}
                            >
                              {r.why}
                            </div>
                          )}
                        </div>
                        <div
                          className="mt-1 size-3.5 flex-shrink-0 rounded-full border"
                          style={{ backgroundColor: toneColor }}
                        />
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <Link
                          href={`/families/${r.family_id}`}
                          className="font-mono text-xs text-muted-foreground hover:text-foreground"
                        >
                          {r.family_id.slice(0, 8)}…
                        </Link>
                        <Badge variant="outline" className="text-xs">
                          {SUGGEST_LABELS[r.suggest] ?? r.suggest}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )
              })}
              {pageRows.length === 0 && (
                <div className="col-span-full p-8 text-center text-muted-foreground">
                  {q ? `未找到「${q}」相关结果` : '暂无数据'}
                </div>
              )}
            </div>
          ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3 font-medium">家庭 ID</th>
                      <th className="p-3 font-medium">编号</th>
                      <th className="p-3 font-medium">标题</th>
                      <th className="p-3 font-medium">描述</th>
                      <th className="p-3 font-medium">类型</th>
                      <th className="p-3 font-medium">创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/40 transition-colors">
                        <td className="p-3">
                          <Link
                            href={`/families/${r.family_id}`}
                            className="font-mono text-xs text-muted-foreground hover:text-foreground"
                          >
                            {r.family_id.slice(0, 8)}…
                          </Link>
                        </td>
                        <td className="p-3 font-mono text-xs">{r.num}</td>
                        <td className="p-3 font-medium max-w-[200px] truncate">{r.title}</td>
                        <td className="p-3 text-muted-foreground max-w-xs">
                          <span className="truncate block" title={r.why ?? ''}>
                            {r.why ? (r.why.slice(0, 60) + (r.why.length > 60 ? '…' : '')) : '—'}
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">
                            {SUGGEST_LABELS[r.suggest] ?? r.suggest}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {new Date(r.created_at).toLocaleDateString('zh-CN')}
                        </td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          {q ? `未找到「${q}」相关结果` : '暂无数据'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {page > 1 && (
                <Link href={pageHref(page - 1)}>
                  <Button variant="outline" size="sm">上一页</Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                第 {page} / {totalPages} 页，共 {total} 条
              </span>
              {page < totalPages && (
                <Link href={pageHref(page + 1)}>
                  <Button variant="outline" size="sm">下一页</Button>
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
