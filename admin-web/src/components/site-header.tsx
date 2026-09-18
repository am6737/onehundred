import { ShieldCheckIcon } from "lucide-react"

import { NavUser } from "@/components/nav-user"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader({
  title,
  description,
  primaryHeading = false,
  role,
  demoMode = false,
  user,
  onSignOut,
}: {
  title: string
  description?: string
  primaryHeading?: boolean
  role?: string
  demoMode?: boolean
  user: { name: string; email: string; avatar: string }
  onSignOut?: () => void | Promise<void>
}) {
  const titleClassName = "truncate text-sm font-semibold leading-6 text-foreground text-pretty md:text-base"

  return (
    <header className="sticky top-0 z-30 h-(--header-height) shrink-0 border-b border-border/70 bg-background/92 backdrop-blur-lg supports-[backdrop-filter]:bg-background/82">
      <div className="relative flex h-full w-full items-center gap-3 px-4 sm:gap-4 sm:px-5 lg:px-6">
        <SidebarTrigger className="-ml-1" aria-label="切换侧边栏" />
        <Separator orientation="vertical" className="h-6" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {primaryHeading ? <h1 className={titleClassName}>{title}</h1> : <p className={titleClassName}>{title}</p>}
            {demoMode ? (
              <Badge variant="destructive" className="shrink-0 gap-1 px-1.5 text-[11px]">
                <ShieldCheckIcon className="size-3" aria-hidden="true" />
                DEMO
              </Badge>
            ) : null}
          </div>
          {description ? <p className="hidden truncate text-xs leading-5 text-muted-foreground lg:block">{description}</p> : null}
        </div>
        <NavUser user={user} role={role} demoMode={demoMode} onSignOut={onSignOut} />
      </div>
    </header>
  )
}
