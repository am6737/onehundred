'use client'

import { useState, useTransition } from 'react'
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
import { PencilIcon, PlusIcon, Trash2Icon, EyeIcon, EyeOffIcon } from 'lucide-react'
import { updateConfig, createConfig, deleteConfig } from '../_actions'

type ConfigRow = { key: string; value: string; updated_at: string }

const SENSITIVE_KEYS = ['notify_secret']

const PRESET_KEYS = [
  { key: 'maintenance_mode', hint: '维护模式 (true/false)' },
  { key: 'maintenance_message', hint: '维护提示文字' },
  { key: 'min_app_version', hint: '最低 App 版本 (如 1.2.0)' },
  { key: 'force_update', hint: '是否强制更新 (true/false)' },
]

function MaskedValue({ value }: { value: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-xs">{show ? value : '••••••••'}</span>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
      </button>
    </span>
  )
}

function EditSheet({
  row,
  onClose,
}: {
  row: ConfigRow
  onClose: () => void
}) {
  const [value, setValue] = useState(row.value)
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [pending, start] = useTransition()
  const isSensitive = SENSITIVE_KEYS.includes(row.key)

  function handleSave() {
    setStatus(null)
    start(async () => {
      try {
        await updateConfig(row.key, value.trim())
        setStatus({ type: 'ok', msg: '已保存' })
        setTimeout(onClose, 800)
      } catch (e) {
        setStatus({ type: 'err', msg: e instanceof Error ? e.message : '保存失败' })
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
          <Input value={row.key} readOnly className="bg-muted/40" />
        </div>
        <div className="space-y-1.5">
          <Label>值{isSensitive && <Badge variant="outline" className="ml-2 text-xs">敏感</Badge>}</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type={isSensitive ? 'password' : 'text'}
            placeholder="配置值"
          />
          {isSensitive && (
            <p className="text-xs text-muted-foreground">此字段值将在审计日志中脱敏记录</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 justify-end border-t p-4">
        <Button variant="outline" onClick={onClose}>取消</Button>
        <Button disabled={pending} onClick={handleSave}>
          {pending ? '保存中…' : '保存'}
        </Button>
      </div>
    </div>
  )
}

function CreateSheet({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [pending, start] = useTransition()
  const isSensitive = SENSITIVE_KEYS.includes(key)

  function handleSave() {
    if (!key.trim()) {
      setStatus({ type: 'err', msg: '键名不能为空' })
      return
    }
    setStatus(null)
    start(async () => {
      try {
        await createConfig(key.trim(), value.trim())
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
            placeholder="如 maintenance_mode"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PRESET_KEYS.map((p) => (
              <button
                key={p.key}
                type="button"
                className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                onClick={() => setKey(p.key)}
                title={p.hint}
              >
                {p.key}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>值{isSensitive && <Badge variant="outline" className="ml-2 text-xs">敏感</Badge>}</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type={isSensitive ? 'password' : 'text'}
            placeholder="配置值"
          />
        </div>
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

function DeleteButton({ configKey }: { configKey: string }) {
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)

  function handleDelete() {
    start(async () => {
      try {
        await deleteConfig(configKey)
        setOpen(false)
      } catch {
        // error shown via revalidation
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
          <AlertDialogTitle>删除配置项</AlertDialogTitle>
          <AlertDialogDescription>
            确认删除 <code className="font-mono">{configKey}</code>？此操作不可撤销，将记入审计日志。
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

export function ConfigTable({ rows }: { rows: ConfigRow[] }) {
  const [editRow, setEditRow] = useState<ConfigRow | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {rows.length} 项</span>
        <Button size="sm" onClick={() => setCreating(true)}>
          <PlusIcon />
          新增配置
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="p-3 font-medium">键名</th>
              <th className="p-3 font-medium">值</th>
              <th className="p-3 font-medium">更新时间</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSensitive = SENSITIVE_KEYS.includes(row.key)
              return (
                <tr key={row.key} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <code className="font-mono text-xs">{row.key}</code>
                    {isSensitive && (
                      <Badge variant="outline" className="ml-2 text-xs">敏感</Badge>
                    )}
                  </td>
                  <td className="p-3 max-w-[300px]">
                    {isSensitive ? (
                      <MaskedValue value={row.value} />
                    ) : (
                      <span className="break-all font-mono text-xs text-muted-foreground">
                        {row.value}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(row.updated_at).toLocaleString('zh-CN')}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setEditRow(row)}
                      >
                        <PencilIcon />
                      </Button>
                      <DeleteButton configKey={row.key} />
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  暂无配置项
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!editRow} onOpenChange={(o) => { if (!o) setEditRow(null) }}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>编辑配置 — {editRow?.key}</SheetTitle>
          </SheetHeader>
          {editRow && (
            <EditSheet row={editRow} onClose={() => setEditRow(null)} />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>新增配置项</SheetTitle>
          </SheetHeader>
          <CreateSheet onClose={() => setCreating(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
