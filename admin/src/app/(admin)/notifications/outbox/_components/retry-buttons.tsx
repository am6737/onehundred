'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { retryDeadJob, retryAllDeadJobs } from '../_actions'

export function RetryButton({ id }: { id: number }) {
  const [pending, start] = useTransition()

  return (
    <Button
      variant="outline"
      size="xs"
      disabled={pending}
      onClick={() => start(() => retryDeadJob(id))}
    >
      {pending ? '重试中…' : '重试'}
    </Button>
  )
}

export function RetryAllButton({ count }: { count: number }) {
  const [pending, start] = useTransition()

  if (count === 0) return null

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => start(() => retryAllDeadJobs())}
    >
      {pending ? '处理中…' : `批量重试全部死信（${count} 条）`}
    </Button>
  )
}
