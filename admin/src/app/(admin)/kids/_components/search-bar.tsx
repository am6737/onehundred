'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SearchBar({
  defaultName,
  defaultFamily,
}: {
  defaultName: string
  defaultFamily: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const name = (form.elements.namedItem('name') as HTMLInputElement).value
    const family = (form.elements.namedItem('family') as HTMLInputElement).value
    start(() => {
      const params = new URLSearchParams()
      if (name) params.set('name', name)
      if (family) params.set('family', family)
      params.set('page', '1')
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
      <Input
        name="name"
        defaultValue={defaultName}
        placeholder="按名字搜索…"
        className="w-48"
      />
      <Input
        name="family"
        defaultValue={defaultFamily}
        placeholder="家庭邀请码或 ID…"
        className="w-56"
      />
      <Button type="submit" variant="outline" disabled={pending}>
        搜索
      </Button>
    </form>
  )
}
