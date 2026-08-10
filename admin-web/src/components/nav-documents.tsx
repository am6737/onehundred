"use client"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type * as React from "react"

export function NavDocuments({
  items,
  activePage,
  onNavigate,
}: {
  items: { name: string; page: string; icon: React.ReactNode }[]
  activePage: string
  onNavigate: (page: string) => void
}) {
  return (
    <SidebarGroup className="px-0 py-2">
      <SidebarGroupLabel className="h-7 px-2 text-[11px] font-medium tracking-normal text-sidebar-foreground/45">管理</SidebarGroupLabel>
      <SidebarMenu className="gap-0.5">
        {items.map((item) => (
          <SidebarMenuItem key={item.page}>
            <SidebarMenuButton
              tooltip={item.name}
              isActive={activePage === item.page}
              onClick={() => onNavigate(item.page)}
              className="relative h-8 rounded-md px-2.5 text-[13px] font-medium text-sidebar-foreground/76 before:absolute before:left-0 before:top-1/2 before:h-4 before:w-px before:-translate-y-1/2 before:rounded-full before:bg-transparent hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:before:bg-sidebar-primary"
            >
              {item.icon}
              <span>{item.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
