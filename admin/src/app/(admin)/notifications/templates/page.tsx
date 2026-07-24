import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  EditTemplateButton,
  CreateTemplateButton,
} from './_components/template-sheet'

const PER_PAGE = 30

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string; species?: string; lang?: string; page?: string }>
}) {
  const { scene, species, lang, page: pageStr } = await searchParams
  const currentPage = Math.max(1, Number(pageStr ?? 1))
  const from = (currentPage - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  let query = supabaseAdmin
    .from('notification_templates')
    .select('*', { count: 'exact' })
    .order('scene')
    .order('species')
    .order('lang')
    .order('sort_order')
    .range(from, to)

  if (scene) query = query.eq('scene', scene)
  if (species) query = query.eq('species', species)
  if (lang) query = query.eq('lang', lang)

  const [{ data: templates, count }, allRes] = await Promise.all([
    query,
    supabaseAdmin.from('notification_templates').select('scene, species, lang'),
  ])

  const allRows = allRes.data ?? []
  const uniqueScenes = [...new Set(allRows.map((r) => r.scene))].sort()
  const uniqueSpecies = [...new Set(allRows.map((r) => r.species))].sort()
  const uniqueLangs = [...new Set(allRows.map((r) => r.lang))].sort()

  const total = count ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)

  function filterHref(params: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const merged = { scene, species, lang, ...params }
    if (merged.scene) p.set('scene', merged.scene)
    if (merged.species) p.set('species', merged.species)
    if (merged.lang) p.set('lang', merged.lang)
    const qs = p.toString()
    return qs ? `?${qs}` : '?'
  }

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (scene) params.set('scene', scene)
    if (species) params.set('species', species)
    if (lang) params.set('lang', lang)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">通知模板</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">共 {total} 条</span>
          <CreateTemplateButton />
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-muted-foreground self-center">场景：</span>
        <Link href={filterHref({ scene: undefined, page: undefined })}>
          <Badge variant={!scene ? 'secondary' : 'outline'} className="cursor-pointer">全部</Badge>
        </Link>
        {uniqueScenes.map((s) => (
          <Link key={s} href={filterHref({ scene: s, page: undefined })}>
            <Badge variant={scene === s ? 'secondary' : 'outline'} className="cursor-pointer">{s}</Badge>
          </Link>
        ))}

        <span className="text-muted-foreground self-center ml-4">物种：</span>
        <Link href={filterHref({ species: undefined, page: undefined })}>
          <Badge variant={!species ? 'secondary' : 'outline'} className="cursor-pointer">全部</Badge>
        </Link>
        {uniqueSpecies.map((sp) => (
          <Link key={sp} href={filterHref({ species: sp, page: undefined })}>
            <Badge variant={species === sp ? 'secondary' : 'outline'} className="cursor-pointer">{sp}</Badge>
          </Link>
        ))}

        <span className="text-muted-foreground self-center ml-4">语言：</span>
        <Link href={filterHref({ lang: undefined, page: undefined })}>
          <Badge variant={!lang ? 'secondary' : 'outline'} className="cursor-pointer">全部</Badge>
        </Link>
        {uniqueLangs.map((l) => (
          <Link key={l} href={filterHref({ lang: l, page: undefined })}>
            <Badge variant={lang === l ? 'secondary' : 'outline'} className="cursor-pointer">{l}</Badge>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">场景</th>
                  <th className="p-3 font-medium">物种</th>
                  <th className="p-3 font-medium">语言</th>
                  <th className="p-3 font-medium">标题</th>
                  <th className="p-3 font-medium">正文预览</th>
                  <th className="p-3 font-medium">排序</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {(templates ?? []).map((t) => (
                  <tr key={t.id} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-3">
                      <Badge variant="outline">{t.scene}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{t.species}</td>
                    <td className="p-3">
                      <Badge variant="secondary">{t.lang}</Badge>
                    </td>
                    <td className="p-3 font-medium max-w-[200px] truncate">{t.title}</td>
                    <td className="p-3 text-muted-foreground max-w-[300px] truncate">
                      {t.body.slice(0, 80)}{t.body.length > 80 ? '…' : ''}
                    </td>
                    <td className="p-3 text-muted-foreground text-center">{t.sort_order}</td>
                    <td className="p-3">
                      <EditTemplateButton template={t} />
                    </td>
                  </tr>
                ))}
                {(!templates || templates.length === 0) && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      暂无模板
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
          {currentPage > 1 && (
            <Link href={pageHref(currentPage - 1)}>
              <span className="text-sm underline cursor-pointer">上一页</span>
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            第 {currentPage} / {totalPages} 页
          </span>
          {currentPage < totalPages && (
            <Link href={pageHref(currentPage + 1)}>
              <span className="text-sm underline cursor-pointer">下一页</span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
