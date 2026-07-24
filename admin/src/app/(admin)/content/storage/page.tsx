import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface FamilyStorageStat {
  familyId: string
  inviteCode: string
  memoryDirs: string[]
  fileCount: number
  orphanDirs: string[]
}

async function listStorageDirs(): Promise<string[]> {
  // List top-level directories (family UUIDs) in memories bucket
  const { data, error } = await supabaseAdmin.storage.from('memories').list('', {
    limit: 500,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error || !data) return []
  return data.filter((f) => !f.id).map((f) => f.name) // folders have no id
}

async function listMemoryDirs(familyId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.storage.from('memories').list(familyId, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })
  return (data ?? []).filter((f) => !f.id).map((f) => f.name)
}

async function countFiles(familyId: string, memoryId: string): Promise<number> {
  const { data } = await supabaseAdmin.storage
    .from('memories')
    .list(`${familyId}/${memoryId}`, { limit: 100 })
  return data?.length ?? 0
}

export default async function StoragePage() {
  // List all family directories in Storage
  const familyDirs = await listStorageDirs()

  if (familyDirs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/content">
            <Button variant="ghost" size="sm">
              ← 返回列表
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">媒体存储概览</h1>
        </div>
        <p className="text-muted-foreground text-sm">Storage 中暂无文件。</p>
      </div>
    )
  }

  // Fetch family info for known IDs
  const { data: families } = await supabaseAdmin
    .from('families')
    .select('id, invite_code')
    .in('id', familyDirs)

  const familyMap = new Map((families ?? []).map((f) => [f.id, f.invite_code]))

  // For each family dir, list memory subdirs and count files
  // Also fetch existing memory IDs from DB to detect orphans
  const stats: FamilyStorageStat[] = []
  let totalFiles = 0
  let totalOrphans = 0

  for (const familyId of familyDirs) {
    const memoryDirs = await listMemoryDirs(familyId)

    // Check which memory dirs have DB records
    const { data: dbMemories } = memoryDirs.length
      ? await supabaseAdmin
          .from('memories')
          .select('id')
          .eq('family_id', familyId)
          .in('id', memoryDirs)
      : { data: [] }

    const dbIds = new Set((dbMemories ?? []).map((m) => m.id))
    const orphanDirs = memoryDirs.filter((d) => !dbIds.has(d))

    // Count files (only for non-empty, limit calls)
    let fileCount = 0
    for (const mid of memoryDirs) {
      fileCount += await countFiles(familyId, mid)
    }

    totalFiles += fileCount
    totalOrphans += orphanDirs.length

    stats.push({
      familyId,
      inviteCode: familyMap.get(familyId) ?? '未知',
      memoryDirs,
      fileCount,
      orphanDirs,
    })
  }

  // Sort by file count desc
  stats.sort((a, b) => b.fileCount - a.fileCount)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/content">
          <Button variant="ghost" size="sm">
            ← 返回列表
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">媒体存储概览</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>家庭目录数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{familyDirs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>文件总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{totalFiles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>孤立目录数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-amber-500">{totalOrphans}</div>
            <div className="mt-1 text-xs text-muted-foreground">Storage 有文件但 DB 无记录</div>
          </CardContent>
        </Card>
      </div>

      {/* Per-family table */}
      <Card>
        <CardHeader>
          <CardTitle>按家庭明细</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">家庭邀请码</TableHead>
                <TableHead>家庭 ID</TableHead>
                <TableHead>记录目录数</TableHead>
                <TableHead>文件总数</TableHead>
                <TableHead>孤立目录</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s) => (
                <TableRow key={s.familyId}>
                  <TableCell className="pl-4">
                    <Badge variant="outline" className="font-mono tracking-wider">
                      {s.inviteCode}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.familyId.slice(0, 8)}…
                  </TableCell>
                  <TableCell>{s.memoryDirs.length}</TableCell>
                  <TableCell>{s.fileCount}</TableCell>
                  <TableCell>
                    {s.orphanDirs.length > 0 ? (
                      <details>
                        <summary className="cursor-pointer text-amber-600 hover:text-amber-500 text-sm">
                          {s.orphanDirs.length} 个
                        </summary>
                        <ul className="mt-1 space-y-0.5">
                          {s.orphanDirs.map((d) => (
                            <li key={d} className="font-mono text-xs text-muted-foreground">
                              {d}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/families/${s.familyId}`}>
                      <Button variant="outline" size="xs">
                        家庭详情
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
