import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { FilterBar } from './filter-bar'

const PER_PAGE = 30

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; target_type?: string; admin?: string; page?: string }>
}) {
  const { action, target_type, admin, page } = await searchParams
  const currentPage = Math.max(1, Number(page ?? 1))
  const from = (currentPage - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  let query = supabaseAdmin
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (action) query = query.eq('action', action)
  if (target_type) query = query.eq('target_type', target_type)
  if (admin) query = query.eq('admin_user_id', admin)

  const [{ data: logs, count }, distinctResult] = await Promise.all([
    query,
    supabaseAdmin
      .from('admin_audit_log')
      .select('action, target_type, admin_user_id'),
  ])

  const allRows = distinctResult.data ?? []
  const uniqueActions = [...new Set(allRows.map((r) => r.action))].sort()
  const uniqueTargetTypes = [...new Set(allRows.map((r) => r.target_type))].sort()
  const uniqueAdminIds = [...new Set(allRows.map((r) => r.admin_user_id))]

  const { data: adminProfiles } = uniqueAdminIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username')
        .in('id', uniqueAdminIds)
    : { data: [] as { id: string; username: string | null }[] }

  const profileMap = new Map(
    (adminProfiles ?? []).map((p) => [p.id, p.username])
  )

  const total = count ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (action) params.set('action', action)
    if (target_type) params.set('target_type', target_type)
    if (admin) params.set('admin', admin)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">操作日志</h1>
        <span className="text-sm text-muted-foreground">共 {total} 条记录</span>
      </div>

      <FilterBar
        actions={uniqueActions}
        targetTypes={uniqueTargetTypes}
        admins={(adminProfiles ?? []).map((p) => ({ id: p.id, username: p.username }))}
        current={{ action, target_type, admin }}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">时间</TableHead>
                <TableHead>管理员</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>目标类型</TableHead>
                <TableHead>目标 ID</TableHead>
                <TableHead>详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="pl-4 whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(log.created_at).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {profileMap.get(log.admin_user_id) ?? log.admin_user_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.target_type}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground max-w-32 truncate">
                    {log.target_id}
                  </TableCell>
                  <TableCell className="text-sm max-w-64">
                    {log.details && Object.keys(log.details).length > 0 ? (
                      <details>
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          展开
                        </summary>
                        <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!logs || logs.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-muted-foreground"
                  >
                    暂无操作日志
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
