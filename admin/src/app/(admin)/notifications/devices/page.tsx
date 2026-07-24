import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const PER_PAGE = 30

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; platform?: string; lang?: string; page?: string }>
}) {
  const { q, platform, lang, page: pageStr } = await searchParams
  const currentPage = Math.max(1, Number(pageStr ?? 1))
  const from = (currentPage - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  let query = supabaseAdmin
    .from('push_devices')
    .select('device_id, user_id, platform, lang, tz_offset, updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (platform) query = query.eq('platform', platform)
  if (lang) query = query.eq('lang', lang)

  const { data: devices, count } = await query

  const total = count ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)

  // Fetch profiles for user display
  const userIds = [...new Set((devices ?? []).map((d) => d.user_id))]
  const { data: profiles } = userIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username, generated_email')
        .in('id', userIds)
    : { data: [] as { id: string; username: string | null; generated_email: string | null }[] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  // Filter by search query (username / email)
  let filtered = devices ?? []
  if (q?.trim()) {
    const qLow = q.trim().toLowerCase()
    filtered = filtered.filter((d) => {
      const p = profileMap.get(d.user_id)
      return (
        p?.username?.toLowerCase().includes(qLow) ||
        p?.generated_email?.toLowerCase().includes(qLow) ||
        d.user_id.toLowerCase().includes(qLow)
      )
    })
  }

  // Unique platforms and langs for filter
  const { data: allDevices } = await supabaseAdmin
    .from('push_devices')
    .select('platform, lang')

  const uniquePlatforms = [...new Set((allDevices ?? []).map((d) => d.platform).filter(Boolean))].sort()
  const uniqueLangs = [...new Set((allDevices ?? []).map((d) => d.lang).filter(Boolean))].sort()

  function filterHref(params: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const merged = { q, platform, lang, ...params }
    if (merged.q) p.set('q', merged.q)
    if (merged.platform) p.set('platform', merged.platform)
    if (merged.lang) p.set('lang', merged.lang)
    const qs = p.toString()
    return qs ? `?${qs}` : '?'
  }

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (platform) params.set('platform', platform)
    if (lang) params.set('lang', lang)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">设备列表</h1>
        <span className="text-sm text-muted-foreground">共 {total} 台（当前筛选 {filtered.length}）</span>
      </div>

      {/* 搜索 */}
      <form method="get" className="flex gap-2">
        {platform && <input type="hidden" name="platform" value={platform} />}
        {lang && <input type="hidden" name="lang" value={lang} />}
        <input
          type="text"
          name="q"
          defaultValue={q ?? ''}
          placeholder="搜索用户名或邮箱…"
          className="rounded border px-3 py-1.5 text-sm flex-1 max-w-xs"
        />
        <button type="submit" className="rounded border px-3 py-1.5 text-sm hover:bg-muted">
          搜索
        </button>
        {q && (
          <Link href={filterHref({ q: undefined })} className="text-xs text-muted-foreground self-center hover:underline">
            清除
          </Link>
        )}
      </form>

      {/* 平台/语言筛选 */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-muted-foreground self-center">平台：</span>
        <Link href={filterHref({ platform: undefined, page: undefined })}>
          <Badge variant={!platform ? 'secondary' : 'outline'} className="cursor-pointer">全部</Badge>
        </Link>
        {uniquePlatforms.map((p) => (
          <Link key={p} href={filterHref({ platform: p, page: undefined })}>
            <Badge variant={platform === p ? 'secondary' : 'outline'} className="cursor-pointer">{p}</Badge>
          </Link>
        ))}

        <span className="text-muted-foreground self-center ml-4">语言：</span>
        <Link href={filterHref({ lang: undefined, page: undefined })}>
          <Badge variant={!lang ? 'secondary' : 'outline'} className="cursor-pointer">全部</Badge>
        </Link>
        {uniqueLangs.map((l) => (
          <Link key={l} href={filterHref({ lang: l, page: undefined })}>
            <Badge variant={lang === l ? 'secondary' : 'outline'} className="cursor-pointer">{l}</Badge>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">用户</th>
                  <th className="p-3 font-medium">平台</th>
                  <th className="p-3 font-medium">语言</th>
                  <th className="p-3 font-medium">时区偏移</th>
                  <th className="p-3 font-medium">注册时间</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const profile = profileMap.get(d.user_id)
                  const tzHours = d.tz_offset / 60
                  return (
                    <tr key={d.device_id} className="border-b hover:bg-muted/40 transition-colors">
                      <td className="p-3">
                        <Link href={`/users/${d.user_id}`} className="hover:underline">
                          <div className="font-medium">{profile?.username ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            {profile?.generated_email ?? d.user_id.slice(0, 8)}
                          </div>
                        </Link>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{d.platform ?? '未知'}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary">{d.lang}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        UTC{tzHours >= 0 ? '+' : ''}{tzHours}h
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {new Date(d.updated_at).toLocaleDateString('zh-CN')}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      暂无设备数据
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
