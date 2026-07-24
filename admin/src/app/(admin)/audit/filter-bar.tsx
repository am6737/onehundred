'use client'

import { Button } from '@/components/ui/button'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRef } from 'react'

export function FilterBar({
  actions,
  targetTypes,
  admins,
  current,
}: {
  actions: string[]
  targetTypes: string[]
  admins: { id: string; username: string | null }[]
  current: { action?: string; target_type?: string; admin?: string }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const actionRef = useRef<HTMLSelectElement>(null)
  const targetRef = useRef<HTMLSelectElement>(null)
  const adminRef = useRef<HTMLSelectElement>(null)

  function apply() {
    const params = new URLSearchParams(searchParams.toString())
    const a = actionRef.current?.value
    const t = targetRef.current?.value
    const ad = adminRef.current?.value
    if (a) params.set('action', a); else params.delete('action')
    if (t) params.set('target_type', t); else params.delete('target_type')
    if (ad) params.set('admin', ad); else params.delete('admin')
    params.delete('page')
    router.push(`?${params.toString()}`)
  }

  function reset() {
    router.push('?')
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        ref={actionRef}
        defaultValue={current.action ?? ''}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
      >
        <option value="">全部操作</option>
        {actions.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <select
        ref={targetRef}
        defaultValue={current.target_type ?? ''}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
      >
        <option value="">全部目标类型</option>
        {targetTypes.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <select
        ref={adminRef}
        defaultValue={current.admin ?? ''}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
      >
        <option value="">全部管理员</option>
        {admins.map((a) => (
          <option key={a.id} value={a.id}>{a.username ?? a.id.slice(0, 8)}</option>
        ))}
      </select>

      <Button type="button" variant="outline" size="sm" onClick={apply}>
        筛选
      </Button>
      {(current.action || current.target_type || current.admin) && (
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          重置
        </Button>
      )}
    </div>
  )
}
