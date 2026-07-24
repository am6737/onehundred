'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { deactivateToken } from '../_actions'

export function DeactivateButton({ tokenId }: { tokenId: string }) {
  const [pending, start] = useTransition()

  function handleClick() {
    if (!window.confirm('确认停用此邀记令牌？停用后对方无法再通过该链接填写回忆。')) return
    start(async () => {
      await deactivateToken(tokenId)
    })
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      className="w-full"
      disabled={pending}
      onClick={handleClick}
    >
      {pending ? '停用中…' : '停用令牌'}
    </Button>
  )
}
