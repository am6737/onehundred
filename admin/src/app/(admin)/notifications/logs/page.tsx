import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const PER_PAGE = 30

export default async function NotificationLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    family_id?: string
    kid_id?: string
    scene?: string
    date_from?: string
    date_to?: string
    page?: string
  }>
}) {
  const { family_id, kid_id, scene, date_from, date_to, page: pageStr } = await searchParams
  const currentPage = Math.max(1, Number(pageStr ?? 1))
  const from = (currentPage - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  let query = supabaseAdmin
    .from('notification_log')
    .select('id, kid_id, family_id, scene, sent_at, clicked, clicked_at', { count: 'exact' })
    .order('sent_at', { ascending: false })
    .range(from, to)

  if (family_id) query = query.eq('family_id', family_id)
  if (kid_id) query = query.eq('kid_id', kid_id)
  if (scene) query = query.eq('scene', scene)
  if (date_from) query = query.gte('sent_at', date_from)
  if (date_to) query = query.lte('sent_at', date_to + 'T23:59:59Z')

  const { data: logs, count } = await query

  const total = count ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)

  // Fetch kid names and family invite codes for display
  const kidIds = [...new Set((logs ?? []).map((l) => l.kid_id))]
  const familyIds = [...new Set((logs ?? []).map((l) => l.family_id))]

  const [kidsRes, familiesRes] = await Promise.all([
    kidIds.length
      ? supabaseAdmin.from('kids').select('id, name').in('id', kidIds)
      : { data: [] as { id: string; name: string }[] },
    familyIds.length
      ? supabaseAdmin.from('families').select('id, invite_code').in('id', familyIds)
      : { data: [] as { id: string; invite_code: string }[] },
  ])

  const kidMap = new Map((kidsRes.data ?? []).map((k) => [k.id, k.name]))
  const familyMap = new Map((familiesRes.data ?? []).map((f) => [f.id, f.invite_code]))

  // Unique scenes for filter
  const { data: allScenes } = await supabaseAdmin
    .from('notification_log')
    .select('scene')

  const uniqueScenes = [...new Set((allScenes ?? []).map((r) => r.scene))].sort()

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (family_id) params.set('family_id', family_id)
    if (kid_id) params.set('kid_id', kid_id)
    if (scene) params.set('scene', scene)
    if (date_from) params.set('date_from', date_from)
    if (date_to) params.set('date_to', date_to)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  function sceneFilterHref(s: string | undefined) {
    const params = new URLSearchParams()
    if (family_id) params.set('family_id', family_id)
    if (kid_id) params.set('kid_id', kid_id)
    if (s) params.set('scene', s)
    if (date_from) params.set('date_from', date_from)
    if (date_to) params.set('date_to', date_to)
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">投递日志</h1>
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="py-3 space-y-3">
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="text-muted-foreground">场景：</span>
            <Link href={sceneFilterHref(undefined)}>
              <Badge variant={!scene ? 'secondary' : 'outline'} className="cursor-pointer">全部</Badge>
            </Link>
            {uniqueScenes.map((s) => (
              <Link key={s} href={sceneFilterHref(s)}>
                <Badge variant={scene === s ? 'secondary' : 'outline'} className="cursor-pointer">{s}</Badge>
              </Link>
            ))}
          </div>

          <form className="flex flex-wrap gap-2 items-center text-sm" method="get">
            {family_id && <input type="hidden" name="family_id" value={family_id} />}
            {kid_id && <input type="hidden" name="kid_id" value={kid_id} />}
            {scene && <input type="hidden" name="scene" value={scene} />}
            <label className="flex items-center gap-1 text-muted-foreground">
              开始日期
              <input
                type="date"
                name="date_from"
                defaultValue={date_from ?? ''}
                className="ml-1 rounded border px-2 py-1 text-sm"
              />
            </label>
            <label className="flex items-center gap-1 text-muted-foreground">
              结束日期
              <input
                type="date"
                name="date_to"
                defaultValue={date_to ?? ''}
                className="ml-1 rounded border px-2 py-1 text-sm"
              />
            </label>
            <button type="submit" className="rounded border px-3 py-1 text-sm hover:bg-muted">
              筛选
            </button>
            {(date_from || date_to) && (
              <Link href={sceneFilterHref(scene)} className="text-xs text-muted-foreground hover:underline">
                清除日期
              </Link>
            )}
          </form>

          {(family_id || kid_id) && (
            <div className="flex gap-2 flex-wrap text-xs">
              {family_id && (
                <Badge variant="outline">
                  家庭: {familyMap.get(family_id) ?? family_id.slice(0, 8)}
                  <Link href={sceneFilterHref(scene)} className="ml-1 text-muted-foreground hover:text-foreground">×</Link>
                </Badge>
              )}
              {kid_id && (
                <Badge variant="outline">
                  孩子: {kidMap.get(kid_id) ?? kid_id}
                  <Link href="?" className="ml-1 text-muted-foreground hover:text-foreground">×</Link>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">发送时间</th>
                  <th className="p-3 font-medium">场景</th>
                  <th className="p-3 font-medium">孩子</th>
                  <th className="p-3 font-medium">家庭</th>
                  <th className="p-3 font-medium">已点击</th>
                </tr>
              </thead>
              <tbody>
                {(logs ?? []).map((log) => (
                  <tr key={log.id} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {new Date(log.sent_at).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{log.scene}</Badge>
                    </td>
                    <td className="p-3">
                      {kidMap.get(log.kid_id) ? (
                        <span>{kidMap.get(log.kid_id)}</span>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">{log.kid_id}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/families/${log.family_id}`}
                        className="hover:underline text-xs font-mono text-muted-foreground"
                      >
                        {familyMap.get(log.family_id) ?? log.family_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="p-3">
                      {log.clicked ? (
                        <div>
                          <Badge variant="secondary">已点击</Badge>
                          {log.clicked_at && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {new Date(log.clicked_at).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">未点击</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!logs || logs.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      暂无记录
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
          {currentPage > 1 && (
            <Link href={pageHref(currentPage - 1)}>
              <span className="text-sm underline cursor-pointer">上一页</span>
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            第 {currentPage} / {totalPages} 页
          </span>
          {currentPage < totalPages && (
            <Link href={pageHref(currentPage + 1)}>
              <span className="text-sm underline cursor-pointer">下一页</span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
