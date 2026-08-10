import { useEffect, useState } from "react"
import { ShieldCheckIcon } from "lucide-react"

import { NavUser } from "@/components/nav-user"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export function SiteHeader({
  title,
  description,
  role,
  demoMode = false,
  user,
  onSignOut,
}: {
  title: string
  description?: string
  role?: string
  demoMode?: boolean
  user: { name: string; email: string; avatar: string }
  onSignOut?: () => void | Promise<void>
}) {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      setOffset(document.body.scrollTop || document.documentElement.scrollTop)
    }

    document.addEventListener("scroll", onScroll, { passive: true })
    return () => document.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-(--header-height) shrink-0 bg-background",
        offset > 10 ? "border-b border-border/70 shadow-xs" : "border-b border-transparent shadow-none"
      )}
    >
      <div
        className={cn(
          "relative flex h-full w-full items-center gap-3 px-4 sm:gap-4",
          offset > 10 ? "bg-background/85 backdrop-blur-lg" : "bg-background"
        )}
      >
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-6" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-medium leading-6 text-foreground md:text-base">{title}</h1>
            {demoMode ? (
              <Badge variant="destructive" className="shrink-0 gap-1 px-1.5 text-[11px]">
                <ShieldCheckIcon className="size-3" />
                DEMO
              </Badge>
            ) : null}
          </div>
          {description ? <p className="hidden truncate text-xs text-muted-foreground lg:block">{description}</p> : null}
        </div>
        <NavUser user={user} role={role} demoMode={demoMode} onSignOut={onSignOut} />
      </div>
    </header>
  )
}
