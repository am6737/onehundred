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
import { PlusIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { updateAdminRole, removeAdminRole, grantAdminRole, searchUserByPhone } from '../_actions'

type AdminRow = {
  id: string
  username: string | null
  admin_role: string
}

const ROLES = [
  { value: 'super_admin', label: '超级管理员' },
  { value: 'admin', label: '管理员' },
  { value: 'operator', label: '运营' },
  { value: 'support', label: '客服' },
]

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring transition-colors'

const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  super_admin: 'default',
  admin: 'secondary',
  operator: 'outline',
  support: 'outline',
}

function EditRoleSheet({ admin, onClose }: { admin: AdminRow; onClose: () => void }) {
  const [role, setRole] = useState(admin.admin_role)
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [pending, start] = useTransition()

  function handleSave() {
    setStatus(null)
    start(async () => {
      try {
        await updateAdminRole(admin.id, role)
        setStatus({ type: 'ok', msg: '已更新' })
        setTimeout(onClose, 800)
      } catch (e) {
        setStatus({ type: 'err', msg: e instanceof Error ? e.message : '操作失败' })
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
          <Label>用户</Label>
          <Input value={admin.username ?? admin.id.slice(0, 12) + '…'} readOnly className="bg-muted/40" />
        </div>
        <div className="space-y-1.5">
          <Label>角色</Label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={fieldClass}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            super_admin 拥有所有权限，包括修改其他管理员角色。
          </p>
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

type FoundUser = { id: string; phone: string | null; email: string | null; username: string | null; admin_role: string | null }

function AddAdminSheet({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<FoundUser | null | 'not_found'>(null)
  const [role, setRole] = useState('operator')
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [searchPending, startSearch] = useTransition()
  const [grantPending, startGrant] = useTransition()

  function handleSearch() {
    if (!query.trim()) return
    setFound(null)
    setStatus(null)
    startSearch(async () => {
      try {
        const result = await searchUserByPhone(query.trim())
        setFound(result ?? 'not_found')
      } catch (e) {
        setStatus({ type: 'err', msg: e instanceof Error ? e.message : '搜索失败' })
      }
    })
  }

  function handleGrant() {
    if (!found || found === 'not_found') return
    setStatus(null)
    startGrant(async () => {
      try {
        await grantAdminRole(found.id, role)
        setStatus({ type: 'ok', msg: `已授予 ${found.username ?? found.id.slice(0, 8)} ${role} 权限` })
        setTimeout(onClose, 1000)
      } catch (e) {
        setStatus({ type: 'err', msg: e instanceof Error ? e.message : '操作失败' })
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
          <Label>搜索用户（手机号 / 邮箱）</Label>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="+8613800000000 或 user@example.com"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button variant="outline" disabled={searchPending} onClick={handleSearch}>
              {searchPending ? '搜索…' : '搜索'}
            </Button>
          </div>
        </div>

        {found === 'not_found' && (
          <p className="text-sm text-muted-foreground">未找到匹配用户</p>
        )}

        {found && found !== 'not_found' && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="text-sm font-medium">{found.username ?? '未设置用户名'}</div>
            <div className="text-xs text-muted-foreground font-mono">{found.id}</div>
            {found.admin_role && (
              <Badge variant="outline">当前角色：{found.admin_role}</Badge>
            )}
          </div>
        )}

        {found && found !== 'not_found' && (
          <div className="space-y-1.5">
            <Label>授予角色</Label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={fieldClass}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end border-t p-4">
        <Button variant="outline" onClick={onClose}>取消</Button>
        <Button
          disabled={!found || found === 'not_found' || grantPending}
          onClick={handleGrant}
        >
          {grantPending ? '授权中…' : '确认授权'}
        </Button>
      </div>
    </div>
  )
}

function RemoveAdminButton({ admin }: { admin: AdminRow }) {
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)

  function handleRemove() {
    start(async () => {
      try {
        await removeAdminRole(admin.id)
        setOpen(false)
      } catch {
        // revalidation will reflect failure
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
          <AlertDialogTitle>移除管理员权限</AlertDialogTitle>
          <AlertDialogDescription>
            确认移除 <strong>{admin.username ?? admin.id.slice(0, 12)}</strong> 的管理员权限（admin_role 设为 NULL）？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={handleRemove}
          >
            {pending ? '移除中…' : '确认移除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function AdminManager({ admins }: { admins: AdminRow[] }) {
  const [editAdmin, setEditAdmin] = useState<AdminRow | null>(null)
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {admins.length} 位管理员</span>
        <Button size="sm" onClick={() => setAdding(true)}>
          <PlusIcon />
          添加管理员
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="p-3 font-medium">用户名</th>
              <th className="p-3 font-medium">用户 ID</th>
              <th className="p-3 font-medium">角色</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="p-3 font-medium">{a.username ?? <span className="text-muted-foreground">未设置</span>}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{a.id}</td>
                <td className="p-3">
                  <Badge variant={ROLE_VARIANTS[a.admin_role] ?? 'outline'}>
                    {ROLES.find((r) => r.value === a.admin_role)?.label ?? a.admin_role}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-xs" onClick={() => setEditAdmin(a)}>
                      <PencilIcon />
                    </Button>
                    <RemoveAdminButton admin={a} />
                  </div>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  暂无管理员
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!editAdmin} onOpenChange={(o) => { if (!o) setEditAdmin(null) }}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>修改管理员角色</SheetTitle>
          </SheetHeader>
          {editAdmin && (
            <EditRoleSheet admin={editAdmin} onClose={() => setEditAdmin(null)} />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>添加管理员</SheetTitle>
          </SheetHeader>
          <AddAdminSheet onClose={() => setAdding(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
