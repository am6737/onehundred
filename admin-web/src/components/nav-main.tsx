import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type * as React from "react"

export function NavMain({
  items,
  activePage,
  onNavigate,
}: {
  items: { title: string; page: string; icon?: React.ReactNode }[]
  activePage: string
  onNavigate: (page: string) => void
}) {
  return (
    <SidebarGroup className="px-0 py-2">
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => (
            <SidebarMenuItem key={item.page}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={activePage === item.page}
                onClick={() => onNavigate(item.page)}
                className="h-8 rounded-md px-2 text-sm text-sidebar-foreground/78 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
