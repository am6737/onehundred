'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { banUser, unbanUser } from '../actions'

export function BanButton({
  userId,
  isBanned,
}: {
  userId: string
  isBanned: boolean
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      if (isBanned) {
        await unbanUser(userId)
      } else {
        await banUser(userId)
      }
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        variant={isBanned ? 'outline' : 'destructive'}
        onClick={() => setOpen(true)}
      >
        {isBanned ? '解除封禁' : '封禁用户'}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBanned ? '解除用户封禁' : '封禁用户'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBanned
                ? '确认后该用户将恢复正常访问权限。'
                : '封禁后该用户将无法登录，请确认操作。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant={isBanned ? 'default' : 'destructive'}
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? '处理中...' : isBanned ? '确认解封' : '确认封禁'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
