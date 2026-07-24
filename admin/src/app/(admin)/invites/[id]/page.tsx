import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DeactivateButton } from '../_components/deactivate-button'

const perspectiveLabel: Record<string, string> = {
  parent: '父母视角',
  child: '孩子视角',
  together: '共同视角',
}

function tokenStatus(token: { is_active: boolean; expires_at: string }) {
  if (!token.is_active) return { label: '已停用', variant: 'destructive' as const }
  if (new Date(token.expires_at) < new Date()) return { label: '已过期', variant: 'secondary' as const }
  return { label: '活跃', variant: 'default' as const }
}

export default async function InviteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: token } = await supabaseAdmin
    .from('invite_tokens')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!token) notFound()

  const [familyRes, creatorRes, memoriesRes] = await Promise.all([
    supabaseAdmin
      .from('families')
      .select('id, invite_code')
      .eq('id', token.family_id)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('id, username, generated_email')
      .eq('id', token.created_by)
      .maybeSingle(),
    supabaseAdmin
      .from('memories')
      .select('id, title, type, created_at, perspective')
      .eq('invite_token_id', id)
      .order('created_at', { ascending: false }),
  ])

  const family = familyRes.data
  const creator = creatorRes.data
  const memories = memoriesRes.data ?? []
  const { label: statusLabel, variant: statusVariant } = tokenStatus(token)

  const typeLabel: Record<string, string> = {
    photo: '照片',
    video: '视频',
    voice: '语音',
    text: '文字',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/invites">
          <Button variant="ghost" size="sm">
            ← 返回列表
          </Button>
        </Link>
        <h1 className="text-2xl font-bold truncate max-w-lg">{token.level_title}</h1>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: details */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>令牌信息</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">令牌 ID</dt>
                  <dd className="mt-0.5 font-mono text-xs break-all">{token.id}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">视角</dt>
                  <dd className="mt-0.5">
                    {perspectiveLabel[token.perspective] ?? token.perspective}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">创建者</dt>
                  <dd className="mt-0.5">
                    {creator ? (
                      <>
                        <div className="font-medium">{creator.username ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {creator.generated_email}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">（已注销）</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">邀请人角色</dt>
                  <dd className="mt-0.5">{token.inviter_role || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">家庭邀请码</dt>
                  <dd className="mt-0.5">
                    {family ? (
                      <Link href={`/families/${family.id}`}>
                        <Badge
                          variant="outline"
                          className="font-mono tracking-widest cursor-pointer hover:bg-muted"
                        >
                          {family.invite_code}
                        </Badge>
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">
                        {token.family_id}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">目标孩子</dt>
                  <dd className="mt-0.5">{token.kid_name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">创建时间</dt>
                  <dd className="mt-0.5">
                    {new Date(token.created_at).toLocaleString('zh-CN')}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">过期时间</dt>
                  <dd className="mt-0.5">
                    {new Date(token.expires_at).toLocaleString('zh-CN')}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">首次打开</dt>
                  <dd className="mt-0.5">
                    {token.opened_at
                      ? new Date(token.opened_at).toLocaleString('zh-CN')
                      : '尚未打开'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">记录类型建议</dt>
                  <dd className="mt-0.5">{token.level_suggest}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>活动详情</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">活动编号</dt>
                  <dd className="mt-0.5">{token.level_num}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">活动名称</dt>
                  <dd className="mt-0.5 font-medium">{token.level_title}</dd>
                </div>
                {token.level_why && (
                  <div>
                    <dt className="text-muted-foreground">为什么</dt>
                    <dd className="mt-0.5 rounded bg-muted/50 px-3 py-2">{token.level_why}</dd>
                  </div>
                )}
                {token.level_how && (
                  <div>
                    <dt className="text-muted-foreground">怎么做</dt>
                    <dd className="mt-0.5 rounded bg-muted/50 px-3 py-2">{token.level_how}</dd>
                  </div>
                )}
                {token.level_record && (
                  <div>
                    <dt className="text-muted-foreground">记录些什么</dt>
                    <dd className="mt-0.5 rounded bg-muted/50 px-3 py-2">{token.level_record}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Memories produced by this invite */}
          <Card>
            <CardHeader>
              <CardTitle>关联回忆（{memories.length}）</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {memories.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  暂无通过此邀记填写的回忆
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3 font-medium">标题</th>
                      <th className="p-3 font-medium">类型</th>
                      <th className="p-3 font-medium">视角</th>
                      <th className="p-3 font-medium">创建时间</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {memories.map((m) => (
                      <tr key={m.id} className="border-b hover:bg-muted/40">
                        <td className="p-3 font-medium">{m.title}</td>
                        <td className="p-3">
                          <Badge variant="outline">{typeLabel[m.type] ?? m.type}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {perspectiveLabel[m.perspective] ?? m.perspective}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(m.created_at).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="p-3">
                          <Link href={`/content/${m.id}`}>
                            <Button variant="outline" size="xs">
                              查看
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: actions */}
        <div className="space-y-4">
          <Card className={token.is_active ? 'border-destructive/50' : ''}>
            <CardHeader>
              <CardTitle className={token.is_active ? 'text-destructive' : ''}>
                {token.is_active ? '危险操作' : '已停用'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {token.is_active ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    停用后对方无法再通过该链接填写回忆，操作将记录到审计日志。
                  </p>
                  <DeactivateButton tokenId={token.id} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">此令牌已被停用，无法恢复。</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
