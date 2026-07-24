import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { RetryButton, RetryAllButton } from './_components/retry-buttons'

const PER_PAGE = 30

const STATUS_LABEL: Record<string, string> = {
  pending: '待发送',
  processing: '处理中',
  done: '已完成',
  dead: '死信',
}

const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'destructive'> = {
  pending: 'outline',
  processing: 'outline',
  done: 'secondary',
  dead: 'destructive',
}

export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const { status, page: pageStr } = await searchParams
  const currentPage = Math.max(1, Number(pageStr ?? 1))
  const from = (currentPage - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  let query = supabaseAdmin
    .from('notification_outbox')
    .select(
      'id, event, status, attempts, max_attempts, last_error, created_at, processed_at, family_id',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) query = query.eq('status', status)

  const { data: rows, count } = await query

  const total = count ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)

  // Count dead for bulk retry button
  const { count: deadCount } = await supabaseAdmin
    .from('notification_outbox')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'dead')

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  function statusHref(s: string | undefined) {
    if (!s) return '?'
    return `?status=${encodeURIComponent(s)}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">发件箱管理</h1>
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
      </div>

      {/* 筛选 + 批量重试 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-muted-foreground self-center">状态：</span>
          <Link href="?">
            <Badge variant={!status ? 'secondary' : 'outline'} className="cursor-pointer">全部</Badge>
          </Link>
          {(['pending', 'processing', 'done', 'dead'] as const).map((s) => (
            <Link key={s} href={statusHref(s)}>
              <Badge variant={status === s ? 'secondary' : STATUS_VARIANT[s]} className="cursor-pointer">
                {STATUS_LABEL[s]}
              </Badge>
            </Link>
          ))}
        </div>
        <div className="ml-auto">
          <RetryAllButton count={deadCount ?? 0} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">ID</th>
                  <th className="p-3 font-medium">事件</th>
                  <th className="p-3 font-medium">状态</th>
                  <th className="p-3 font-medium">重试次数</th>
                  <th className="p-3 font-medium">创建时间</th>
                  <th className="p-3 font-medium">处理时间</th>
                  <th className="p-3 font-medium">最后错误</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-3 font-mono text-xs text-muted-foreground">{r.id}</td>
                    <td className="p-3">
                      <Badge variant="outline">{r.event}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-center text-muted-foreground">
                      {r.attempts}/{r.max_attempts}
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {r.processed_at
                        ? new Date(r.processed_at).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="p-3 max-w-[200px] truncate text-xs text-destructive">
                      {r.last_error ?? '—'}
                    </td>
                    <td className="p-3">
                      {r.status === 'dead' && <RetryButton id={r.id} />}
                    </td>
                  </tr>
                ))}
                {(!rows || rows.length === 0) && (
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
