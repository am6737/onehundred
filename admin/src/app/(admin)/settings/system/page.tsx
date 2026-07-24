import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminManager } from './_components/admin-manager'
import Link from 'next/link'
import { ChevronLeftIcon } from 'lucide-react'

function fmt(n: number) {
  return n.toLocaleString('zh-CN')
}

type BucketInfo = { id: string; name: string; public: boolean; created_at: string }

const KEY_TABLES = [
  'profiles',
  'families',
  'family_members',
  'memories',
  'kids',
  'mascots',
  'push_devices',
  'notification_outbox',
  'admin_audit_log',
  'feature_flags',
  'app_config',
] as const

export default async function SystemPage() {
  const [bucketsRes, adminsRes, ...tableCounts] = await Promise.all([
    supabaseAdmin.storage.listBuckets(),
    supabaseAdmin
      .from('profiles')
      .select('id, username, admin_role')
      .not('admin_role', 'is', null)
      .order('admin_role'),
    ...KEY_TABLES.map((t) =>
      supabaseAdmin
        .from(t as 'profiles')
        .select('*', { count: 'exact', head: true })
        .then((r) => ({ table: t, count: r.count ?? 0 }))
    ),
  ])

  const buckets = (bucketsRes.data ?? []) as BucketInfo[]
  const admins = (adminsRes.data ?? []) as { id: string; username: string | null; admin_role: string }[]

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" />
          系统配置
        </Link>
        <h1 className="text-2xl font-bold">系统信息</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          只读系统状态概览，以及管理员角色管理（需 super_admin 权限）。
        </p>
      </div>

      {/* 各表行数 */}
      <Card>
        <CardHeader>
          <CardTitle>数据表行数</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                  <th className="p-3 font-medium">表名</th>
                  <th className="p-3 font-medium text-right">行数</th>
                </tr>
              </thead>
              <tbody>
                {(tableCounts as { table: string; count: number }[]).map(({ table, count }) => (
                  <tr key={table} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{table}</td>
                    <td className="p-3 text-right tabular-nums">{fmt(count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Storage 桶 */}
      <Card>
        <CardHeader>
          <CardTitle>Storage 桶</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {buckets.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">暂无存储桶</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="p-3 font-medium">桶名</th>
                    <th className="p-3 font-medium">访问</th>
                    <th className="p-3 font-medium">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((b) => (
                    <tr key={b.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{b.name}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            b.public
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {b.public ? '公开' : '私有'}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(b.created_at).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 管理员管理 */}
      <Card>
        <CardHeader>
          <CardTitle>管理员角色管理</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminManager admins={admins} />
        </CardContent>
      </Card>
    </div>
  )
}
