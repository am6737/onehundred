import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const defaultPageSizeOptions = [10, 20, 50, 100]

type PageItem = number | "ellipsis"

export type AdminPaginationProps = {
  total: number
  page: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  disabled?: boolean
  className?: string
}

function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((item) => item >= 1 && item <= totalPages))
  const orderedPages = Array.from(pages).sort((a, b) => a - b)

  return orderedPages.flatMap((item, index) => {
    const previous = orderedPages[index - 1]

    if (previous && item - previous > 1) {
      return ["ellipsis" as const, item]
    }

    return [item]
  })
}

function normalizePageSizeOptions(pageSize: number, options: number[]) {
  return Array.from(new Set([...options, pageSize].filter((item) => Number.isFinite(item) && item > 0))).sort((a, b) => a - b)
}

export function AdminPagination({
  total,
  page,
  pageSize,
  pageSizeOptions = defaultPageSizeOptions,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  className,
}: AdminPaginationProps) {
  const safeTotal = Math.max(0, total)
  const safePageSize = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const pageItems = getPageItems(currentPage, totalPages)
  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages
  const sizeOptions = normalizePageSizeOptions(safePageSize, pageSizeOptions)

  const handlePageChange = (nextPage: number) => {
    const clampedPage = Math.min(Math.max(1, nextPage), totalPages)

    if (clampedPage !== currentPage) {
      onPageChange(clampedPage)
    }
  }

  return (
    <nav
      aria-label="后台列表分页"
      className={cn(
        "flex flex-col gap-3 border-t border-border/60 px-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground">
        <span className="whitespace-nowrap">共 {safeTotal} 条</span>
        <span className="whitespace-nowrap">第 {currentPage}/{totalPages} 页</span>
        {onPageSizeChange ? (
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap">每页</span>
            <Select
              value={String(safePageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
              disabled={disabled}
            >
              <SelectTrigger size="sm" className="h-7 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={disabled || !canGoPrevious}
          aria-label="上一页"
        >
          <ChevronLeftIcon />
          <span>上一页</span>
        </Button>

        {totalPages > 1 ? (
          <div className="hidden items-center gap-1 md:flex">
            {pageItems.map((item, index) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="grid size-8 place-items-center text-muted-foreground"
                  aria-hidden="true"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={item === currentPage ? "default" : "outline"}
                  size="icon-sm"
                  onClick={() => handlePageChange(item)}
                  disabled={disabled}
                  aria-current={item === currentPage ? "page" : undefined}
                  aria-label={`第 ${item} 页`}
                >
                  {item}
                </Button>
              ),
            )}
          </div>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={disabled || !canGoNext}
          aria-label="下一页"
        >
          <span>下一页</span>
          <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  )
}
