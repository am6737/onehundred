import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

async function getOutboxStats() {
  const { data } = await supabaseAdmin
    .from('notification_outbox')
    .select('status, processed_at')

  const rows = data ?? []
  const counts = { pending: 0, processing: 0, done: 0, dead: 0 }
  let delivered24h = 0
  const cutoff = Date.now() - 24 * 60 * 60 * 1000

  for (const r of rows) {
    if (r.status in counts) counts[r.status as keyof typeof counts]++
    if (r.status === 'done' && r.processed_at && new Date(r.processed_at).getTime() > cutoff) {
      delivered24h++
    }
  }

  return { counts, delivered24h }
}

async function getDeviceStats() {
  const { data } = await supabaseAdmin
    .from('push_devices')
    .select('platform, lang')

  const rows = data ?? []
  const byPlatform: Record<string, number> = {}
  const byLang: Record<string, number> = {}

  for (const r of rows) {
    const p = r.platform ?? 'unknown'
    byPlatform[p] = (byPlatform[p] ?? 0) + 1
    const l = r.lang ?? 'unknown'
    byLang[l] = (byLang[l] ?? 0) + 1
  }

  return { total: rows.length, byPlatform, byLang }
}

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

export default async function NotificationsOverviewPage() {
  const [{ counts, delivered24h }, deviceStats] = await Promise.all([
    getOutboxStats(),
    getDeviceStats(),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">推送概览</h1>

      {/* Outbox 队列统计 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-muted-foreground">Outbox 队列</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(counts) as Array<keyof typeof counts>).map((status) => (
            <Card key={status}>
              <CardContent className="py-5 text-center">
                <Badge variant={STATUS_VARIANT[status]} className="mb-2">
                  {STATUS_LABEL[status]}
                </Badge>
                <p className="text-3xl font-bold">{counts[status]}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="py-4 flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">近 24 小时投递量</p>
              <p className="text-2xl font-bold">{delivered24h}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 设备统计 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-muted-foreground">
          设备注册统计（共 {deviceStats.total} 台）
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">按平台</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(deviceStats.byPlatform).length > 0 ? (
                Object.entries(deviceStats.byPlatform)
                  .sort((a, b) => b[1] - a[1])
                  .map(([platform, count]) => (
                    <div key={platform} className="flex items-center justify-between text-sm">
                      <Badge variant="outline">{platform}</Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">按语言</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(deviceStats.byLang).length > 0 ? (
                Object.entries(deviceStats.byLang)
                  .sort((a, b) => b[1] - a[1])
                  .map(([lang, count]) => (
                    <div key={lang} className="flex items-center justify-between text-sm">
                      <Badge variant="outline">{lang}</Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
