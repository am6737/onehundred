import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BanButton } from './ban-button'

const providerLabels: Record<string, string> = {
  phone: '手机号',
  email: '邮箱',
  apple: 'Apple',
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [
    { data: { user: authUser } },
    { data: profile },
    { data: memberships },
    { data: devices },
    { count: memoryCount },
  ] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(id),
    supabaseAdmin.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin
      .from('family_members')
      .select('family_id, role, custom_role, joined_at')
      .eq('user_id', id),
    supabaseAdmin.from('push_devices').select('*').eq('user_id', id).order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id),
  ])

  if (!authUser) notFound()

  const familyIds = (memberships ?? []).map((m) => m.family_id)
  const { data: families } = familyIds.length
    ? await supabaseAdmin.from('families').select('id, invite_code').in('id', familyIds)
    : { data: [] as { id: string; invite_code: string }[] }

  const familyMap = new Map((families ?? []).map((f) => [f.id, f]))

  const isBanned =
    authUser.banned_until && new Date(authUser.banned_until) > new Date()

  const providers = authUser.identities?.map((i) => i.provider) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/users" className="text-sm text-muted-foreground hover:underline">
          ← 用户列表
        </Link>
        <h1 className="text-2xl font-bold">
          {profile?.username ?? '未设置用户名'}
        </h1>
        <Badge variant={isBanned ? 'destructive' : 'secondary'}>
          {isBanned ? '已封禁' : '正常'}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow
              label="用户 ID"
              value={<span className="font-mono text-xs break-all">{id}</span>}
            />
            <InfoRow label="用户名" value={profile?.username ?? '-'} />
            <InfoRow label="手机号" value={authUser.phone || '-'} />
            <InfoRow
              label="邮箱"
              value={authUser.email || profile?.generated_email || '-'}
            />
            <InfoRow
              label="登录方式"
              value={
                providers.length > 0
                  ? providers.map((p) => providerLabels[p] ?? p).join('、')
                  : '匿名'
              }
            />
            <InfoRow
              label="注册时间"
              value={new Date(authUser.created_at).toLocaleString('zh-CN')}
            />
            <InfoRow
              label="最后登录"
              value={
                authUser.last_sign_in_at
                  ? new Date(authUser.last_sign_in_at).toLocaleString('zh-CN')
                  : '-'
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>所属家庭</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {memberships && memberships.length > 0 ? (
              <div className="space-y-3">
                {memberships.map((m) => {
                  const family = familyMap.get(m.family_id)
                  return (
                    <div key={m.family_id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">邀请码</span>
                        <Link
                          href={`/families/${m.family_id}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {family?.invite_code ?? m.family_id.slice(0, 8) + '…'}
                        </Link>
                      </div>
                      <InfoRow
                        label="家庭角色"
                        value={m.custom_role || m.role}
                      />
                      <InfoRow
                        label="加入时间"
                        value={new Date(m.joined_at).toLocaleString('zh-CN')}
                      />
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">该用户尚未加入任何家庭</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>设备列表</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {devices && devices.length > 0 ? (
              <div className="space-y-3">
                {devices.map((d) => (
                  <div key={d.device_id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{d.platform ?? '未知平台'}</Badge>
                      <Badge variant="outline">{d.lang}</Badge>
                    </div>
                    <InfoRow
                      label="设备 ID"
                      value={
                        <span className="font-mono text-xs">
                          {d.device_id.slice(0, 20)}…
                        </span>
                      }
                    />
                    <InfoRow
                      label="最后更新"
                      value={new Date(d.updated_at).toLocaleString('zh-CN')}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">无已注册设备</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>统计 &amp; 操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <InfoRow
              label="创建的记录数"
              value={`${memoryCount ?? 0} 条`}
            />
            <div className="pt-2">
              <BanButton userId={id} isBanned={!!isBanned} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1">{value}</span>
    </div>
  )
}
