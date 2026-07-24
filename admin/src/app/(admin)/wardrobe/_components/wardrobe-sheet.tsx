'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PencilIcon, PlusIcon } from 'lucide-react'
import { updateWardrobe, createWardrobe, type WardrobeInput } from '../_actions'

export type WardrobeRow = {
  id: string
  name: string
  slot: string
  at: number
  line: string
}

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring transition-colors'

function WardrobeForm({
  initial,
  idEditable,
  onSave,
  onCancel,
}: {
  initial: WardrobeRow
  idEditable: boolean
  onSave: (id: string, data: WardrobeInput) => Promise<void>
  onCancel: () => void
}) {
  const [id, setId] = useState(initial.id)
  const [name, setName] = useState(initial.name)
  const [slot, setSlot] = useState(initial.slot)
  const [at, setAt] = useState(initial.at)
  const [line, setLine] = useState(initial.line)
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [pending, start] = useTransition()

  function handleSave() {
    if (!id.trim()) {
      setStatus({ type: 'err', msg: 'ID 不能为空' })
      return
    }
    if (!name.trim()) {
      setStatus({ type: 'err', msg: '名称不能为空' })
      return
    }
    if (at < 0) {
      setStatus({ type: 'err', msg: '解锁门槛不能为负数' })
      return
    }
    setStatus(null)
    start(async () => {
      try {
        await onSave(id.trim(), { name: name.trim(), slot: slot.trim(), at, line: line.trim() })
        setStatus({ type: 'ok', msg: '保存成功' })
      } catch (e) {
        setStatus({ type: 'err', msg: e instanceof Error ? e.message : '保存失败' })
      }
    })
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {status && (
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              status.type === 'ok'
                ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
            }`}
          >
            {status.msg}
          </div>
        )}

        <div className="space-y-1.5">
          <Label>ID</Label>
          {idEditable ? (
            <Input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="如 hat_basic"
            />
          ) : (
            <div className="font-mono text-sm text-muted-foreground px-1">{id}</div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>名称</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="装扮名称"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>部位（slot）</Label>
            <Input
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              placeholder="如 hat、body"
            />
          </div>
          <div className="space-y-1.5">
            <Label>解锁门槛（条记录数）</Label>
            <Input
              type="number"
              min={0}
              value={at}
              onChange={(e) => setAt(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>描述</Label>
          <textarea
            value={line}
            onChange={(e) => setLine(e.target.value)}
            rows={3}
            className={fieldClass + ' resize-none'}
            placeholder="解锁后展示的文案..."
          />
        </div>
      </div>

      <div className="border-t p-4 flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button disabled={pending} onClick={handleSave}>
          {pending ? '保存中…' : '保存'}
        </Button>
      </div>
    </>
  )
}

export function EditWardrobeButton({ item }: { item: WardrobeRow }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="xs" onClick={() => setOpen(true)}>
        <PencilIcon />
        编辑
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>编辑装扮</SheetTitle>
          </SheetHeader>
          <WardrobeForm
            initial={item}
            idEditable={false}
            onSave={updateWardrobe}
            onCancel={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

export function CreateWardrobeButton() {
  const [open, setOpen] = useState(false)

  const initial: WardrobeRow = {
    id: '',
    name: '',
    slot: '',
    at: 10,
    line: '',
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        新增装扮
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>新增装扮</SheetTitle>
          </SheetHeader>
          <WardrobeForm
            initial={initial}
            idEditable
            onSave={createWardrobe}
            onCancel={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
