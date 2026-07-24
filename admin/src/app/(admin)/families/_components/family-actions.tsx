'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { removeMember, transferCreator, regenerateInviteCode } from '../_actions'

interface MemberInfo {
  user_id: string
  username: string | null
  role: string
  custom_role: string
}

export function RemoveMemberButton({
  familyId,
  userId,
  userName,
}: {
  familyId: string
  userId: string
  userName: string
}) {
  const [pending, start] = useTransition()

  function handleClick() {
    if (!window.confirm(`确认强制移除成员「${userName}」？该操作不可撤销。`)) return
    start(async () => {
      await removeMember(familyId, userId)
    })
  }

  return (
    <Button variant="destructive" size="xs" disabled={pending} onClick={handleClick}>
      {pending ? '处理中…' : '移除'}
    </Button>
  )
}

export function TransferCreatorButton({
  familyId,
  currentCreatorId,
  members,
}: {
  familyId: string
  currentCreatorId: string
  members: MemberInfo[]
}) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [pending, start] = useTransition()

  const candidates = members.filter((m) => m.user_id !== currentCreatorId)

  function handleSubmit() {
    if (!selectedId) return
    const target = candidates.find((m) => m.user_id === selectedId)
    const name = target?.username ?? selectedId.slice(0, 8)
    if (!window.confirm(`确认将创建者权限转移给「${name}」？`)) return
    start(async () => {
      await transferCreator(familyId, selectedId)
      setOpen(false)
      setSelectedId('')
    })
  }

  if (candidates.length === 0) return null

  return (
    <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        转移创建者
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>转移家庭创建者</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-4 p-4">
            <p className="text-sm text-muted-foreground">选择新的创建者（当前创建者将降为普通成员）：</p>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring"
            >
              <option value="">— 请选择成员 —</option>
              {candidates.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.username ?? '未知用户'} ({m.custom_role || m.role})
                </option>
              ))}
            </select>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button disabled={!selectedId || pending} onClick={handleSubmit}>
              {pending ? '处理中…' : '确认转移'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

export function RegenerateInviteCodeButton({ familyId }: { familyId: string }) {
  const [pending, start] = useTransition()

  function handleClick() {
    if (!window.confirm('确认重新生成邀请码？原邀请码将立即失效，已分享的链接无法使用。')) return
    start(async () => {
      await regenerateInviteCode(familyId)
    })
  }

  return (
    <Button variant="outline" size="sm" className="w-full" disabled={pending} onClick={handleClick}>
      {pending ? '生成中…' : '重新生成邀请码'}
    </Button>
  )
}
