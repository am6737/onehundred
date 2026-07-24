import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Settings, Flag, Server } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">系统配置</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理应用配置、功能开关和系统信息</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/settings/config">
          <Card className="cursor-pointer hover:bg-muted/40 transition-colors">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Settings className="size-5 text-primary" />
              </div>
              <CardTitle className="text-base">App 配置</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                管理应用全局键值配置，包括密钥、维护模式、最低版本要求等。
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/flags">
          <Card className="cursor-pointer hover:bg-muted/40 transition-colors">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Flag className="size-5 text-primary" />
              </div>
              <CardTitle className="text-base">功能开关</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                即时启用或禁用产品功能，无需发版，支持乐观更新。
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/system">
          <Card className="cursor-pointer hover:bg-muted/40 transition-colors">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Server className="size-5 text-primary" />
              </div>
              <CardTitle className="text-base">系统信息</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                查看数据库状态、各表行数、管理员列表及角色管理。
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
