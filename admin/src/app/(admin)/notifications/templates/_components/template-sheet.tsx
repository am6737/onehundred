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
} from '@/components/ui/sheet'
import { PencilIcon, PlusIcon } from 'lucide-react'
import { updateTemplate, createTemplate, type TemplateInput } from '../_actions'

export type TemplateRow = {
  id: number
  scene: string
  species: string
  lang: string
  title: string
  body: string
  sort_order: number
}

const EXAMPLE_VARS: Record<string, string> = {
  who: '妈妈',
  kid: '小明',
  title: '第一次骑车',
}

function previewBody(body: string) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => EXAMPLE_VARS[key] ?? `{{${key}}}`)
}

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring transition-colors'

function TemplateForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: TemplateRow
  onSave: (data: TemplateInput) => Promise<void>
  onCancel: () => void
}) {
  const [scene, setScene] = useState(initial.scene)
  const [species, setSpecies] = useState(initial.species)
  const [lang, setLang] = useState(initial.lang)
  const [title, setTitle] = useState(initial.title)
  const [body, setBody] = useState(initial.body)
  const [sortOrder, setSortOrder] = useState(initial.sort_order)
  const [showPreview, setShowPreview] = useState(false)
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [pending, start] = useTransition()

  function handleSave() {
    if (!scene.trim() || !title.trim() || !body.trim()) {
      setStatus({ type: 'err', msg: '场景、标题、正文不能为空' })
      return
    }
    setStatus(null)
    start(async () => {
      try {
        await onSave({ scene: scene.trim(), species: species.trim(), lang: lang.trim(), title: title.trim(), body: body.trim(), sort_order: sortOrder })
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>场景 (scene)</Label>
            <Input value={scene} onChange={(e) => setScene(e.target.value)} placeholder="如 memory_created" />
          </div>
          <div className="space-y-1.5">
            <Label>物种 (species)</Label>
            <Input value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="如 cat" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>语言 (lang)</Label>
            <select value={lang} onChange={(e) => setLang(e.target.value)} className={fieldClass}>
              <option value="zh">zh（中文）</option>
              <option value="en">en（英文）</option>
            </select>
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

        <div className="space-y-1.5">
          <Label>标题</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="通知标题，支持 {{who}}、{{kid}} 等" />
        </div>

        <div className="space-y-1.5">
          <Label>正文</Label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className={fieldClass + ' resize-none'}
            placeholder="通知正文，支持 {{who}}、{{kid}}、{{title}} 等变量"
          />
          <p className="text-xs text-muted-foreground">变量：{'{{who}}'} 发送者角色 · {'{{kid}}'} 孩子名字 · {'{{title}}'} 记录标题</p>
        </div>

        <div className="space-y-1.5">
          <button
            type="button"
            className="text-xs text-primary underline hover:no-underline"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? '隐藏预览' : '变量预览（示例值）'}
          </button>
          {showPreview && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">预览（{EXAMPLE_VARS.who}/{EXAMPLE_VARS.kid}/{EXAMPLE_VARS.title}）</p>
              <p className="text-sm font-medium">{previewBody(title)}</p>
              <p className="text-sm text-muted-foreground">{previewBody(body)}</p>
            </div>
          )}
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

export function EditTemplateButton({ template }: { template: TemplateRow }) {
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
            <SheetTitle>编辑模板 #{template.id}</SheetTitle>
          </SheetHeader>
          <TemplateForm
            initial={template}
            onSave={(data) => updateTemplate(template.id, data)}
            onCancel={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

export function CreateTemplateButton() {
  const [open, setOpen] = useState(false)

  const initial: TemplateRow = {
    id: 0,
    scene: '',
    species: '',
    lang: 'zh',
    title: '',
    body: '',
    sort_order: 0,
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        新增模板
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>新增通知模板</SheetTitle>
          </SheetHeader>
          <TemplateForm
            initial={initial}
            onSave={createTemplate}
            onCancel={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
