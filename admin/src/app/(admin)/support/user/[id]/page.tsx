import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const PROVIDER_LABELS: Record<string, string> = {
  phone: '手机号',
  email: '邮箱',
  apple: 'Apple',
  wechat: '微信',
}

const MEMORY_TYPE_LABELS: Record<string, string> = {
  voice: '语音',
  photo: '照片',
  text: '文字',
  video: '视频',
}

export default async function SupportUserPage({
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
    { data: inviteTokens },
  ] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(id),
    supabaseAdmin.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin
      .from('family_members')
      .select('family_id, role, custom_role, joined_at')
      .eq('user_id', id),
    supabaseAdmin
      .from('push_devices')
      .select('device_id, token, platform, lang, tz_offset, updated_at')
      .eq('user_id', id)
      .order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('invite_tokens')
      .select('id, level_title, kid_name, perspective, expires_at, opened_at, is_active, created_at')
      .eq('created_by', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (!authUser) notFound()

  const familyIds = (memberships ?? []).map((m) => m.family_id)
  const primaryFamilyId = familyIds[0] ?? null

  const [familiesRes, kidsRes, memoryTypesRes, notifLogRes, outboxRes, notifPrefsRes] =
    await Promise.all([
      familyIds.length
        ? supabaseAdmin
            .from('families')
            .select('id, invite_code, created_at, created_by')
            .in('id', familyIds)
        : Promise.resolve({ data: [] as { id: string; invite_code: string; created_at: string; created_by: string }[] }),

      primaryFamilyId
        ? supabaseAdmin
            .from('kids')
            .select('id, name, birth_year, birth_month, tone')
            .eq('family_id', primaryFamilyId)
        : Promise.resolve({ data: [] as { id: string; name: string; birth_year: number; birth_month: number; tone: string }[] }),

      supabaseAdmin
        .from('memories')
        .select('type')
        .eq('user_id', id),

      primaryFamilyId
        ? supabaseAdmin
            .from('notification_log')
            .select('id, kid_id, scene, sent_at, clicked')
            .eq('family_id', primaryFamilyId)
            .order('sent_at', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] as { id: number; kid_id: string; scene: string; sent_at: string; clicked: boolean }[] }),

      primaryFamilyId
        ? supabaseAdmin
            .from('notification_outbox')
            .select('id, event, status, attempts, sent_count, last_error, created_at, next_attempt_at')
            .eq('family_id', primaryFamilyId)
            .order('created_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] as { id: number; event: string; status: string; attempts: number; sent_count: number | null; last_error: string | null; created_at: string; next_attempt_at: string }[] }),

      primaryFamilyId
        ? supabaseAdmin
            .from('notification_preferences')
            .select('enabled, frequency, notify_family, quiet_start, quiet_end, updated_at')
            .eq('family_id', primaryFamilyId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

  const familyMap = new Map((familiesRes.data ?? []).map((f) => [f.id, f]))

  const memCountByType: Record<string, number> = {}
  for (const m of memoryTypesRes.data ?? []) {
    memCountByType[m.type] = (memCountByType[m.type] ?? 0) + 1
  }
  const totalMemories = Object.values(memCountByType).reduce((a, b) => a + b, 0)

  const isBanned =
    authUser.banned_until && new Date(authUser.banned_until) > new Date()
  const providers = authUser.identities?.map((i) => i.provider) ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/support" className="text-sm text-muted-foreground hover:underline">
          ← 客服搜索
        </Link>
        <h1 className="text-2xl font-bold">
          {profile?.username ?? (
            <span className="text-muted-foreground">未设置用户名</span>
          )}
        </h1>
        {isBanned && <Badge variant="destructive">已封禁</Badge>}
        {authUser.is_anonymous && <Badge variant="outline">匿名账号</Badge>}
        {!isBanned && !authUser.is_anonymous && (
          <Badge variant="secondary">正常</Badge>
        )}
        <Link href={`/users/${id}`} className="ml-auto">
          <Button variant="outline" size="sm">
            标准用户页面 →
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 基本档案 */}
        <Card>
          <CardHeader>
            <CardTitle>基本档案</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="用户 ID" value={<span className="font-mono text-xs break-all">{id}</span>} />
            <InfoRow label="用户名" value={profile?.username ?? '—'} />
            <InfoRow label="手机号" value={authUser.phone || '—'} />
            <InfoRow label="邮箱" value={authUser.email || profile?.generated_email || '—'} />
            <InfoRow
              label="登录方式"
              value={
                providers.length > 0
                  ? providers.map((p) => PROVIDER_LABELS[p] ?? p).join('、')
                  : '匿名'
              }
            />
            <InfoRow label="角色" value={profile ? (profile.custom_role || profile.role) : '—'} />
            <InfoRow
              label="注册时间"
              value={new Date(authUser.created_at).toLocaleString('zh-CN')}
            />
            <InfoRow
              label="最后登录"
              value={
                authUser.last_sign_in_at
                  ? new Date(authUser.last_sign_in_at).toLocaleString('zh-CN')
                  : '—'
              }
            />
            {isBanned && (
              <InfoRow
                label="封禁到期"
                value={
                  <span className="text-destructive">
                    {new Date(authUser.banned_until!).toLocaleString('zh-CN')}
                  </span>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* 所属家庭 */}
        <Card>
          <CardHeader>
            <CardTitle>所属家庭</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {memberships && memberships.length > 0 ? (
              <div className="space-y-3">
                {memberships.map((m) => {
                  const family = familyMap.get(m.family_id)
                  const isCreator = family?.created_by === id
                  return (
                    <div key={m.family_id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono tracking-wider">
                          {family?.invite_code ?? '…'}
                        </Badge>
                        {isCreator && <Badge variant="secondary">创建者</Badge>}
                        <Link
                          href={`/families/${m.family_id}`}
                          className="ml-auto text-xs text-muted-foreground hover:underline"
                        >
                          查看家庭 →
                        </Link>
                      </div>
                      <InfoRow label="家庭角色" value={m.custom_role || m.role} />
                      <InfoRow
                        label="加入时间"
                        value={new Date(m.joined_at).toLocaleString('zh-CN')}
                      />
                      <InfoRow
                        label="家庭 ID"
                        value={
                          <span className="font-mono text-xs text-muted-foreground">
                            {m.family_id}
                          </span>
                        }
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

        {/* 孩子列表 */}
        <Card>
          <CardHeader>
            <CardTitle>家庭孩子</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {kidsRes.data && kidsRes.data.length > 0 ? (
              <div className="space-y-2">
                {kidsRes.data.map((kid) => (
                  <div
                    key={kid.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div
                      className="size-3 rounded-full"
                      style={{ background: kid.tone }}
                    />
                    <div>
                      <div className="font-medium">{kid.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {kid.birth_year} 年 {kid.birth_month} 月 ·{' '}
                        <span className="font-mono">{kid.id}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                {primaryFamilyId ? '暂无孩子' : '未加入家庭'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 记录统计 */}
        <Card>
          <CardHeader>
            <CardTitle>
              记录统计 <span className="text-muted-foreground font-normal text-sm">（该用户创建）</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(MEMORY_TYPE_LABELS).map(([type, label]) => (
                <div key={type} className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold">{memCountByType[type] ?? 0}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-muted px-4 py-2 text-center">
              <span className="text-lg font-semibold">{totalMemories}</span>
              <span className="ml-1 text-muted-foreground">条总计</span>
            </div>
          </CardContent>
        </Card>

        {/* 推送设备 */}
        <Card>
          <CardHeader>
            <CardTitle>推送设备</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {devices && devices.length > 0 ? (
              <div className="space-y-3">
                {devices.map((d) => (
                  <div key={d.device_id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{d.platform ?? '未知平台'}</Badge>
                      <Badge variant="outline">{d.lang}</Badge>
                      <Badge variant={d.token ? 'secondary' : 'destructive'}>
                        {d.token ? 'Token 有效' : '无 Token'}
                      </Badge>
                    </div>
                    <InfoRow
                      label="设备 ID"
                      value={
                        <span className="font-mono text-xs break-all">{d.device_id}</span>
                      }
                    />
                    <InfoRow
                      label="时区偏移"
                      value={`UTC${d.tz_offset >= 0 ? '+' : ''}${d.tz_offset / 60}h`}
                    />
                    <InfoRow
                      label="最后更新"
                      value={new Date(d.updated_at).toLocaleString('zh-CN')}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">无已注册推送设备</p>
            )}
          </CardContent>
        </Card>

        {/* 通知偏好 */}
        <Card>
          <CardHeader>
            <CardTitle>通知偏好</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {notifPrefsRes.data ? (
              <div className="space-y-2">
                <InfoRow
                  label="推送开关"
                  value={
                    <Badge variant={notifPrefsRes.data.enabled ? 'secondary' : 'destructive'}>
                      {notifPrefsRes.data.enabled ? '已开启' : '已关闭'}
                    </Badge>
                  }
                />
                <InfoRow
                  label="家人记录通知"
                  value={
                    <Badge variant={notifPrefsRes.data.notify_family ? 'secondary' : 'outline'}>
                      {notifPrefsRes.data.notify_family ? '开启' : '关闭'}
                    </Badge>
                  }
                />
                <InfoRow label="频率" value={notifPrefsRes.data.frequency} />
                <InfoRow
                  label="免打扰"
                  value={`${notifPrefsRes.data.quiet_start} — ${notifPrefsRes.data.quiet_end}`}
                />
                <InfoRow
                  label="最后更新"
                  value={new Date(notifPrefsRes.data.updated_at).toLocaleString('zh-CN')}
                />
              </div>
            ) : (
              <p className="text-muted-foreground">
                {primaryFamilyId ? '未设置通知偏好（使用默认值）' : '未加入家庭'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 最近推送投递 */}
      {primaryFamilyId && (
        <Card>
          <CardHeader>
            <CardTitle>最近家庭推送记录（family_id 维度）</CardTitle>
          </CardHeader>
          <CardContent>
            {notifLogRes.data && notifLogRes.data.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3">场景</th>
                    <th className="p-3">孩子 ID</th>
                    <th className="p-3">发送时间</th>
                    <th className="p-3">已点击</th>
                  </tr>
                </thead>
                <tbody>
                  {notifLogRes.data.map((n) => (
                    <tr key={n.id} className="border-b hover:bg-muted/40">
                      <td className="p-3">
                        <Badge variant="outline">{n.scene}</Badge>
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {n.kid_id}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(n.sent_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="p-3">
                        {n.clicked ? (
                          <Badge variant="secondary">已点击</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground py-4">暂无推送记录</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Outbox 队列 */}
      {primaryFamilyId && (
        <Card>
          <CardHeader>
            <CardTitle>Outbox 队列（最近 5 条）</CardTitle>
          </CardHeader>
          <CardContent>
            {outboxRes.data && outboxRes.data.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3">事件</th>
                    <th className="p-3">状态</th>
                    <th className="p-3">重试次数</th>
                    <th className="p-3">发送数</th>
                    <th className="p-3">创建时间</th>
                    <th className="p-3">错误</th>
                  </tr>
                </thead>
                <tbody>
                  {outboxRes.data.map((o) => (
                    <tr key={o.id} className="border-b hover:bg-muted/40">
                      <td className="p-3">
                        <Badge variant="outline">{o.event}</Badge>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="p-3 text-center">{o.attempts}</td>
                      <td className="p-3 text-center">{o.sent_count ?? '—'}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(o.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="p-3 max-w-xs text-xs text-destructive truncate">
                        {o.last_error ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground py-4">队列为空</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 活跃邀记令牌 */}
      <Card>
        <CardHeader>
          <CardTitle>邀记令牌（该用户创建）</CardTitle>
        </CardHeader>
        <CardContent>
          {inviteTokens && inviteTokens.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">令牌 ID</th>
                  <th className="p-3">事项</th>
                  <th className="p-3">孩子</th>
                  <th className="p-3">视角</th>
                  <th className="p-3">状态</th>
                  <th className="p-3">过期时间</th>
                  <th className="p-3">打开时间</th>
                </tr>
              </thead>
              <tbody>
                {inviteTokens.map((t) => {
                  const expired = new Date(t.expires_at) < new Date()
                  return (
                    <tr key={t.id} className="border-b hover:bg-muted/40">
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {t.id.slice(0, 12)}…
                      </td>
                      <td className="p-3 max-w-[200px] truncate">{t.level_title}</td>
                      <td className="p-3">{t.kid_name ?? '—'}</td>
                      <td className="p-3">{t.perspective}</td>
                      <td className="p-3">
                        {expired ? (
                          <Badge variant="destructive">已过期</Badge>
                        ) : t.is_active ? (
                          <Badge variant="secondary">有效</Badge>
                        ) : (
                          <Badge variant="outline">已禁用</Badge>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(t.expires_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {t.opened_at
                          ? new Date(t.opened_at).toLocaleString('zh-CN')
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground py-4">暂无邀记令牌</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1">{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'secondary' | 'outline' | 'destructive'> = {
    done: 'secondary',
    pending: 'outline',
    processing: 'outline',
    dead: 'destructive',
  }
  return (
    <Badge variant={variants[status] ?? 'outline'}>{status}</Badge>
  )
}
