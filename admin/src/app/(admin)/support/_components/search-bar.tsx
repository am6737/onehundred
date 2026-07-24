'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SupportSearchBar({
  defaultValue,
  placeholder,
  action,
}: {
  defaultValue?: string
  placeholder?: string
  action: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim()
    if (!q) return
    start(() => router.push(`${action}?q=${encodeURIComponent(q)}`))
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder ?? '输入手机号、邮箱、用户名、邀请码或 UUID…'}
        className="flex-1 max-w-xl"
        autoComplete="off"
      />
      <Button type="submit" disabled={pending}>
        {pending ? '搜索中…' : '搜索'}
      </Button>
    </form>
  )
}
