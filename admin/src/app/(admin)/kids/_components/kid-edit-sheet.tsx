'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { updateKid } from '../_actions'

interface Props {
  kid: {
    id: string
    name: string
    birth_year: number
    birth_month: number
  }
}

export function KidEditSheet({ kid }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(kid.name)
  const [birthYear, setBirthYear] = useState(String(kid.birth_year))
  const [birthMonth, setBirthMonth] = useState(String(kid.birth_month))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [pending, start] = useTransition()

  function handleOpen() {
    setName(kid.name)
    setBirthYear(String(kid.birth_year))
    setBirthMonth(String(kid.birth_month))
    setError('')
    setSuccess(false)
    setOpen(true)
  }

  function handleSubmit() {
    const yr = parseInt(birthYear)
    const mo = parseInt(birthMonth)
    if (!name.trim()) { setError('名字不能为空'); return }
    if (!yr || yr < 2000 || yr > 2099) { setError('出生年份无效（2000–2099）'); return }
    if (!mo || mo < 1 || mo > 12) { setError('出生月份无效（1–12）'); return }
    setError('')
    start(async () => {
      try {
        await updateKid(kid.id, name.trim(), yr, mo)
        setSuccess(true)
        setTimeout(() => setOpen(false), 800)
      } catch (e) {
        setError(e instanceof Error ? e.message : '保存失败')
      }
    })
  }

  return (
    <>
      <Button variant="outline" size="xs" onClick={handleOpen}>
        编辑
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle>编辑孩子信息</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="kid-name">名字</Label>
              <Input
                id="kid-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="孩子名字"
              />
            </div>
            <div className="space-y-1.5">
              <Label>出生年份</Label>
              <Input
                type="number"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="如 2020"
                min={2000}
                max={2099}
              />
            </div>
            <div className="space-y-1.5">
              <Label>出生月份</Label>
              <Input
                type="number"
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                placeholder="1–12"
                min={1}
                max={12}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-600">保存成功</p>}
          </div>
          <SheetFooter className="px-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? '保存中…' : '保存'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
