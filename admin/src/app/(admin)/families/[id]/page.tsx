import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  RemoveMemberButton,
  TransferCreatorButton,
  RegenerateInviteCodeButton,
} from '../_components/family-actions'

const speciesLabel: Record<string, string> = { bear: '小熊', dog: '小狗', cat: '小猫' }
const typeLabel: Record<string, string> = {
  voice: '语音',
  photo: '照片',
  text: '文字',
  video: '视频',
}
const perspectiveLabel: Record<string, string> = {
  parent: '父母视角',
  child: '孩子视角',
  together: '共同视角',
}

export default async function FamilyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: family } = await supabaseAdmin
    .from('families')
    .select('id, invite_code, created_at, created_by')
    .eq('id', id)
    .maybeSingle()

  if (!family) notFound()

  // Fetch all data in parallel
  const [membersRes, kidsRes, memoriesRes] = await Promise.all([
    supabaseAdmin
      .from('family_members')
      .select('user_id, role, custom_role, joined_at')
      .eq('family_id', id)
      .order('joined_at', { ascending: true }),
    supabaseAdmin
      .from('kids')
      .select('id, name, birth_year, birth_month, tone')
      .eq('family_id', id),
    supabaseAdmin
      .from('memories')
      .select('id, type, perspective, title, created_at')
      .eq('family_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const members = membersRes.data ?? []
  const kids = kidsRes.data ?? []
  const memories = memoriesRes.data ?? []

  // Fetch profiles for members
  const memberUserIds = members.map((m) => m.user_id)
  const { data: profiles } = memberUserIds.length
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username, generated_email')
        .in('id', memberUserIds)
    : { data: [] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  // Fetch mascots
  const kidIds = kids.map((k) => k.id)
  const { data: mascots } = kidIds.length
    ? await supabaseAdmin
        .from('mascots')
        .select('kid_id, species, stage, grown, name')
        .in('kid_id', kidIds)
    : { data: [] }

  const mascotByKid = new Map((mascots ?? []).map((m) => [m.kid_id, m]))

  // Creator profile
  const creatorProfile = profileMap.get(family.created_by)

  // Memory stats
  const byType: Record<string, number> = {}
  const byPerspective: Record<string, number> = {}
  for (const m of memories) {
    byType[m.type] = (byType[m.type] ?? 0) + 1
    byPerspective[m.perspective] = (byPerspective[m.perspective] ?? 0) + 1
  }
  const recent = memories.slice(0, 10)

  const membersWithProfile = members.map((m) => ({
    ...m,
    username: profileMap.get(m.user_id)?.username ?? null,
    generated_email: profileMap.get(m.user_id)?.generated_email ?? null,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/families">
          <Button variant="ghost" size="sm">
            ← 返回列表
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">家庭详情</h1>
      </div>

      {/* Basic info + actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">家庭 ID</dt>
                <dd className="mt-0.5 font-mono text-xs break-all">{family.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">邀请码</dt>
                <dd className="mt-0.5">
                  <Badge variant="outline" className="font-mono text-base tracking-widest">
                    {family.invite_code}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">创建者</dt>
                <dd className="mt-0.5">
                  {creatorProfile ? (
                    <>
                      <Link
                        href={`/users?q=${encodeURIComponent(creatorProfile.generated_email ?? creatorProfile.id)}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {creatorProfile.username ?? '未设置用户名'}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {creatorProfile.generated_email}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground font-mono text-xs">
                      {family.created_by}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">创建时间</dt>
                <dd className="mt-0.5">
                  {new Date(family.created_at).toLocaleString('zh-CN')}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>管理操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <RegenerateInviteCodeButton familyId={id} />
            <TransferCreatorButton
              familyId={id}
              currentCreatorId={family.created_by}
              members={membersWithProfile}
            />
          </CardContent>
        </Card>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>成员列表（{members.length} 人）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3">用户名</th>
                <th className="px-4 py-3">邮箱</th>
                <th className="px-4 py-3">角色</th>
                <th className="px-4 py-3">加入时间</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {membersWithProfile.map((m) => (
                <tr key={m.user_id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">
                    {m.username ?? <span className="text-muted-foreground font-normal font-mono text-xs">{m.user_id.slice(0, 8)}…</span>}
                    {m.user_id === family.created_by && (
                      <Badge variant="secondary" className="ml-2">
                        创建者
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {m.generated_email ?? '—'}
                  </td>
                  <td className="px-4 py-3">{m.custom_role || m.role}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(m.joined_at).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    {m.user_id !== family.created_by && (
                      <RemoveMemberButton
                        familyId={id}
                        userId={m.user_id}
                        userName={m.username ?? m.user_id.slice(0, 8)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Kids */}
      <Card>
        <CardHeader>
          <CardTitle>孩子列表（{kids.length} 人）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3">名字</th>
                <th className="px-4 py-3">出生年月</th>
                <th className="px-4 py-3">配色主题</th>
                <th className="px-4 py-3">吉祥物</th>
                <th className="px-4 py-3">成长阶段</th>
              </tr>
            </thead>
            <tbody>
              {kids.map((k) => {
                const mascot = mascotByKid.get(k.id)
                return (
                  <tr key={k.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{k.name}</td>
                    <td className="px-4 py-3">
                      {k.birth_year} 年 {k.birth_month} 月
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{k.tone}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {mascot
                        ? `${mascot.name || '未命名'}（${speciesLabel[mascot.species] ?? mascot.species}）`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {mascot
                        ? `阶段 ${mascot.stage}，经验 ${mascot.grown}`
                        : '—'}
                    </td>
                  </tr>
                )
              })}
              {kids.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    暂无孩子信息
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Memory stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>记录总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{memories.length}</div>
            <div className="mt-1 text-sm text-muted-foreground">条记录</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>按类型分布</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(byType).length === 0 ? (
              <div className="text-sm text-muted-foreground">—</div>
            ) : (
              Object.entries(byType).map(([t, n]) => (
                <div key={t} className="flex items-center justify-between text-sm">
                  <span>{typeLabel[t] ?? t}</span>
                  <span className="font-medium">{n}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>按视角分布</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(byPerspective).length === 0 ? (
              <div className="text-sm text-muted-foreground">—</div>
            ) : (
              Object.entries(byPerspective).map(([p, n]) => (
                <div key={p} className="flex items-center justify-between text-sm">
                  <span>{perspectiveLabel[p] ?? p}</span>
                  <span className="font-medium">{n}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent memories */}
      <Card>
        <CardHeader>
          <CardTitle>最近记录（前 10 条）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3">标题</th>
                <th className="px-4 py-3">类型</th>
                <th className="px-4 py-3">视角</th>
                <th className="px-4 py-3">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">{m.title || <span className="text-muted-foreground">（无标题）</span>}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{typeLabel[m.type] ?? m.type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {perspectiveLabel[m.perspective] ?? m.perspective}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(m.created_at).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    暂无记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
