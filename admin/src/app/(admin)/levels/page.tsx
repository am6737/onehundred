import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { illustrationUrl } from '@/lib/illustration'
import { EditLevelButton, CreateLevelButton, type LevelRow } from './_components/level-sheet'
import { IllustrationLightbox } from './_components/illustration-lightbox'

const TONE_COLORS: Record<string, string> = {
  orange: '#f97316',
  green: '#22c55e',
  pink: '#ec4899',
}

const SUGGEST_LABELS: Record<string, string> = {
  photo: '拍照',
  voice: '录音',
  video: '视频',
  text: '文字',
}

const PERSPECTIVE_LABELS: Record<string, string> = {
  parent: '家长',
  child: '孩子',
  together: '一起',
}

export default async function LevelsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; order?: string; view?: string }>
}) {
  const { sort = 'sort_order', order = 'asc', view: viewParam } = await searchParams
  const view = viewParam === 'grid' ? 'grid' : 'table'

  const [levelsResult, memResult, familyCountResult] = await Promise.all([
    supabaseAdmin
      .from('levels')
      .select('num, title, why, suggest, tone, sort_order, illustration_path, perspective, sealed, seasonal')
      .order('sort_order', { ascending: true })
      .limit(500),
    supabaseAdmin.from('memories').select('level_num, family_id'),
    supabaseAdmin.from('families').select('id', { count: 'exact', head: true }),
  ])

  const levels = levelsResult.data ?? []
  const totalFamilies = familyCountResult.count ?? 0

  // Compute distinct families per level_num
  const familiesPerLevel = new Map<string, Set<string>>()
  for (const m of memResult.data ?? []) {
    if (!familiesPerLevel.has(m.level_num)) familiesPerLevel.set(m.level_num, new Set())
    familiesPerLevel.get(m.level_num)!.add(m.family_id)
  }

  const doneCount = (num: string) => familiesPerLevel.get(num)?.size ?? 0
  const completionRate = (num: string) =>
    totalFamilies > 0 ? ((doneCount(num) / totalFamilies) * 100).toFixed(1) : '0.0'

  // Sort
  const asc = order === 'asc' ? 1 : -1
  const sorted = [...levels].sort((a, b) => {
    if (sort === 'completion') {
      return (doneCount(a.num) - doneCount(b.num)) * asc
    }
    if (sort === 'title') {
      return a.title.localeCompare(b.title, 'zh-CN') * asc
    }
    return (a.sort_order - b.sort_order) * asc
  })

  const maxSortOrder = levels.reduce((m, l) => Math.max(m, l.sort_order), 0)
  const maxNum = levels
    .map((l) => parseInt(l.num, 10))
    .filter((n) => !isNaN(n))
    .reduce((m, n) => Math.max(m, n), 0)
  const nextNum = String(maxNum + 1).padStart(2, '0')

  function buildHref(overrides: Record<string, string>) {
    const params = new URLSearchParams({ sort, order, view, ...overrides })
    return `/levels?${params.toString()}`
  }

  function sortHref(col: string) {
    const newOrder = sort === col && order === 'desc' ? 'asc' : 'desc'
    return buildHref({ sort: col, order: newOrder })
  }

  function sortIcon(col: string) {
    if (sort !== col) return ' ↕'
    return order === 'asc' ? ' ↑' : ' ↓'
  }

  const editProps = (l: (typeof levels)[number]): LevelRow => ({
    num: l.num,
    title: l.title,
    why: l.why ?? '',
    suggest: l.suggest,
    tone: l.tone,
    sort_order: l.sort_order,
    illustration_path: l.illustration_path,
    perspective: l.perspective,
    sealed: l.sealed,
    seasonal: l.seasonal,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">内置活动</h1>
          <p className="text-sm text-muted-foreground mt-0.5">共 {levels.length} 项，{totalFamilies} 个家庭</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/levels/custom" className="text-sm text-muted-foreground hover:text-foreground">
            查看自定义活动 →
          </Link>
          <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
            <Link
              href={buildHref({ view: 'table' })}
              className={cn(
                'rounded-md px-2.5 py-1 text-sm transition-colors',
                view === 'table' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              表格
            </Link>
            <Link
              href={buildHref({ view: 'grid' })}
              className={cn(
                'rounded-md px-2.5 py-1 text-sm transition-colors',
                view === 'grid' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              网格
            </Link>
          </div>
          <CreateLevelButton nextNum={nextNum} nextSortOrder={maxSortOrder + 1} />
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((l) => {
            const done = doneCount(l.num)
            const rate = completionRate(l.num)
            const url = illustrationUrl(l.illustration_path)
            const toneColor = TONE_COLORS[l.tone] ?? l.tone
            return (
              <div
                key={l.num}
                className="flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {url ? (
                    <IllustrationLightbox url={url} title={l.title}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={l.title} className="h-full w-full object-cover" />
                    </IllustrationLightbox>
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ backgroundColor: `${toneColor}22` }}
                    >
                      <span className="text-2xl font-bold" style={{ color: toneColor }}>
                        {l.title.slice(0, 1)}
                      </span>
                    </div>
                  )}
                  <Badge className="absolute left-2 top-2 font-mono" variant="secondary">
                    {l.num}
                  </Badge>
                  <div className="absolute right-2 top-2 flex gap-1">
                    {l.sealed && (
                      <Badge variant="secondary" className="bg-background/80 text-xs">封存</Badge>
                    )}
                    {l.seasonal && (
                      <Badge variant="outline" className="bg-background/80 text-xs">季节</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{l.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {PERSPECTIVE_LABELS[l.perspective] ?? l.perspective} ·{' '}
                        {SUGGEST_LABELS[l.suggest] ?? l.suggest}
                      </div>
                    </div>
                    <div
                      className="mt-1 size-3.5 flex-shrink-0 rounded-full border"
                      style={{ backgroundColor: toneColor }}
                    />
                  </div>
                  <div className="mt-auto flex items-center gap-1.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(parseFloat(rate), 100)}%` }}
                      />
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {done}/{totalFamilies}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <EditLevelButton level={editProps(l)} />
                  </div>
                </div>
              </div>
            )
          })}
          {sorted.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground">暂无数据</div>
          )}
        </div>
      ) : (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">
                    <Link href={sortHref('sort_order')} className="hover:text-foreground">
                      排序{sortIcon('sort_order')}
                    </Link>
                  </th>
                  <th className="p-3 font-medium">编号</th>
                  <th className="p-3 font-medium">
                    <Link href={sortHref('title')} className="hover:text-foreground">
                      标题{sortIcon('title')}
                    </Link>
                  </th>
                  <th className="p-3 font-medium">视角</th>
                  <th className="p-3 font-medium">建议方式</th>
                  <th className="p-3 font-medium">配色</th>
                  <th className="p-3 font-medium">标签</th>
                  <th className="p-3 font-medium">
                    <Link href={sortHref('completion')} className="hover:text-foreground">
                      完成率{sortIcon('completion')}
                    </Link>
                  </th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((l) => {
                  const done = doneCount(l.num)
                  const rate = completionRate(l.num)
                  return (
                    <tr key={l.num} className="border-b hover:bg-muted/40 transition-colors">
                      <td className="p-3 text-muted-foreground text-xs">{l.sort_order}</td>
                      <td className="p-3 font-mono font-medium">{l.num}</td>
                      <td className="p-3 max-w-xs">
                        <div className="font-medium truncate">{l.title}</div>
                        {l.why && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {l.why.slice(0, 50)}{l.why.length > 50 ? '…' : ''}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {PERSPECTIVE_LABELS[l.perspective] ?? l.perspective}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {SUGGEST_LABELS[l.suggest] ?? l.suggest}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="size-3.5 rounded-full flex-shrink-0 border"
                            style={{ backgroundColor: TONE_COLORS[l.tone] ?? l.tone }}
                          />
                          <span className="text-xs text-muted-foreground">{l.tone}</span>
                        </div>
                      </td>
                      <td className="p-3 space-x-1">
                        {l.sealed && <Badge variant="secondary" className="text-xs">封存</Badge>}
                        {l.seasonal && <Badge variant="outline" className="text-xs">季节</Badge>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(parseFloat(rate), 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {done}/{totalFamilies} ({rate}%)
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <EditLevelButton level={editProps(l)} />
                      </td>
                    </tr>
                  )
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
