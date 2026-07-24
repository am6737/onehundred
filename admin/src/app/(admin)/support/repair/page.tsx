import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RepairTools } from './_components/repair-tools'

export default function RepairPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">数据修复工具箱</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            扫描并修复数据库中的孤立记录、空值字段、过期状态等数据问题。所有写操作均记录审计日志。
          </p>
        </div>
        <Link href="/support">
          <Button variant="outline" size="sm">
            ← 返回客服工具
          </Button>
        </Link>
      </div>

      <RepairTools />
    </div>
  )
}
