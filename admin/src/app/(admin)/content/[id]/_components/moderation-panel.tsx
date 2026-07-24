'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { updateModerationStatus } from '../../_actions'

type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'removed'

const statusOptions: { value: ModerationStatus; label: string }[] = [
  { value: 'approved', label: '已通过' },
  { value: 'pending', label: '待审核' },
  { value: 'flagged', label: '已标记' },
  { value: 'removed', label: '已移除' },
]

const selectCls =
  'w-full h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring'

export function ModerationPanel({
  memoryId,
  initialStatus,
  initialNote,
}: {
  memoryId: string
  initialStatus: ModerationStatus
  initialNote: string
}) {
  const [status, setStatus] = useState<ModerationStatus>(initialStatus)
  const [note, setNote] = useState(initialNote)
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSave() {
    start(async () => {
      await updateModerationStatus(memoryId, status, note)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="mod-status">审核状态</Label>
        <select
          id="mod-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ModerationStatus)}
          className={selectCls}
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mod-note">审核备注</Label>
        <textarea
          id="mod-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="可选备注说明…"
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={pending || (status === initialStatus && note === initialNote)}
        size="sm"
        className="w-full"
      >
        {pending ? '保存中…' : saved ? '已保存 ✓' : '保存审核'}
      </Button>
    </div>
  )
}
