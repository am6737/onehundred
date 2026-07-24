import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchBar } from './_components/search-bar'

export default async function KidsPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; family?: string; page?: string }>
}) {
  const { name: nameQ = '', family: familyQ = '', page: pageStr = '1' } =
    await searchParams
  const page = Math.max(1, parseInt(pageStr) || 1)
  const pageSize = 20

  // Resolve family filter: could be invite_code prefix or partial UUID
  let familyIdFilter: string | null = null
  if (familyQ.trim()) {
    const fq = familyQ.trim()
    const { data: matchedFamilies } = await supabaseAdmin
      .from('families')
      .select('id')
      .or(`invite_code.ilike.%${fq}%,id.ilike.%${fq}%`)
      .limit(50)
    if (matchedFamilies && matchedFamilies.length === 1) {
      familyIdFilter = matchedFamilies[0].id
    } else if (matchedFamilies && matchedFamilies.length > 1) {
      // Multiple matches; use them all
      familyIdFilter = matchedFamilies.map((f) => f.id).join(',')
    }
  }

  // Fetch kids
  let kidsQuery = supabaseAdmin
    .from('kids')
    .select('id, family_id, name, birth_year, birth_month, tone')
    .order('name', { ascending: true })
    .limit(2000)

  if (nameQ.trim()) {
    kidsQuery = kidsQuery.ilike('name', `%${nameQ.trim()}%`)
  }
  if (familyIdFilter) {
    if (familyIdFilter.includes(',')) {
      kidsQuery = kidsQuery.in('family_id', familyIdFilter.split(','))
    } else {
      kidsQuery = kidsQuery.eq('family_id', familyIdFilter)
    }
  }

  const { data: allKids } = await kidsQuery
  const kids = allKids ?? []

  const total = kids.length
  const totalPages = Math.ceil(total / pageSize) || 1
  const rows = kids.slice((page - 1) * pageSize, page * pageSize)

  // Fetch families for visible rows
  const familyIds = [...new Set(rows.map((k) => k.family_id))]
  const { data: families } = familyIds.length
    ? await supabaseAdmin
        .from('families')
        .select('id, invite_code, created_by')
        .in('id', familyIds)
    : { data: [] }

  const familyMap = new Map((families ?? []).map((f) => [f.id, f]))

  // Fetch memory counts for visible kids
  const kidIds = rows.map((k) => k.id)
  const { data: memoryRows } = kidIds.length
    ? await supabaseAdmin
        .from('memories')
        .select('kid_id')
        .in('kid_id', kidIds)
    : { data: [] }

  const memoryCount = new Map<string, number>()
  for (const m of memoryRows ?? [])
    memoryCount.set(m.kid_id, (memoryCount.get(m.kid_id) ?? 0) + 1)

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (nameQ) params.set('name', nameQ)
    if (familyQ) params.set('family', familyQ)
    params.set('page', String(p))
    return `/kids?${params.toString()}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">孩子档案</h1>
        <span className="text-sm text-muted-foreground">共 {total} 个孩子</span>
      </div>

      <SearchBar defaultName={nameQ} defaultFamily={familyQ} />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">名字</th>
                  <th className="p-3 font-medium">出生年月</th>
                  <th className="p-3 font-medium">配色</th>
                  <th className="p-3 font-medium">所属家庭</th>
                  <th className="p-3 font-medium">记录数</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => {
                  const fam = familyMap.get(k.family_id)
                  return (
                    <tr key={k.id} className="border-b hover:bg-muted/40 transition-colors">
                      <td className="p-3 font-medium">{k.name}</td>
                      <td className="p-3">
                        {k.birth_year} 年 {k.birth_month} 月
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{k.tone}</Badge>
                      </td>
                      <td className="p-3">
                        {fam ? (
                          <Link
                            href={`/families/${fam.id}`}
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {fam.invite_code}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">
                            {k.family_id.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="p-3">{memoryCount.get(k.id) ?? 0}</td>
                      <td className="p-3">
                        <Link href={`/kids/${k.id}`}>
                          <Button variant="outline" size="xs">
                            详情
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)}>
              <Button variant="outline" size="sm">
                上一页
              </Button>
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          {page < totalPages && (
            <Link href={pageHref(page + 1)}>
              <Button variant="outline" size="sm">
                下一页
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
