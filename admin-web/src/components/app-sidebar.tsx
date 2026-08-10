import * as React from "react"
import {
  BellIcon,
  BookOpenIcon,
  FlagIcon,
  GavelIcon,
  HomeIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const navigation = [
  {
    label: "核心工作",
    items: [
      { title: "首页", page: "dashboard", icon: LayoutDashboardIcon },
      { title: "事情库", page: "activity-library", icon: BookOpenIcon },
      { title: "记录", page: "records", icon: ScrollTextIcon },
      { title: "审核", page: "moderation", icon: GavelIcon },
    ],
  },
  {
    label: "管理",
    items: [
      { title: "推荐", page: "activities", icon: FlagIcon },
      { title: "推送", page: "notifications", icon: BellIcon },
      { title: "用户", page: "users", icon: UsersIcon },
      { title: "家庭", page: "families", icon: HomeIcon },
      { title: "审计", page: "audit", icon: ShieldCheckIcon },
      { title: "设置", page: "settings", icon: Settings2Icon },
    ],
  },
]

export function AppSidebar({
  activePage,
  onNavigate,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activePage: string
  onNavigate: (page: string) => void
}) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-3 pb-2 pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="一百件事管理后台"
              onClick={() => onNavigate("dashboard")}
              className="h-10 rounded-md px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md border border-sidebar-border bg-background text-[12px] font-semibold text-sidebar-foreground shadow-xs">
                百
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">一百件事</span>
                <span className="truncate text-xs text-muted-foreground">管理后台</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator className="mx-4 w-auto" />
      <SidebarContent className="px-2 py-3">
        {navigation.map((section) => (
          <SidebarGroup key={section.label} className="px-0 py-2">
            <SidebarGroupLabel className="h-7 px-2 text-xs font-medium tracking-normal text-sidebar-foreground/45">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.page}>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={activePage === item.page}
                        onClick={() => onNavigate(item.page)}
                        className="h-8 rounded-md px-2 text-sm text-sidebar-foreground/78 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
                      >
                        <Icon className="size-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
