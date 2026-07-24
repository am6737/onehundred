'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Filters = {
  q: string
  status: string
  expired: string
  opened: string
}

export function FilterBar({ defaults }: { defaults: Filters }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = useTransition()

  function push(patch: Partial<Filters>) {
    const merged = { ...defaults, ...patch }
    const params = new URLSearchParams({
      q: merged.q,
      status: merged.status,
      expired: merged.expired,
      opened: merged.opened,
      page: '1',
    })
    start(() => router.push(`${pathname}?${params.toString()}`))
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value
    push({ q })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          name="q"
          defaultValue={defaults.q}
          placeholder="搜索家庭邀请码或令牌 ID…"
          className="w-64"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          搜索
        </Button>
      </form>

      <div className="flex gap-2">
        {[
          { label: '全部', value: 'all' },
          { label: '活跃', value: 'active' },
          { label: '已停用', value: 'inactive' },
        ].map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={defaults.status === opt.value ? 'default' : 'outline'}
            onClick={() => push({ status: opt.value })}
            disabled={pending}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={defaults.expired === '1' ? 'default' : 'outline'}
          onClick={() => push({ expired: defaults.expired === '1' ? '' : '1' })}
          disabled={pending}
        >
          仅已过期
        </Button>
        <Button
          size="sm"
          variant={defaults.opened === '1' ? 'default' : 'outline'}
          onClick={() => push({ opened: defaults.opened === '1' ? '' : '1' })}
          disabled={pending}
        >
          仅已打开
        </Button>
      </div>
    </div>
  )
}
