'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { XIcon, ZoomInIcon } from 'lucide-react'

// 网格卡片插画的点击放大预览。children 是缩略图，点击后在全屏浮层里展示大图。
export function IllustrationLightbox({
  url,
  title,
  children,
}: {
  url: string
  title: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    // 打开时锁定背景滚动
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`查看「${title}」大图`}
        className="group/zoom relative block h-full w-full cursor-zoom-in"
      >
        {children}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/zoom:bg-black/25 group-hover/zoom:opacity-100">
          <ZoomInIcon className="size-6 text-white drop-shadow" />
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭"
            className="absolute right-4 top-4 flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
          >
            <XIcon className="size-4" />
            关闭
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={title}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-full cursor-default rounded-lg object-contain shadow-2xl"
          />
          <div className="mt-3 text-sm text-white/80">{title}</div>
        </div>
      )}
    </>
  )
}
