import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { SupportSearchBar } from '../_components/search-bar'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PHONE_RE = /^(\+?86)?1[3-9]\d{9}$/

function normalizePhone(t: string) {
  const digits = t.replace(/\D/g, '')
  if (digits.length === 11) return `+86${digits}`
  if (digits.length === 13 && digits.startsWith('86')) return `+${digits}`
  return t
}

async function resolveUserId(q: string): Promise<string | null> {
  const t = q.trim()
  if (UUID_RE.test(t)) return t
  if (PHONE_RE.test(t.replace(/[-\s]/g, ''))) {
    const normalized = normalizePhone(t)
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    return (data?.users ?? []).find((u) => u.phone === normalized)?.id ?? null
  }
  if (t.includes('@')) {
    const lower = t.toLowerCase()
    const [listRes, profileRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from('profiles').select('id').ilike('generated_email', t).maybeSingle(),
    ])
    const byEmail = (listRes.data?.users ?? []).find((u) => u.email?.toLowerCase() === lower)
    return byEmail?.id ?? profileRes.data?.id ?? null
  }
  // username
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('username', t)
    .maybeSingle()
  return profile?.id ?? null
}

type DiagnosticsResult = {
  userId: string
  username: string | null
  phone: string | null
  email: string | null
  devices: {
    device_id: string
    token: string | null
    platform: string | null
    lang: string
    tz_offset: number
    updated_at: string
  }[]
  familyId: string | null
  inviteCode: string | null
  notifLog: {
    id: number
    kid_id: string
    scene: string
    sent_at: string
    clicked: boolean
    clicked_at: string | null
  }[]
  outbox: {
    id: number
    event: string
    kid_id: string | null
    actor_user_id: string | null
    who: string | null
    status: string
    attempts: number
    max_attempts: number
    sent_count: number | null
    last_error: string | null
    created_at: string
    next_attempt_at: string
    processed_at: string | null
  }[]
  notifPrefs: {
    enabled: boolean
    frequency: string
    notify_family: boolean
    quiet_start: string
    quiet_end: string
    updated_at: string
  } | null
}

async function runDiagnose(userId: string): Promise<DiagnosticsResult> {
  const [
    { data: { user: authUser } },
    { data: profile },
    { data: membership },
    { data: devices },
  ] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin.from('profiles').select('username, generated_email').eq('id', userId).maybeSingle(),
    supabaseAdmin
      .from('family_members')
      .select('family_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('push_devices')
      .select('device_id, token, platform, lang, tz_offset, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  ])

  const familyId = membership?.family_id ?? null

  const [familyRes, notifLogRes, outboxRes, notifPrefsRes] = await Promise.all([
    familyId
      ? supabaseAdmin
          .from('families')
          .select('invite_code')
          .eq('id', familyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    familyId
      ? supabaseAdmin
          .from('notification_log')
          .select('id, kid_id, scene, sent_at, clicked, clicked_at')
          .eq('family_id', familyId)
          .order('sent_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as DiagnosticsResult['notifLog'] }),
    familyId
      ? supabaseAdmin
          .from('notification_outbox')
          .select(
            'id, event, kid_id, actor_user_id, who, status, attempts, max_attempts, sent_count, last_error, created_at, next_attempt_at, processed_at'
          )
          .eq('family_id', familyId)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as DiagnosticsResult['outbox'] }),
    familyId
      ? supabaseAdmin
          .from('notification_preferences')
          .select('enabled, frequency, notify_family, quiet_start, quiet_end, updated_at')
          .eq('family_id', familyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    userId,
    username: profile?.username ?? null,
    phone: authUser?.phone ?? null,
    email: authUser?.email ?? profile?.generated_email ?? null,
    devices: devices ?? [],
    familyId,
    inviteCode: familyRes.data?.invite_code ?? null,
    notifLog: notifLogRes.data ?? [],
    outbox: outboxRes.data ?? [],
    notifPrefs: notifPrefsRes.data ?? null,
  }
}

export default async function PushDiagnosePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const trimmed = q.trim()

  let result: DiagnosticsResult | null = null
  let error: string | null = null

  if (trimmed) {
    const userId = await resolveUserId(trimmed)
    if (!userId) {
      error = `未找到与「${trimmed}」匹配的用户`
    } else {
      result = await runDiagnose(userId)
    }
  }

  const pendingCount = result?.outbox.filter((o) => o.status === 'pending').length ?? 0
  const deadCount = result?.outbox.filter((o) => o.status === 'dead').length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/support" className="text-sm text-muted-foreground hover:underline">
          ← 客服搜索
        </Link>
        <h1 className="text-2xl font-bold">推送诊断</h1>
      </div>

      <SupportSearchBar
        defaultValue={trimmed || undefined}
        placeholder="输入用户 ID、手机号、邮箱或用户名…"
        action="/support/push-diagnose"
      />

      {trimmed && !result && !error && (
        <p className="text-sm text-muted-foreground">查询中…</p>
      )}

      {error && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      )}

      {!trimmed && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-base">输入用户标识开始推送诊断</p>
            <p className="mt-2 text-xs">支持 user_id · 手机号 · 邮箱 · 用户名</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* 用户摘要 */}
          <Card>
            <CardHeader>
              <CardTitle>用户摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow
                label="用户 ID"
                value={
                  <span className="font-mono text-xs break-all">{result.userId}</span>
                }
              />
              <InfoRow label="用户名" value={result.username ?? '—'} />
              <InfoRow label="手机号" value={result.phone ?? '—'} />
              <InfoRow label="邮箱" value={result.email ?? '—'} />
              <InfoRow
                label="所属家庭"
                value={
                  result.familyId ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono tracking-wider">
                        {result.inviteCode}
                      </Badge>
                      <Link
                        href={`/families/${result.familyId}`}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        {result.familyId.slice(0, 8)}…
                      </Link>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">未加入家庭</span>
                  )
                }
              />
              <div className="flex gap-3 pt-2">
                <Link href={`/support/user/${result.userId}`}>
                  <span className="text-xs text-primary underline hover:no-underline">
                    查看完整客服视图 →
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* 推送设备 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                推送设备
                <Badge variant={result.devices.length > 0 ? 'secondary' : 'destructive'}>
                  {result.devices.length} 台
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.devices.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">平台</th>
                      <th className="p-3">语言</th>
                      <th className="p-3">时区</th>
                      <th className="p-3">Token</th>
                      <th className="p-3">设备 ID</th>
                      <th className="p-3">更新时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.devices.map((d) => (
                      <tr key={d.device_id} className="border-b hover:bg-muted/40">
                        <td className="p-3">
                          <Badge variant="outline">{d.platform ?? '未知'}</Badge>
                        </td>
                        <td className="p-3">{d.lang}</td>
                        <td className="p-3">
                          UTC{d.tz_offset >= 0 ? '+' : ''}{d.tz_offset / 60}h
                        </td>
                        <td className="p-3">
                          <Badge variant={d.token ? 'secondary' : 'destructive'}>
                            {d.token ? '有效' : '缺失'}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">
                          {d.device_id.length > 20
                            ? d.device_id.slice(0, 20) + '…'
                            : d.device_id}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(d.updated_at).toLocaleString('zh-CN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  ⚠ 该用户没有注册任何推送设备，将无法收到推送通知
                </p>
              )}
            </CardContent>
          </Card>

          {/* 通知偏好 */}
          <Card>
            <CardHeader>
              <CardTitle>通知偏好</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {result.notifPrefs ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <PrefItem
                    label="推送总开关"
                    value={
                      <Badge variant={result.notifPrefs.enabled ? 'secondary' : 'destructive'}>
                        {result.notifPrefs.enabled ? '开启' : '关闭'}
                      </Badge>
                    }
                  />
                  <PrefItem
                    label="家人记录通知"
                    value={
                      <Badge variant={result.notifPrefs.notify_family ? 'secondary' : 'outline'}>
                        {result.notifPrefs.notify_family ? '开启' : '关闭'}
                      </Badge>
                    }
                  />
                  <PrefItem label="推送频率" value={result.notifPrefs.frequency} />
                  <PrefItem
                    label="免打扰时段"
                    value={`${result.notifPrefs.quiet_start} — ${result.notifPrefs.quiet_end}`}
                  />
                  <PrefItem
                    label="设置更新时间"
                    value={new Date(result.notifPrefs.updated_at).toLocaleString('zh-CN')}
                  />
                </div>
              ) : (
                <p className="py-4 text-muted-foreground">
                  {result.familyId
                    ? '未设置（使用默认：开启，频率 normal，免打扰 22:00—08:00）'
                    : '未加入家庭，无通知偏好'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Outbox 队列 */}
          {result.familyId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Outbox 队列
                  {pendingCount > 0 && (
                    <Badge variant="outline">{pendingCount} 条待发</Badge>
                  )}
                  {deadCount > 0 && (
                    <Badge variant="destructive">{deadCount} 条死信</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.outbox.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-3">事件</th>
                        <th className="p-3">状态</th>
                        <th className="p-3">发起人角色</th>
                        <th className="p-3">重试</th>
                        <th className="p-3">实发设备</th>
                        <th className="p-3">创建时间</th>
                        <th className="p-3">下次重试</th>
                        <th className="p-3">错误</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.outbox.map((o) => (
                        <tr key={o.id} className="border-b hover:bg-muted/40">
                          <td className="p-3">
                            <Badge variant="outline">{o.event}</Badge>
                          </td>
                          <td className="p-3">
                            <StatusBadge status={o.status} />
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {o.who ?? (
                              <span className="font-mono text-xs">
                                {o.actor_user_id?.slice(0, 8) ?? '邀记'}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {o.attempts}/{o.max_attempts}
                          </td>
                          <td className="p-3 text-center">
                            {o.sent_count ?? '—'}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(o.created_at).toLocaleString('zh-CN')}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {o.status === 'pending'
                              ? new Date(o.next_attempt_at).toLocaleString('zh-CN')
                              : '—'}
                          </td>
                          <td className="p-3 max-w-[200px] truncate text-xs text-destructive">
                            {o.last_error ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">队列为空（最近无记录创建）</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* 推送投递记录 */}
          {result.familyId && (
            <Card>
              <CardHeader>
                <CardTitle>
                  推送投递记录（最近 20 条，家庭维度）
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.notifLog.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-3">场景</th>
                        <th className="p-3">孩子 ID</th>
                        <th className="p-3">发送时间</th>
                        <th className="p-3">已点击</th>
                        <th className="p-3">点击时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.notifLog.map((n) => (
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
                              <span className="text-muted-foreground">未点击</span>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {n.clicked_at
                              ? new Date(n.clicked_at).toLocaleString('zh-CN')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">暂无推送投递记录</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1">{value}</span>
    </div>
  )
}

function PrefItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium">{value}</div>
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
  return <Badge variant={variants[status] ?? 'outline'}>{status}</Badge>
}
