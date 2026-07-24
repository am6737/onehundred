'use client'

import { useState, useTransition, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PencilIcon, PlusIcon, UploadIcon, XIcon } from 'lucide-react'
import { updateLevel, createLevel, uploadLevelIllustration, type LevelInput } from '../_actions'
import { illustrationUrl } from '@/lib/illustration'

export type LevelRow = {
  num: string
  title: string
  why: string
  suggest: string
  tone: string
  sort_order: number
  illustration_path: string | null
  perspective: string
  sealed: boolean
  seasonal: boolean
}

const TONE_COLORS: Record<string, string> = {
  orange: '#f97316',
  green: '#22c55e',
  pink: '#ec4899',
}

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring transition-colors'

function LevelForm({
  initial,
  numEditable,
  onSave,
  onCancel,
}: {
  initial: LevelRow
  numEditable: boolean
  onSave: (num: string, data: LevelInput) => Promise<void>
  onCancel: () => void
}) {
  const [num, setNum] = useState(initial.num)
  const [title, setTitle] = useState(initial.title)
  const [why, setWhy] = useState(initial.why)
  const [suggest, setSuggest] = useState(initial.suggest)
  const [tone, setTone] = useState(initial.tone)
  const [sortOrder, setSortOrder] = useState(initial.sort_order)
  const [illustration, setIllustration] = useState(initial.illustration_path ?? '')
  const [perspective, setPerspective] = useState(initial.perspective)
  const [sealed, setSealed] = useState(initial.sealed)
  const [seasonal, setSeasonal] = useState(initial.seasonal)
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [pending, start] = useTransition()
  const [uploading, startUpload] = useTransition()

  const previewUrl = illustrationUrl(illustration)

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选择同一文件
    if (!file) return
    const fd = new FormData()
    fd.set('file', file)
    fd.set('num', num)
    setStatus(null)
    startUpload(async () => {
      try {
        const path = await uploadLevelIllustration(fd)
        setIllustration(path)
        setStatus({ type: 'ok', msg: '插画已上传，点击保存后生效' })
      } catch (err) {
        setStatus({ type: 'err', msg: err instanceof Error ? err.message : '上传失败' })
      }
    })
  }

  function handleSave() {
    if (!title.trim()) {
      setStatus({ type: 'err', msg: '标题不能为空' })
      return
    }
    if (!num.trim()) {
      setStatus({ type: 'err', msg: '编号不能为空' })
      return
    }
    setStatus(null)
    start(async () => {
      try {
        await onSave(num.trim(), {
          title: title.trim(),
          why,
          suggest,
          tone,
          sort_order: sortOrder,
          illustration_path: illustration,
          perspective,
          sealed,
          seasonal,
        })
        setStatus({ type: 'ok', msg: '保存成功' })
      } catch (e) {
        setStatus({ type: 'err', msg: e instanceof Error ? e.message : '保存失败' })
      }
    })
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {status && (
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              status.type === 'ok'
                ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
            }`}
          >
            {status.msg}
          </div>
        )}

        <div className="space-y-1.5">
          <Label>编号</Label>
          {numEditable ? (
            <Input
              value={num}
              onChange={(e) => setNum(e.target.value)}
              placeholder="如 42"
            />
          ) : (
            <div className="font-mono text-sm text-muted-foreground px-1">{num}</div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>标题</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="活动标题"
          />
        </div>

        <div className="space-y-1.5">
          <Label>描述（为什么做这件事）</Label>
          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            rows={3}
            className={fieldClass + ' resize-none'}
            placeholder="这件事对亲子关系的意义..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>建议记录方式</Label>
            <select
              value={suggest}
              onChange={(e) => setSuggest(e.target.value)}
              className={fieldClass}
            >
              <option value="photo">photo（拍照）</option>
              <option value="voice">voice（录音）</option>
              <option value="video">video（视频）</option>
              <option value="text">text（文字）</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>视角</Label>
            <select
              value={perspective}
              onChange={(e) => setPerspective(e.target.value)}
              className={fieldClass}
            >
              <option value="together">together（一起）</option>
              <option value="parent">parent（家长视角）</option>
              <option value="child">child（孩子视角）</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>配色</Label>
            <div className="flex items-center gap-2">
              <div
                className="size-5 rounded-full border flex-shrink-0"
                style={{ backgroundColor: TONE_COLORS[tone] ?? tone }}
              />
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className={fieldClass}
              >
                <option value="orange">orange（橙）</option>
                <option value="green">green（绿）</option>
                <option value="pink">pink（粉）</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>排序值</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>插画</Label>
          {previewUrl ? (
            <div className="relative w-full overflow-hidden rounded-lg border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="插画预览"
                className="h-44 w-full object-contain"
              />
              <button
                type="button"
                onClick={() => setIllustration('')}
                className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white transition-colors hover:bg-black/80"
              >
                <XIcon className="size-3" />
                移除
              </button>
            </div>
          ) : (
            <div className="flex h-44 w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              暂无插画
            </div>
          )}

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
            <UploadIcon className="size-4" />
            {uploading ? '上传中…' : previewUrl ? '重新上传' : '上传插画'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={handleFile}
            />
          </label>

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              手动填写路径 / 外链
            </summary>
            <Input
              className="mt-2"
              value={illustration}
              onChange={(e) => setIllustration(e.target.value)}
              placeholder="illustrations 桶内路径或 https://..."
            />
          </details>
        </div>

        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sealed}
              onChange={(e) => setSealed(e.target.checked)}
              className="size-4 rounded"
            />
            封存活动
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={seasonal}
              onChange={(e) => setSeasonal(e.target.checked)}
              className="size-4 rounded"
            />
            季节性活动
          </label>
        </div>
      </div>

      <div className="border-t p-4 flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button disabled={pending} onClick={handleSave}>
          {pending ? '保存中…' : '保存'}
        </Button>
      </div>
    </>
  )
}

export function EditLevelButton({ level }: { level: LevelRow }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="xs" onClick={() => setOpen(true)}>
        <PencilIcon />
        编辑
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>编辑活动 #{level.num}</SheetTitle>
          </SheetHeader>
          <LevelForm
            initial={level}
            numEditable={false}
            onSave={updateLevel}
            onCancel={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

export function CreateLevelButton({
  nextNum,
  nextSortOrder,
}: {
  nextNum: string
  nextSortOrder: number
}) {
  const [open, setOpen] = useState(false)

  const initial: LevelRow = {
    num: nextNum,
    title: '',
    why: '',
    suggest: 'photo',
    tone: 'orange',
    sort_order: nextSortOrder,
    illustration_path: null,
    perspective: 'together',
    sealed: false,
    seasonal: false,
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        新增活动
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>新增活动</SheetTitle>
          </SheetHeader>
          <LevelForm
            initial={initial}
            numEditable
            onSave={createLevel}
            onCancel={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
