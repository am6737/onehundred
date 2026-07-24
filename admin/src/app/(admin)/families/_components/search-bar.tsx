'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SearchBar({ defaultValue }: { defaultValue: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value
    start(() => {
      router.push(`${pathname}?q=${encodeURIComponent(q)}&page=1`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        name="q"
        defaultValue={defaultValue}
        placeholder="搜索邀请码、用户名或邮箱…"
        className="w-72"
      />
      <Button type="submit" variant="outline" disabled={pending}>
        搜索
      </Button>
    </form>
  )
}
