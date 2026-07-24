'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { updateSealStatus } from '../../_actions'

export function SealPanel({
  memoryId,
  initialSealed,
  initialSealUntil,
  initialSealLabel,
}: {
  memoryId: string
  initialSealed: boolean
  initialSealUntil: string | null
  initialSealLabel: string | null
}) {
  const [sealed, setSealed] = useState(initialSealed)
  const [sealUntil, setSealUntil] = useState(
    initialSealUntil ? initialSealUntil.slice(0, 10) : '',
  )
  const [sealLabel, setSealLabel] = useState(initialSealLabel ?? '')
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSave() {
    start(async () => {
      await updateSealStatus(
        memoryId,
        sealed,
        sealed && sealUntil ? `${sealUntil}T00:00:00Z` : null,
        sealed && sealLabel ? sealLabel : null,
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          id="seal-toggle"
          type="checkbox"
          checked={sealed}
          onChange={(e) => setSealed(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <Label htmlFor="seal-toggle" className="cursor-pointer">
          已封存
        </Label>
      </div>

      {sealed && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="seal-until">封存截止日期</Label>
            <Input
              id="seal-until"
              type="date"
              value={sealUntil}
              onChange={(e) => setSealUntil(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seal-label">封存标签</Label>
            <Input
              id="seal-label"
              value={sealLabel}
              onChange={(e) => setSealLabel(e.target.value)}
              placeholder="例：朵朵 18 岁生日"
              className="h-9 text-sm"
            />
          </div>
        </>
      )}

      <Button onClick={handleSave} disabled={pending} size="sm" className="w-full">
        {pending ? '保存中…' : saved ? '已保存 ✓' : '保存封存状态'}
      </Button>
    </div>
  )
}
