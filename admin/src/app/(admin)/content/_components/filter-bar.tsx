'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface FilterBarProps {
  current: {
    q?: string
    type?: string
    perspective?: string
    moderation?: string
    sealed?: string
    dateFrom?: string
    dateTo?: string
  }
}

const typeOptions = [
  { value: '', label: '全部类型' },
  { value: 'photo', label: '照片' },
  { value: 'video', label: '视频' },
  { value: 'voice', label: '语音' },
  { value: 'text', label: '文字' },
]

const perspectiveOptions = [
  { value: '', label: '全部视角' },
  { value: 'parent', label: '父母视角' },
  { value: 'child', label: '孩子视角' },
  { value: 'together', label: '共同视角' },
]

const moderationOptions = [
  { value: '', label: '全部审核状态' },
  { value: 'approved', label: '已通过' },
  { value: 'pending', label: '待审核' },
  { value: 'flagged', label: '已标记' },
  { value: 'removed', label: '已移除' },
]

const sealedOptions = [
  { value: '', label: '全部封存状态' },
  { value: 'true', label: '已封存' },
  { value: 'false', label: '未封存' },
]

const selectCls =
  'h-8 rounded-lg border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring'

export function FilterBar({ current }: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qRef = useRef<HTMLInputElement>(null)
  const typeRef = useRef<HTMLSelectElement>(null)
  const perspRef = useRef<HTMLSelectElement>(null)
  const modRef = useRef<HTMLSelectElement>(null)
  const sealedRef = useRef<HTMLSelectElement>(null)
  const dateFromRef = useRef<HTMLInputElement>(null)
  const dateToRef = useRef<HTMLInputElement>(null)

  function apply() {
    const params = new URLSearchParams(searchParams.toString())
    const set = (key: string, val: string | undefined) => {
      if (val) params.set(key, val)
      else params.delete(key)
    }
    set('q', qRef.current?.value)
    set('type', typeRef.current?.value)
    set('perspective', perspRef.current?.value)
    set('moderation', modRef.current?.value)
    set('sealed', sealedRef.current?.value)
    set('dateFrom', dateFromRef.current?.value)
    set('dateTo', dateToRef.current?.value)
    params.delete('page')
    router.push(`?${params.toString()}`)
  }

  function reset() {
    router.push('?')
  }

  const hasFilter =
    current.q ||
    current.type ||
    current.perspective ||
    current.moderation ||
    current.sealed ||
    current.dateFrom ||
    current.dateTo

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Input
        ref={qRef}
        defaultValue={current.q ?? ''}
        placeholder="搜索家庭邀请码 / 标题 / 孩子"
        className="h-8 w-52 text-sm"
      />

      <select ref={typeRef} defaultValue={current.type ?? ''} className={selectCls}>
        {typeOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select ref={perspRef} defaultValue={current.perspective ?? ''} className={selectCls}>
        {perspectiveOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select ref={modRef} defaultValue={current.moderation ?? ''} className={selectCls}>
        {moderationOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select ref={sealedRef} defaultValue={current.sealed ?? ''} className={selectCls}>
        {sealedOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <input
          ref={dateFromRef}
          type="date"
          defaultValue={current.dateFrom ?? ''}
          className={selectCls}
        />
        <span>—</span>
        <input
          ref={dateToRef}
          type="date"
          defaultValue={current.dateTo ?? ''}
          className={selectCls}
        />
      </div>

      <Button type="button" variant="outline" size="sm" onClick={apply}>
        筛选
      </Button>
      {hasFilter && (
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          重置
        </Button>
      )}
    </div>
  )
}
