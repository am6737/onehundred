'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { deleteMemory } from '../../_actions'

export function DeleteButton({
  memoryId,
  familyId,
  title,
}: {
  memoryId: string
  familyId: string
  title: string
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  function handleClick() {
    if (
      !window.confirm(
        `确认删除记录「${title}」？\n此操作不可撤销，记录和所有媒体文件将被永久删除。`,
      )
    )
      return
    start(async () => {
      await deleteMemory(memoryId, familyId)
      router.push('/content')
    })
  }

  return (
    <Button variant="destructive" size="sm" className="w-full" disabled={pending} onClick={handleClick}>
      {pending ? '删除中…' : '删除此记录'}
    </Button>
  )
}
