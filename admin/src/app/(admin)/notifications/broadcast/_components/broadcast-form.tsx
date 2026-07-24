'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { sendBroadcast, getTargetDeviceCount, type BroadcastResult } from '../_actions'

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring transition-colors'

const PLATFORM_LABEL: Record<string, string> = { all: '全部', ios: 'iOS', android: 'Android' }
const LANG_LABEL: Record<string, string> = { all: '全部', zh: '中文', en: 'English' }

export function BroadcastForm() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [platform, setPlatform] = useState('all')
  const [lang, setLang] = useState('all')
  const [deviceCount, setDeviceCount] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [result, setResult] = useState<BroadcastResult | null>(null)
  const [countPending, startCountTransition] = useTransition()
  const [sendPending, startSendTransition] = useTransition()

  useEffect(() => {
    startCountTransition(async () => {
      const count = await getTargetDeviceCount(platform, lang)
      setDeviceCount(count)
    })
  }, [platform, lang])

  function handleOpenDialog() {
    if (!title.trim() || !body.trim()) return
    setResult(null)
    setDialogOpen(true)
  }

  function handleConfirm() {
    startSendTransition(async () => {
      const res = await sendBroadcast(title, body, platform, lang)
      setResult(res)
      setDialogOpen(false)
    })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>标题</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="推送标题"
        />
      </div>

      <div className="space-y-1.5">
        <Label>正文</Label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className={fieldClass + ' resize-none'}
          placeholder="推送正文内容"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>平台筛选</Label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className={fieldClass + ' cursor-pointer'}
          >
            <option value="all">全部</option>
            <option value="ios">iOS</option>
            <option value="android">Android</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>语言筛选</Label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className={fieldClass + ' cursor-pointer'}
          >
            <option value="all">全部</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm flex items-center gap-2">
        <span className="text-muted-foreground">目标设备数：</span>
        {countPending ? (
          <span className="text-muted-foreground animate-pulse">查询中…</span>
        ) : (
          <span className="font-bold">{deviceCount ?? '—'} 台</span>
        )}
      </div>

      {result && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            result.ok && !result.error
              ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
          }`}
        >
          {result.error
            ? `发送失败：${result.error}`
            : `已发送 ${result.sent} / ${result.total} 台${result.failed > 0 ? `，${result.failed} 台失败` : ''}`}
        </div>
      )}

      <Button
        onClick={handleOpenDialog}
        disabled={!title.trim() || !body.trim() || sendPending}
        className="w-full"
      >
        {sendPending ? '发送中…' : '发送全局推送'}
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认发送全局推送</AlertDialogTitle>
            <AlertDialogDescription>
              将向{' '}
              <strong>{deviceCount ?? '—'} 台</strong>{' '}
              设备发送以下消息，操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md bg-muted p-3 text-sm space-y-1.5 my-1">
            <div>
              <span className="text-muted-foreground mr-1">标题：</span>
              <span className="font-medium">{title}</span>
            </div>
            <div>
              <span className="text-muted-foreground mr-1">正文：</span>
              {body}
            </div>
            <div>
              <span className="text-muted-foreground mr-1">平台：</span>
              {PLATFORM_LABEL[platform] ?? platform}
            </div>
            <div>
              <span className="text-muted-foreground mr-1">语言：</span>
              {LANG_LABEL[lang] ?? lang}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendPending}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={sendPending}>
              {sendPending ? '发送中…' : '确认发送'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
