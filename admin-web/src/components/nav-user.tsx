import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { ChevronDownIcon, CircleUserRoundIcon, CreditCardIcon, LogOutIcon, ShieldCheckIcon } from "lucide-react"

export function NavUser({
  user,
  role,
  demoMode = false,
  onSignOut,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
  role?: string
  demoMode?: boolean
  onSignOut?: () => void | Promise<void>
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 min-w-0 gap-2 rounded-md px-1.5 pr-2" aria-label="打开用户菜单">
          <Avatar className="size-7 rounded-md grayscale">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="rounded-md text-xs">{user.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm font-medium md:inline">{user.name}</span>
          <ChevronDownIcon className="hidden size-3.5 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 rounded-lg shadow-sm" side="bottom" align="end" sideOffset={8}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="grid gap-2 px-2 py-2 text-left text-sm">
            <div className="flex items-center gap-2">
              <Avatar className="size-8 rounded-md">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-md">{user.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
            <Badge variant={demoMode ? "destructive" : "outline"} className="w-fit gap-1 text-[11px]">
              <ShieldCheckIcon className="size-3" />
              {demoMode ? "演示数据源" : role || "管理员"}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <CircleUserRoundIcon />
            个人资料
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCardIcon />
            权限信息
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(event) => {
            event.preventDefault()
            void onSignOut?.()
          }}
        >
          <LogOutIcon />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
