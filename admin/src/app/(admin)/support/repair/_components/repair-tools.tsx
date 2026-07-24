'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  scanOrphanedKidIds,
  fixOrphanedKidId,
  scanNullUserIdMemories,
  fixNullUserId,
  scanOrphanedMascots,
  deleteOrphanedMascots,
  scanExpiredActiveTokens,
  deactivateExpiredTokensBulk,
  scanDuplicatePhoneAccounts,
  type ScanOrphanedKidResult,
  type ScanNullUserIdResult,
  type ScanOrphanedMascotsResult,
  type ScanExpiredTokensResult,
  type ScanDuplicateAccountsResult,
} from '../_actions'

// ─── Tool 1: 修复孤立 kid_id ──────────────────────────────────────────────────

function Tool1Card() {
  const [scanPending, startScan] = useTransition()
  const [fixPending, startFix] = useTransition()
  const [results, setResults] = useState<ScanOrphanedKidResult | null>(null)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  function handleScan() {
    setMessage(null)
    startScan(async () => {
      try {
        const res = await scanOrphanedKidIds()
        setResults(res)
        setSelections({})
      } catch (e) {
        setMessage({ text: String(e), ok: false })
      }
    })
  }

  function handleFixOne(memoryId: string, title: string, newKidId: string, kidName: string) {
    if (!newKidId) return
    if (!window.confirm(`确认将记录「${title || memoryId.slice(0, 8)}」的孩子改为「${kidName}」？`)) return
    startFix(async () => {
      try {
        await fixOrphanedKidId(memoryId, newKidId)
        setResults((prev) =>
          prev ? { ...prev, orphaned: prev.orphaned.filter((m) => m.id !== memoryId) } : prev
        )
        setSelections((prev) => { const s = { ...prev }; delete s[memoryId]; return s })
        setMessage({ text: '修复成功', ok: true })
      } catch (e) {
        setMessage({ text: String(e), ok: false })
      }
    })
  }

  function handleBatchFix() {
    const toFix = Object.entries(selections).filter(([, v]) => v)
    if (toFix.length === 0) return
    if (!window.confirm(`确认批量修复 ${toFix.length} 条孤立记录？此操作将写入审计日志。`)) return
    startFix(async () => {
      try {
        for (const [memoryId, newKidId] of toFix) {
          await fixOrphanedKidId(memoryId, newKidId)
        }
        const fixedSet = new Set(toFix.map(([id]) => id))
        setResults((prev) =>
          prev ? { ...prev, orphaned: prev.orphaned.filter((m) => !fixedSet.has(m.id)) } : prev
        )
        setSelections({})
        setMessage({ text: `已批量修复 ${toFix.length} 条记录`, ok: true })
      } catch (e) {
        setMessage({ text: String(e), ok: false })
      }
    })
  }

  const orphaned = results?.orphaned ?? []
  const availableKids = results?.availableKids ?? []
  const selectedCount = Object.values(selections).filter(Boolean).length

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>修复孤立记录的孩子 ID</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            扫描 memories 中 kid_id 指向已删除孩子的记录，为其重新指定孩子
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanPending} size="sm" className="shrink-0">
          {scanPending ? '扫描中…' : '开始扫描'}
        </Button>
      </CardHeader>

      {results && (
        <CardContent className="space-y-4">
          {message && (
            <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-destructive'}`}>
              {message.text}
            </p>
          )}

          {orphaned.length === 0 ? (
            <p className="text-sm text-muted-foreground">✓ 未发现孤立记录</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  发现{' '}
                  <span className="font-semibold text-foreground">{orphaned.length}</span>{' '}
                  条孤立记录
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBatchFix}
                  disabled={fixPending || selectedCount === 0}
                >
                  {fixPending ? '处理中…' : `批量修复（${selectedCount} 条）`}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="p-2">记录标题</th>
                      <th className="p-2">当前 kid_id</th>
                      <th className="p-2">家庭</th>
                      <th className="p-2">指定孩子</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {orphaned.map((m) => {
                      const kids = availableKids.filter((k) => k.family_id === m.family_id)
                      const sel = selections[m.id] ?? ''
                      const selKid = kids.find((k) => k.id === sel)
                      return (
                        <tr key={m.id} className="border-b hover:bg-muted/30">
                          <td className="p-2">
                            <div className="font-medium">{m.title || '（无标题）'}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {m.id.slice(0, 8)}…
                            </div>
                          </td>
                          <td className="p-2 font-mono text-xs text-destructive">{m.kid_id}</td>
                          <td className="p-2 font-mono text-xs text-muted-foreground">
                            {m.family_id.slice(0, 8)}…
                          </td>
                          <td className="p-2">
                            {kids.length === 0 ? (
                              <span className="text-xs text-muted-foreground">家庭内无孩子</span>
                            ) : (
                              <select
                                value={sel}
                                onChange={(e) =>
                                  setSelections((p) => ({ ...p, [m.id]: e.target.value }))
                                }
                                className="rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus:border-ring"
                              >
                                <option value="">— 选择 —</option>
                                {kids.map((k) => (
                                  <option key={k.id} value={k.id}>
                                    {k.name}（{k.id}）
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-2">
                            <Button
                              size="xs"
                              disabled={!sel || fixPending}
                              onClick={() => handleFixOne(m.id, m.title, sel, selKid?.name ?? '')}
                            >
                              修复
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ─── Tool 2: 修复 NULL user_id ────────────────────────────────────────────────

function Tool2Card() {
  const [scanPending, startScan] = useTransition()
  const [fixPending, startFix] = useTransition()
  const [results, setResults] = useState<ScanNullUserIdResult | null>(null)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  function handleScan() {
    setMessage(null)
    startScan(async () => {
      try {
        const res = await scanNullUserIdMemories()
        setResults(res)
        setSelections({})
      } catch (e) {
        setMessage({ text: String(e), ok: false })
      }
    })
  }

  function handleFixOne(memoryId: string, title: string, userId: string, userName: string) {
    if (!userId) return
    if (!window.confirm(`确认将记录「${title || memoryId.slice(0, 8)}」关联用户「${userName}」？`)) return
    startFix(async () => {
      try {
        await fixNullUserId(memoryId, userId)
        setResults((prev) =>
          prev
            ? { ...prev, nullMemories: prev.nullMemories.filter((m) => m.id !== memoryId) }
            : prev
        )
        setSelections((prev) => { const s = { ...prev }; delete s[memoryId]; return s })
        setMessage({ text: '修复成功', ok: true })
      } catch (e) {
        setMessage({ text: String(e), ok: false })
      }
    })
  }

  function handleBatchFix() {
    const toFix = Object.entries(selections).filter(([, v]) => v)
    if (toFix.length === 0) return
    if (!window.confirm(`确认批量为 ${toFix.length} 条记录关联用户？`)) return
    startFix(async () => {
      try {
        for (const [memoryId, userId] of toFix) {
          await fixNullUserId(memoryId, userId)
        }
        const fixedSet = new Set(toFix.map(([id]) => id))
        setResults((prev) =>
          prev
            ? { ...prev, nullMemories: prev.nullMemories.filter((m) => !fixedSet.has(m.id)) }
            : prev
        )
        setSelections({})
        setMessage({ text: `已批量修复 ${toFix.length} 条记录`, ok: true })
      } catch (e) {
        setMessage({ text: String(e), ok: false })
      }
    })
  }

  const nullMemories = results?.nullMemories ?? []
  const familyMembers = results?.familyMembers ?? []
  const selectedCount = Object.values(selections).filter(Boolean).length

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>修复 user_id 为空的记录</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            扫描 memories 中 user_id IS NULL 的记录（通常是注销账号的残留），为其关联家庭成员
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanPending} size="sm" className="shrink-0">
          {scanPending ? '扫描中…' : '开始扫描'}
        </Button>
      </CardHeader>

      {results && (
        <CardContent className="space-y-4">
          {message && (
            <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-destructive'}`}>
              {message.text}
            </p>
          )}

          {nullMemories.length === 0 ? (
            <p className="text-sm text-muted-foreground">✓ 未发现 user_id 为空的记录</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  发现{' '}
                  <span className="font-semibold text-foreground">{nullMemories.length}</span>{' '}
                  条无作者记录
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBatchFix}
                  disabled={fixPending || selectedCount === 0}
                >
                  {fixPending ? '处理中…' : `批量修复（${selectedCount} 条）`}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="p-2">记录标题</th>
                      <th className="p-2">家庭</th>
                      <th className="p-2">创建时间</th>
                      <th className="p-2">关联用户</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {nullMemories.map((m) => {
                      const members = familyMembers.filter((mb) => mb.family_id === m.family_id)
                      const sel = selections[m.id] ?? ''
                      const selMember = members.find((mb) => mb.user_id === sel)
                      const selLabel = selMember
                        ? (selMember.username ?? selMember.user_id.slice(0, 8))
                        : ''
                      return (
                        <tr key={m.id} className="border-b hover:bg-muted/30">
                          <td className="p-2">
                            <div className="font-medium">{m.title || '（无标题）'}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {m.id.slice(0, 8)}…
                            </div>
                          </td>
                          <td className="p-2 font-mono text-xs text-muted-foreground">
                            {m.family_id.slice(0, 8)}…
                          </td>
                          <td className="p-2 text-xs text-muted-foreground">
                            {new Date(m.created_at).toLocaleDateString('zh-CN')}
                          </td>
                          <td className="p-2">
                            {members.length === 0 ? (
                              <span className="text-xs text-muted-foreground">家庭无成员</span>
                            ) : (
                              <select
                                value={sel}
                                onChange={(e) =>
                                  setSelections((p) => ({ ...p, [m.id]: e.target.value }))
                                }
                                className="rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus:border-ring"
                              >
                                <option value="">— 选择用户 —</option>
                                {members.map((mb) => (
                                  <option key={mb.user_id} value={mb.user_id}>
                                    {mb.username ?? mb.user_id.slice(0, 8)}（
                                    {mb.custom_role || mb.role}）
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-2">
                            <Button
                              size="xs"
                              disabled={!sel || fixPending}
                              onClick={() => handleFixOne(m.id, m.title, sel, selLabel)}
                            >
                              修复
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ─── Tool 3: 清理孤立吉祥物 ───────────────────────────────────────────────────

function Tool3Card() {
  const [scanPending, startScan] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [results, setResults] = useState<ScanOrphanedMascotsResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  function handleScan() {
    setMessage(null)
    startScan(async () => {
      try {
        const res = await scanOrphanedMascots()
        setResults(res)
        setSelected(new Set())
      } catch (e) {
        setMessage({ text: String(e), ok: false })
      }
    })
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(results?.orphaned.map((m) => m.kid_id) ?? []))
    } else {
      setSelected(new Set())
    }
  }

  function toggle(kidId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(kidId)) next.delete(kidId)
      else next.add(kidId)
      return next
    })
  }

  function handleDelete() {
    if (selected.size === 0) return
    if (
      !window.confirm(
        `确认删除 ${selected.size} 只孤立吉祥物？该操作不可撤销，将写入审计日志。`
      )
    )
      return
    const kidIds = [...selected]
    startDelete(async () => {
      try {
        const count = await deleteOrphanedMascots(kidIds)
        setResults((prev) =>
          prev
            ? { ...prev, orphaned: prev.orphaned.filter((m) => !selected.has(m.kid_id)) }
            : prev
        )
        setSelected(new Set())
        setMessage({ text: `已删除 ${count} 只孤立吉祥物`, ok: true })
      } catch (e) {
        setMessage({ text: String(e), ok: false })
      }
    })
  }

  const orphaned = results?.orphaned ?? []

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>清理孤立吉祥物</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            扫描 mascots 中 kid_id 指向已删除孩子的记录并批量清除
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanPending} size="sm" className="shrink-0">
          {scanPending ? '扫描中…' : '开始扫描'}
        </Button>
      </CardHeader>

      {results && (
        <CardContent className="space-y-4">
          {message && (
            <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-destructive'}`}>
              {message.text}
            </p>
          )}

          {orphaned.length === 0 ? (
            <p className="text-sm text-muted-foreground">✓ 未发现孤立吉祥物</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  发现{' '}
                  <span className="font-semibold text-foreground">{orphaned.length}</span>{' '}
                  只孤立吉祥物
                </p>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deletePending || selected.size === 0}
                >
                  {deletePending ? '删除中…' : `删除选中（${selected.size}）`}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="p-2">
                        <input
                          type="checkbox"
                          checked={selected.size === orphaned.length && orphaned.length > 0}
                          onChange={(e) => toggleAll(e.target.checked)}
                          className="rounded"
                        />
                      </th>
                      <th className="p-2">吉祥物名字</th>
                      <th className="p-2">种类</th>
                      <th className="p-2">孤立 kid_id</th>
                      <th className="p-2">家庭</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphaned.map((m) => (
                      <tr key={m.kid_id} className="border-b hover:bg-muted/30">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selected.has(m.kid_id)}
                            onChange={() => toggle(m.kid_id)}
                            className="rounded"
                          />
                        </td>
                        <td className="p-2 font-medium">{m.name}</td>
                        <td className="p-2">
                          <Badge variant="outline">
                            {{ bear: '小熊', dog: '小狗', cat: '小猫' }[m.species] ?? m.species}
                          </Badge>
                        </td>
                        <td className="p-2 font-mono text-xs text-destructive">{m.kid_id}</td>
                        <td className="p-2 font-mono text-xs text-muted-foreground">
                          {m.family_id.slice(0, 8)}…
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ─── Tool 4: 清理过期邀记 ─────────────────────────────────────────────────────

function Tool4Card() {
  const [scanPending, startScan] = useTransition()
  const [deactivatePending, startDeactivate] = useTransition()
  const [results, setResults] = useState<ScanExpiredTokensResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  function handleScan() {
    setMessage(null)
    startScan(async () => {
      try {
        const res = await scanExpiredActiveTokens()
        setResults(res)
        setSelected(new Set())
      } catch (e) {
        setMessage({ text: String(e), ok: false })
      }
    })
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(results?.expired.map((t) => t.id) ?? []))
    } else {
      setSelected(new Set())
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDeactivate() {
    if (selected.size === 0) return
    if (!window.confirm(`确认批量停用 ${selected.size} 条过期邀记令牌？`)) return
    const tokenIds = [...selected]
    startDeactivate(async () => {
      try {
        const count = await deactivateExpiredTokensBulk(tokenIds)
        setResults((prev) =>
          prev
            ? { ...prev, expired: prev.expired.filter((t) => !selected.has(t.id)) }
            : prev
        )
        setSelected(new Set())
        setMessage({ text: `已停用 ${count} 条过期令牌`, ok: true })
      } catch (e) {
        setMessage({ text: String(e), ok: false })
      }
    })
  }

  const expired = results?.expired ?? []

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>清理过期邀记令牌</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            扫描 invite_tokens 中 expires_at &lt; now() 但 is_active = true 的令牌并批量停用
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanPending} size="sm" className="shrink-0">
          {scanPending ? '扫描中…' : '开始扫描'}
        </Button>
      </CardHeader>

      {results && (
        <CardContent className="space-y-4">
          {message && (
            <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-destructive'}`}>
              {message.text}
            </p>
          )}

          {expired.length === 0 ? (
            <p className="text-sm text-muted-foreground">✓ 无过期仍活跃的邀记令牌</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  发现{' '}
                  <span className="font-semibold text-foreground">{expired.length}</span>{' '}
                  条过期活跃令牌
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleAll(true)}
                    disabled={deactivatePending}
                  >
                    全选
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDeactivate}
                    disabled={deactivatePending || selected.size === 0}
                  >
                    {deactivatePending ? '停用中…' : `批量停用（${selected.size}）`}
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="p-2">
                        <input
                          type="checkbox"
                          checked={selected.size === expired.length && expired.length > 0}
                          onChange={(e) => toggleAll(e.target.checked)}
                          className="rounded"
                        />
                      </th>
                      <th className="p-2">令牌 ID</th>
                      <th className="p-2">关联孩子</th>
                      <th className="p-2">活动标题</th>
                      <th className="p-2">创建时间</th>
                      <th className="p-2">过期时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expired.map((t) => (
                      <tr key={t.id} className="border-b hover:bg-muted/30">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selected.has(t.id)}
                            onChange={() => toggle(t.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="p-2 font-mono text-xs text-muted-foreground">
                          {t.id.slice(0, 8)}…
                        </td>
                        <td className="p-2">{t.kid_name ?? '—'}</td>
                        <td className="p-2 max-w-[12rem] truncate" title={t.level_title}>
                          {t.level_title}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="p-2 text-xs text-destructive">
                          {new Date(t.expires_at).toLocaleString('zh-CN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ─── Tool 5: 重复手机号账号检测 ───────────────────────────────────────────────

function Tool5Card() {
  const [scanPending, startScan] = useTransition()
  const [results, setResults] = useState<ScanDuplicateAccountsResult | null>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  function handleScan() {
    setMessage(null)
    startScan(async () => {
      try {
        const res = await scanDuplicatePhoneAccounts()
        setResults(res)
      } catch (e) {
        setMessage({ text: String(e), ok: false })
      }
    })
  }

  const groups = results?.groups ?? []

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>账号重复检测</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            检测同一手机号对应多个账号（通常是匿名升级残留），仅展示，请人工判断后在用户管理中处理
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanPending} size="sm" className="shrink-0">
          {scanPending ? '扫描中…' : '开始扫描'}
        </Button>
      </CardHeader>

      {results && (
        <CardContent className="space-y-4">
          {message && (
            <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-destructive'}`}>
              {message.text}
            </p>
          )}

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">✓ 未发现重复手机号账号</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                发现{' '}
                <span className="font-semibold text-foreground">{groups.length}</span>{' '}
                个重复手机号
              </p>
              {groups.map((g) => (
                <div key={g.phone} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono font-semibold">{g.phone}</span>
                    <Badge variant="destructive" className="text-xs">
                      {g.users.length} 个账号
                    </Badge>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-1 pr-4">用户 ID</th>
                        <th className="pb-1 pr-4">邮箱</th>
                        <th className="pb-1 pr-4">注册时间</th>
                        <th className="pb-1">类型</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.users.map((u) => (
                        <tr key={u.id} className="border-b last:border-0">
                          <td className="py-1 pr-4 font-mono text-xs text-muted-foreground">
                            {u.id.slice(0, 12)}…
                          </td>
                          <td className="py-1 pr-4 text-xs">{u.email ?? '—'}</td>
                          <td className="py-1 pr-4 text-xs text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString('zh-CN')}
                          </td>
                          <td className="py-1">
                            {u.is_anonymous ? (
                              <Badge variant="outline" className="text-xs">
                                匿名
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                正式
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export function RepairTools() {
  return (
    <div className="space-y-6">
      <Tool1Card />
      <Tool2Card />
      <Tool3Card />
      <Tool4Card />
      <Tool5Card />
    </div>
  )
}
