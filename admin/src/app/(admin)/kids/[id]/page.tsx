import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KidEditSheet } from '../_components/kid-edit-sheet'

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
const stageLabel = (stage: number) => `第 ${stage} 阶段`

export default async function KidDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: kid } = await supabaseAdmin
    .from('kids')
    .select('id, family_id, user_id, name, birth_year, birth_month, tone')
    .eq('id', id)
    .maybeSingle()

  if (!kid) notFound()

  const [familyRes, mascotRes, memoriesRes] = await Promise.all([
    supabaseAdmin
      .from('families')
      .select('id, invite_code, created_by')
      .eq('id', kid.family_id)
      .maybeSingle(),
    supabaseAdmin
      .from('mascots')
      .select('kid_id, name, species, stage, grown, items')
      .eq('kid_id', id)
      .maybeSingle(),
    supabaseAdmin
      .from('memories')
      .select('id, type, perspective, title, date, created_at')
      .eq('kid_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const family = familyRes.data
  const mascot = mascotRes.data
  const memories = memoriesRes.data ?? []

  // Creator profile
  const creatorId = family?.created_by
  const { data: creatorProfile } = creatorId
    ? await supabaseAdmin
        .from('profiles')
        .select('id, username, generated_email')
        .eq('id', creatorId)
        .maybeSingle()
    : { data: null }

  // Memory stats
  const byType: Record<string, number> = {}
  const byPerspective: Record<string, number> = {}
  for (const m of memories) {
    byType[m.type] = (byType[m.type] ?? 0) + 1
    byPerspective[m.perspective] = (byPerspective[m.perspective] ?? 0) + 1
  }
  const recent = memories.slice(0, 10)

  // Wardrobe items
  const wardrobeItems: string[] = Array.isArray(mascot?.items) ? mascot.items : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/kids">
          <Button variant="ghost" size="sm">
            ← 返回列表
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{kid.name}</h1>
        <KidEditSheet
          kid={{
            id: kid.id,
            name: kid.name,
            birth_year: kid.birth_year,
            birth_month: kid.birth_month,
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">孩子 ID</dt>
                <dd className="mt-0.5 font-mono text-xs break-all">{kid.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">名字</dt>
                <dd className="mt-0.5 font-medium">{kid.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">出生年月</dt>
                <dd className="mt-0.5">
                  {kid.birth_year} 年 {kid.birth_month} 月
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">配色主题</dt>
                <dd className="mt-0.5">
                  <Badge variant="outline">{kid.tone}</Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Family info */}
        <Card>
          <CardHeader>
            <CardTitle>所属家庭</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">家庭邀请码</dt>
                <dd className="mt-0.5">
                  {family ? (
                    <Link
                      href={`/families/${family.id}`}
                      className="font-mono text-base tracking-widest text-primary hover:underline"
                    >
                      {family.invite_code}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">
                      {kid.family_id}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">家庭创建者</dt>
                <dd className="mt-0.5">
                  {creatorProfile ? (
                    <>
                      <Link
                        href={`/users/${creatorProfile.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {creatorProfile.username ?? '未设置用户名'}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {creatorProfile.generated_email}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs font-mono">
                      {creatorId ?? '—'}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Mascot info */}
      <Card>
        <CardHeader>
          <CardTitle>吉祥物状态</CardTitle>
        </CardHeader>
        <CardContent>
          {mascot ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">宠物名</dt>
                <dd className="mt-0.5 font-medium">{mascot.name || '未命名'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">种类</dt>
                <dd className="mt-0.5">
                  {speciesLabel[mascot.species] ?? mascot.species}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">成长阶段</dt>
                <dd className="mt-0.5">{stageLabel(mascot.stage)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">经验值 (XP)</dt>
                <dd className="mt-0.5 font-medium">{mascot.grown}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">已解锁装扮</dt>
                <dd className="mt-0.5">
                  {wardrobeItems.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {wardrobeItems.map((item, i) => (
                        <Badge key={i} variant="secondary" className="font-mono text-xs">
                          {typeof item === 'string' ? item : JSON.stringify(item)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">暂无</span>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">该孩子尚无吉祥物记录</p>
          )}
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
                <th className="px-4 py-3">记录日期</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    {m.title || <span className="text-muted-foreground">（无标题）</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{typeLabel[m.type] ?? m.type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {perspectiveLabel[m.perspective] ?? m.perspective}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.date}</td>
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
