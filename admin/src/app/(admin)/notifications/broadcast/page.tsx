import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BroadcastForm } from './_components/broadcast-form'

async function getBroadcastHistory() {
  const { data } = await supabaseAdmin
    .from('admin_audit_log')
    .select('id, created_at, details')
    .eq('action', 'broadcast_push')
    .order('created_at', { ascending: false })
    .limit(20)
  return data ?? []
}

export default async function BroadcastPage() {
  const history = await getBroadcastHistory()

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">全局推送</h1>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">发送系统公告</CardTitle>
        </CardHeader>
        <CardContent>
          <BroadcastForm />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-muted-foreground">发送历史（最近 20 条）</h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">时间</th>
                    <th className="p-3 font-medium">标题</th>
                    <th className="p-3 font-medium">正文</th>
                    <th className="p-3 font-medium">平台</th>
                    <th className="p-3 font-medium">语言</th>
                    <th className="p-3 font-medium">发送</th>
                    <th className="p-3 font-medium">失败</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => {
                    const d = (row.details ?? {}) as Record<string, unknown>
                    return (
                      <tr key={row.id} className="border-b hover:bg-muted/40 transition-colors">
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3 max-w-[180px] truncate font-medium">
                          {String(d.title ?? '—')}
                        </td>
                        <td className="p-3 max-w-[240px] truncate text-muted-foreground">
                          {String(d.body ?? '—')}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">
                            {String(d.platform ?? 'all') === 'all' ? '全部' : String(d.platform)}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">
                            {String(d.lang ?? 'all') === 'all' ? '全部' : String(d.lang)}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="secondary">{String(d.sent ?? 0)}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          {Number(d.failed ?? 0) > 0 ? (
                            <Badge variant="destructive">{String(d.failed)}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        暂无发送记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
