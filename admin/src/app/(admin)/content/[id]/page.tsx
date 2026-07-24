import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ModerationPanel } from './_components/moderation-panel'
import { SealPanel } from './_components/seal-panel'
import { DeleteButton } from './_components/delete-button'

const typeLabel: Record<string, string> = {
  photo: '照片',
  video: '视频',
  voice: '语音',
  text: '文字',
}
const perspectiveLabel: Record<string, string> = {
  parent: '父母视角',
  child: '孩子视角',
  together: '共同视角',
}
const modStatusLabel: Record<string, string> = {
  approved: '已通过',
  pending: '待审核',
  flagged: '已标记',
  removed: '已移除',
}
const modStatusVariant: Record<string, 'outline' | 'secondary' | 'destructive' | 'default'> = {
  approved: 'outline',
  pending: 'secondary',
  flagged: 'default',
  removed: 'destructive',
}

async function getSignedUrls(
  familyId: string,
  memoryId: string,
): Promise<{ name: string; url: string; isLiveVideo: boolean }[]> {
  const prefix = `${familyId}/${memoryId}/`
  const { data: files, error } = await supabaseAdmin.storage.from('memories').list(prefix)
  if (error || !files || files.length === 0) return []

  const paths = files.map((f) => `${prefix}${f.name}`)
  const { data: signed } = await supabaseAdmin.storage
    .from('memories')
    .createSignedUrls(paths, 3600)

  return (signed ?? [])
    .filter((s) => s.signedUrl != null)
    .map((s, i) => ({
      name: files[i]?.name ?? '',
      url: s.signedUrl as string,
      isLiveVideo: files[i]?.name?.includes('.live.') ?? false,
    }))
}

function isImage(name: string) {
  return /\.(jpg|jpeg|png|heic|webp|gif)$/i.test(name)
}
function isVideo(name: string) {
  return /\.(mp4|mov|m4v)$/i.test(name)
}
function isAudio(name: string) {
  return /\.(m4a|aac|mp3|wav|ogg|caf)$/i.test(name)
}

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: memory } = await supabaseAdmin
    .from('memories')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!memory) notFound()

  const [familyRes, kidRes, levelRes, profileRes, mediaFiles] = await Promise.all([
    supabaseAdmin
      .from('families')
      .select('id, invite_code, created_by')
      .eq('id', memory.family_id)
      .maybeSingle(),
    supabaseAdmin
      .from('kids')
      .select('id, name, birth_year, birth_month')
      .eq('id', memory.kid_id)
      .maybeSingle(),
    supabaseAdmin
      .from('levels')
      .select('num, title')
      .eq('num', memory.level_num)
      .maybeSingle(),
    memory.user_id
      ? supabaseAdmin
          .from('profiles')
          .select('id, username, generated_email')
          .eq('id', memory.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getSignedUrls(memory.family_id, id),
  ])

  const family = familyRes.data
  const kid = kidRes.data
  const level = levelRes.data
  const profile = profileRes.data

  // Separate live photos: main photo + paired live video
  const photos = mediaFiles.filter((f) => isImage(f.name) && !f.isLiveVideo)
  const liveVideos = mediaFiles.filter((f) => isVideo(f.name) && f.isLiveVideo)
  const videos = mediaFiles.filter((f) => isVideo(f.name) && !f.isLiveVideo)
  const audios = mediaFiles.filter((f) => isAudio(f.name))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/content">
          <Button variant="ghost" size="sm">
            ← 返回列表
          </Button>
        </Link>
        <h1 className="text-2xl font-bold truncate max-w-lg">{memory.title}</h1>
        <Badge variant={modStatusVariant[memory.moderation_status] ?? 'outline'}>
          {modStatusLabel[memory.moderation_status] ?? memory.moderation_status}
        </Badge>
        {memory.sealed && <Badge variant="secondary">已封存</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: meta + media */}
        <div className="space-y-6 lg:col-span-2">
          {/* Meta */}
          <Card>
            <CardHeader>
              <CardTitle>元信息</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">类型</dt>
                  <dd className="mt-0.5">
                    <Badge variant="outline">{typeLabel[memory.type] ?? memory.type}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">视角</dt>
                  <dd className="mt-0.5">
                    {perspectiveLabel[memory.perspective] ?? memory.perspective}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">日期</dt>
                  <dd className="mt-0.5">{memory.date}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">地点</dt>
                  <dd className="mt-0.5">{memory.place ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">关联活动</dt>
                  <dd className="mt-0.5">
                    {level ? `${level.num} · ${level.title}` : memory.level_num}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">创建时间</dt>
                  <dd className="mt-0.5">
                    {new Date(memory.created_at).toLocaleString('zh-CN')}
                  </dd>
                </div>
                {memory.duration && (
                  <div>
                    <dt className="text-muted-foreground">时长</dt>
                    <dd className="mt-0.5">{memory.duration}</dd>
                  </div>
                )}
                {memory.shots != null && (
                  <div>
                    <dt className="text-muted-foreground">照片数量</dt>
                    <dd className="mt-0.5">{memory.shots}</dd>
                  </div>
                )}
              </dl>

              {memory.caption && (
                <div className="mt-4 space-y-1">
                  <div className="text-sm text-muted-foreground">说明</div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{memory.caption}</div>
                </div>
              )}
              {memory.transcript && (
                <div className="mt-4 space-y-1">
                  <div className="text-sm text-muted-foreground">转写稿</div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap">
                    {memory.transcript}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Creator + Family */}
          <Card>
            <CardHeader>
              <CardTitle>创建者 & 家庭</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">创建者</dt>
                  <dd className="mt-0.5">
                    {profile ? (
                      <>
                        <Link
                          href={`/users?q=${encodeURIComponent(profile.generated_email ?? profile.id)}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {profile.username ?? '未设置用户名'}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {profile.generated_email}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">（已注销）</span>
                    )}
                  </dd>
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
                        {memory.family_id}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">孩子</dt>
                  <dd className="mt-0.5">{kid ? kid.name : memory.kid_id}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">记录 ID</dt>
                  <dd className="mt-0.5 font-mono text-xs text-muted-foreground break-all">
                    {memory.id}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Media preview */}
          {mediaFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>媒体文件（{mediaFiles.length} 个）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Photos */}
                {photos.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">照片</div>
                    <div className="flex flex-wrap gap-3">
                      {photos.map((f) => {
                        const paired = liveVideos.find((v) =>
                          v.name.startsWith(f.name.replace(/\.[^.]+$/, '')),
                        )
                        return (
                          <div key={f.name} className="space-y-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={f.url}
                              alt={f.name}
                              className="h-48 w-auto rounded-lg object-cover border"
                            />
                            {paired && (
                              <video
                                src={paired.url}
                                controls
                                muted
                                className="h-12 w-full rounded-lg"
                                title="实况视频"
                              />
                            )}
                            <div className="text-xs text-muted-foreground truncate max-w-40">
                              {f.name}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Videos */}
                {videos.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">视频</div>
                    <div className="space-y-3">
                      {videos.map((f) => (
                        <div key={f.name} className="space-y-1">
                          <video
                            src={f.url}
                            controls
                            className="max-h-64 w-full rounded-lg border"
                          />
                          <div className="text-xs text-muted-foreground">{f.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio */}
                {audios.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">语音</div>
                    <div className="space-y-3">
                      {audios.map((f) => (
                        <div key={f.name} className="space-y-1">
                          <audio src={f.url} controls className="w-full" />
                          <div className="text-xs text-muted-foreground">{f.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: actions */}
        <div className="space-y-4">
          {/* Moderation */}
          <Card>
            <CardHeader>
              <CardTitle>审核操作</CardTitle>
            </CardHeader>
            <CardContent>
              <ModerationPanel
                memoryId={id}
                initialStatus={memory.moderation_status ?? 'approved'}
                initialNote={memory.moderation_note ?? ''}
              />
            </CardContent>
          </Card>

          {/* Seal management */}
          <Card>
            <CardHeader>
              <CardTitle>封存管理</CardTitle>
            </CardHeader>
            <CardContent>
              <SealPanel
                memoryId={id}
                initialSealed={memory.sealed}
                initialSealUntil={memory.seal_until}
                initialSealLabel={memory.seal_label}
              />
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">危险操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                删除后记录和媒体文件将被永久清除，无法恢复。
              </p>
              <DeleteButton memoryId={id} familyId={memory.family_id} title={memory.title} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
