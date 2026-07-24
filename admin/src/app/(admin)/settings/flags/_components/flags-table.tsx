'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { updateFlag, createFlag, deleteFlag } from '../_actions'

type FlagRow = { key: string; enabled: boolean; description: string; updated_at: string }

function ToggleButton({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  const [optimisticEnabled, setOptimistic] = useOptimistic(enabled)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle() {
    const next = !optimisticEnabled
    setError(null)
    start(async () => {
      setOptimistic(next)
      try {
        await updateFlag(flagKey, next)
      } catch (e) {
        setOptimistic(!next)
        setError(e instanceof Error ? e.message : '操作失败')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={optimisticEnabled}
        disabled={pending}
        onClick={handleToggle}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
          optimisticEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`pointer-events-none block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
            optimisticEnabled ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

function DeleteFlagButton({ flagKey }: { flagKey: string }) {
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)

  function handleDelete() {
    start(async () => {
      try {
        await deleteFlag(flagKey)
        setOpen(false)
      } catch {
        // error will be visible via revalidation
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon-xs">
            <Trash2Icon />
          </Button>
        }
      />
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>删除功能开关</AlertDialogTitle>
          <AlertDialogDescription>
            确认删除 <code className="font-mono">{flagKey}</code>？此操作不可撤销，将记入审计日志。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? '删除中…' : '确认删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CreateFlagSheet({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [pending, start] = useTransition()

  function handleSave() {
    if (!key.trim()) {
      setStatus({ type: 'err', msg: '键名不能为空' })
      return
    }
    setStatus(null)
    start(async () => {
      try {
        await createFlag(key.trim(), description.trim())
        setStatus({ type: 'ok', msg: '已创建' })
        setTimeout(onClose, 800)
      } catch (e) {
        setStatus({ type: 'err', msg: e instanceof Error ? e.message : '创建失败' })
      }
    })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
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
          <Label>键名</Label>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="如 new_onboarding_flow"
          />
          <p className="text-xs text-muted-foreground">建议使用 snake_case，不可重复</p>
        </div>
        <div className="space-y-1.5">
          <Label>说明</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简短描述该开关的用途"
          />
        </div>
        <p className="text-xs text-muted-foreground">新开关默认为开启状态</p>
      </div>
      <div className="flex gap-2 justify-end border-t p-4">
        <Button variant="outline" onClick={onClose}>取消</Button>
        <Button disabled={pending} onClick={handleSave}>
          {pending ? '创建中…' : '创建'}
        </Button>
      </div>
    </div>
  )
}

export function FlagsTable({ rows }: { rows: FlagRow[] }) {
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {rows.length} 个开关</span>
        <Button size="sm" onClick={() => setCreating(true)}>
          <PlusIcon />
          新增开关
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="p-3 font-medium">键名</th>
              <th className="p-3 font-medium">说明</th>
              <th className="p-3 font-medium">状态</th>
              <th className="p-3 font-medium">更新时间</th>
              <th className="p-3 font-medium">开关</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b hover:bg-muted/30 transition-colors">
                <td className="p-3">
                  <code className="font-mono text-xs">{row.key}</code>
                </td>
                <td className="p-3 text-muted-foreground">{row.description || '—'}</td>
                <td className="p-3">
                  <Badge variant={row.enabled ? 'secondary' : 'outline'}>
                    {row.enabled ? '已开启' : '已关闭'}
                  </Badge>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(row.updated_at).toLocaleString('zh-CN')}
                </td>
                <td className="p-3">
                  <ToggleButton flagKey={row.key} enabled={row.enabled} />
                </td>
                <td className="p-3">
                  <DeleteFlagButton flagKey={row.key} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  暂无功能开关
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>新增功能开关</SheetTitle>
          </SheetHeader>
          <CreateFlagSheet onClose={() => setCreating(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
