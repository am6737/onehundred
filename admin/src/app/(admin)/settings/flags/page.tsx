import { supabaseAdmin } from '@/lib/supabase-admin'
import { FlagsTable } from './_components/flags-table'
import Link from 'next/link'
import { ChevronLeftIcon } from 'lucide-react'

export default async function FlagsPage() {
  const { data: rows } = await supabaseAdmin
    .from('feature_flags')
    .select('*')
    .order('key')

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" />
          系统配置
        </Link>
        <h1 className="text-2xl font-bold">功能开关</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理 feature_flags 表。切换开关后立即生效，操作记入审计日志。
        </p>
      </div>

      <FlagsTable rows={rows ?? []} />
    </div>
  )
}
