import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { SupportSearchBar } from './_components/search-bar'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PHONE_RE = /^(\+?86)?1[3-9]\d{9}$/

function detectType(q: string): 'uuid' | 'invite_code' | 'email' | 'phone' | 'text' {
  const t = q.trim()
  if (UUID_RE.test(t)) return 'uuid'
  if (/^[0-9A-Za-z]{6,10}$/.test(t) && !/[@.]/.test(t)) return 'invite_code'
  if (t.includes('@')) return 'email'
  if (PHONE_RE.test(t.replace(/[-\s]/g, ''))) return 'phone'
  return 'text'
}

function normalizePhone(t: string) {
  const digits = t.replace(/\D/g, '')
  if (digits.length === 11) return `+86${digits}`
  if (digits.length === 13 && digits.startsWith('86')) return `+${digits}`
  return t
}

async function findUsersByPhone(phone: string): Promise<User[]> {
  const normalized = normalizePhone(phone)
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  return (data?.users ?? []).filter((u) => u.phone === normalized)
}

async function findUsersByEmail(email: string): Promise<User[]> {
  const lower = email.toLowerCase()
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  return (data?.users ?? []).filter((u) => u.email?.toLowerCase() === lower)
}

type EnrichedUser = User & {
  profile: { username: string | null; generated_email: string | null; role: string } | null
}

async function enrichWithProfile(users: User[]): Promise<EnrichedUser[]> {
  if (!users.length) return []
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, username, generated_email, role')
    .in('id', users.map((u) => u.id))
  const pm = new Map((profiles ?? []).map((p: { id: string; username: string | null; generated_email: string | null; role: string }) => [p.id, p]))
  return users.map((u) => ({ ...u, profile: pm.get(u.id) ?? null }))
}

type FamilyRow = { id: string; invite_code: string; created_at: string; created_by: string }

async function runSearch(q: string): Promise<{
  type: string
  users: EnrichedUser[]
  families: FamilyRow[]
}> {
  const t = q.trim()
  const kind = detectType(t)

  if (kind === 'uuid') {
    const [userRes, familyRes] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(t),
      supabaseAdmin.from('families').select('id, invite_code, created_at, created_by').eq('id', t).maybeSingle(),
    ])
    const users = userRes.data.user ? [userRes.data.user] : []
    return {
      type: 'UUID',
      users: await enrichWithProfile(users),
      families: familyRes.data ? [familyRes.data] : [],
    }
  }

  if (kind === 'invite_code') {
    const { data: family } = await supabaseAdmin
      .from('families')
      .select('id, invite_code, created_at, created_by')
      .eq('invite_code', t.toUpperCase())
      .maybeSingle()
    if (family) return { type: '邀请码', users: [], families: [family] }
    // fall through to text search
  }

  if (kind === 'email') {
    const [byEmail, profileRes] = await Promise.all([
      findUsersByEmail(t),
      supabaseAdmin.from('profiles').select('id').ilike('generated_email', `%${t}%`).limit(10),
    ])
    const foundIds = new Set(byEmail.map((u) => u.id))
    const extraIds = (profileRes.data ?? []).filter((p: { id: string }) => !foundIds.has(p.id)).map((p: { id: string }) => p.id)
    const extras = await Promise.all(
      extraIds.map((id: string) =>
        supabaseAdmin.auth.admin.getUserById(id).then((r) => r.data.user).catch(() => null)
      )
    )
    const all = [...byEmail, ...extras.filter((u): u is User => u !== null)]
    return { type: '邮箱', users: await enrichWithProfile(all), families: [] }
  }

  if (kind === 'phone') {
    const users = await findUsersByPhone(t)
    return {
      type: '手机号',
      users: await enrichWithProfile(users),
      families: [],
    }
  }

  // text: username search
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('username', `%${t}%`)
    .limit(20)
  const authUsers = await Promise.all(
    (profiles ?? []).map((p: { id: string }) =>
      supabaseAdmin.auth.admin.getUserById(p.id).then((r) => r.data.user).catch(() => null)
    )
  )
  return {
    type: '用户名',
    users: await enrichWithProfile(authUsers.filter((u): u is User => u !== null)),
    families: [],
  }
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const trimmed = q.trim()
  const result = trimmed ? await runSearch(trimmed) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">客服工具 — 全局搜索</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          支持手机号、邮箱、用户名、邀请码、user_id、family_id
        </p>
      </div>

      <SupportSearchBar defaultValue={trimmed || undefined} action="/support" />

      {trimmed && !result && (
        <p className="text-sm text-muted-foreground">搜索中…</p>
      )}

      {result && (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>识别类型：</span>
            <Badge variant="outline">{result.type}</Badge>
            <span>
              找到 {result.users.length} 个用户，{result.families.length} 个家庭
            </span>
          </div>

          {result.users.length === 0 && result.families.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                未找到与「{trimmed}」匹配的用户或家庭
              </CardContent>
            </Card>
          )}

          {result.users.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>用户</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">用户名</th>
                      <th className="p-3">手机号 / 邮箱</th>
                      <th className="p-3">角色</th>
                      <th className="p-3">状态</th>
                      <th className="p-3">注册时间</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.users.map((u) => {
                      const isBanned =
                        u.banned_until && new Date(u.banned_until) > new Date()
                      const contact =
                        u.phone ||
                        u.email ||
                        u.profile?.generated_email ||
                        '—'
                      return (
                        <tr key={u.id} className="border-b hover:bg-muted/40">
                          <td className="p-3">
                            <div className="font-medium">
                              {u.profile?.username ?? (
                                <span className="text-muted-foreground">未设置</span>
                              )}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {u.id.slice(0, 8)}…
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{contact}</td>
                          <td className="p-3">{u.profile?.role ?? '—'}</td>
                          <td className="p-3">
                            {isBanned ? (
                              <Badge variant="destructive">已封禁</Badge>
                            ) : u.is_anonymous ? (
                              <Badge variant="outline">匿名</Badge>
                            ) : (
                              <Badge variant="secondary">正常</Badge>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString('zh-CN')}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Link href={`/support/user/${u.id}`}>
                                <Button variant="default" size="sm">
                                  客服视图
                                </Button>
                              </Link>
                              <Link href={`/users/${u.id}`}>
                                <Button variant="outline" size="sm">
                                  用户详情
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {result.families.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>家庭</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">家庭 ID</th>
                      <th className="p-3">邀请码</th>
                      <th className="p-3">创建时间</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.families.map((f) => (
                      <tr key={f.id} className="border-b hover:bg-muted/40">
                        <td className="p-3 font-mono text-xs text-muted-foreground">
                          {f.id}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="font-mono tracking-wider">
                            {f.invite_code}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(f.created_at).toLocaleString('zh-CN')}
                        </td>
                        <td className="p-3">
                          <Link href={`/families/${f.id}`}>
                            <Button variant="outline" size="sm">
                              家庭详情
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!trimmed && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-base">在上方输入关键词开始搜索</p>
            <p className="mt-2 text-xs">
              支持：手机号 · 邮箱 · 用户名 · 邀请码（8位）· user_id（UUID）· family_id（UUID）
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 flex gap-4">
        <Link href="/support/push-diagnose">
          <Button variant="outline">推送诊断工具 →</Button>
        </Link>
        <Link href="/support/repair">
          <Button variant="outline">数据修复工具箱 →</Button>
        </Link>
      </div>
    </div>
  )
}
