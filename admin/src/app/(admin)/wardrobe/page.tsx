import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EditWardrobeButton, CreateWardrobeButton } from './_components/wardrobe-sheet'

const SPECIES_LABELS: Record<string, string> = {
  bear: '小熊',
  dog: '小狗',
  cat: '小猫',
}

const STAGE_LABELS: Record<number, string> = {
  1: '幼崽',
  2: '少年',
  3: '成年',
}

export default async function WardrobePage() {
  const [wardrobeResult, mascotsResult] = await Promise.all([
    supabaseAdmin
      .from('wardrobe')
      .select('id, name, slot, at, line')
      .order('at', { ascending: true }),
    supabaseAdmin
      .from('mascots')
      .select('species, grown, stage'),
  ])

  const items = wardrobeResult.data ?? []
  const mascots = mascotsResult.data ?? []

  // 统计物种分布
  const speciesCount: Record<string, number> = {}
  for (const m of mascots) {
    speciesCount[m.species] = (speciesCount[m.species] ?? 0) + 1
  }

  // 平均经验值
  const avgGrown =
    mascots.length > 0
      ? (mascots.reduce((s, m) => s + m.grown, 0) / mascots.length).toFixed(1)
      : '0.0'

  // 成长阶段分布
  const stageCount: Record<number, number> = {}
  for (const m of mascots) {
    stageCount[m.stage] = (stageCount[m.stage] ?? 0) + 1
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">衣橱管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">共 {items.length} 套装扮</p>
        </div>
        <CreateWardrobeButton />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">ID</th>
                  <th className="p-3 font-medium">名称</th>
                  <th className="p-3 font-medium">部位</th>
                  <th className="p-3 font-medium">解锁门槛</th>
                  <th className="p-3 font-medium">描述</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-3 font-mono text-xs text-muted-foreground">{item.id}</td>
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-muted-foreground text-xs">{item.slot}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        ≥ {item.at} 条
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground max-w-xs">
                      <span className="line-clamp-2 text-xs">{item.line}</span>
                    </td>
                    <td className="p-3">
                      <EditWardrobeButton
                        item={{
                          id: item.id,
                          name: item.name,
                          slot: item.slot,
                          at: item.at,
                          line: item.line,
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      暂无装扮数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 吉祥物统计 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">吉祥物统计</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">物种分布</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(speciesCount).length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              ) : (
                Object.entries(speciesCount).map(([species, count]) => (
                  <div key={species} className="flex items-center justify-between text-sm">
                    <span>{SPECIES_LABELS[species] ?? species}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">平均经验值</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgGrown}</div>
              <p className="text-xs text-muted-foreground mt-1">共 {mascots.length} 只吉祥物</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">成长阶段分布</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(stageCount).length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              ) : (
                Object.entries(stageCount)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([stage, count]) => (
                    <div key={stage} className="flex items-center justify-between text-sm">
                      <span>{STAGE_LABELS[Number(stage)] ?? `阶段 ${stage}`}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
