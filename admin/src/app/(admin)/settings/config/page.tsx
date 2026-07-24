import { supabaseAdmin } from '@/lib/supabase-admin'
import { ConfigTable } from './_components/config-table'
import Link from 'next/link'
import { ChevronLeftIcon } from 'lucide-react'

export default async function ConfigPage() {
  const { data: rows } = await supabaseAdmin
    .from('app_config')
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
        <h1 className="text-2xl font-bold">App 配置</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理 app_config 表中的键值对。敏感字段（如 notify_secret）会遮罩显示，写入审计日志时自动脱敏。
        </p>
      </div>

      <ConfigTable rows={rows ?? []} />
    </div>
  )
}
