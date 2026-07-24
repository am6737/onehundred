'use client';

import { useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileText,
  Bell,
  BarChart3,
  Settings,
  ChevronRight,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';

type Icon = ComponentType<{ className?: string }>;
type Leaf = { title: string; href: string };
type Entry =
  | { title: string; href: string; icon: Icon }
  | { title: string; icon: Icon; key: string; children: Leaf[] };

// 6 primary entries; everything secondary lives one level down, collapsed by
// default. All original routes are preserved — this only regroups them.
const NAV: Entry[] = [
  { title: '仪表盘', href: '/dashboard', icon: LayoutDashboard },
  {
    title: '用户',
    icon: Users,
    key: 'users',
    children: [
      { title: '用户管理', href: '/users' },
      { title: '家庭管理', href: '/families' },
      { title: '孩子档案', href: '/kids' },
      { title: '邀请管理', href: '/invites' },
    ],
  },
  {
    title: '内容',
    icon: FileText,
    key: 'content',
    children: [
      { title: '内容管理', href: '/content' },
      { title: '内置活动', href: '/levels' },
      { title: '自定义活动', href: '/levels/custom' },
      { title: '衣橱管理', href: '/wardrobe' },
    ],
  },
  {
    title: '推送',
    icon: Bell,
    key: 'push',
    children: [
      { title: '概览', href: '/notifications' },
      { title: '全局推送', href: '/notifications/broadcast' },
      { title: '通知模板', href: '/notifications/templates' },
      { title: '投递日志', href: '/notifications/logs' },
      { title: '发件箱', href: '/notifications/outbox' },
      { title: '设备列表', href: '/notifications/devices' },
    ],
  },
  { title: '数据统计', href: '/analytics', icon: BarChart3 },
  {
    title: '系统',
    icon: Settings,
    key: 'system',
    children: [
      { title: '客服工具', href: '/support' },
      { title: '数据修复', href: '/support/repair' },
      { title: '操作日志', href: '/audit' },
      { title: '系统配置', href: '/settings' },
    ],
  },
];

const ALL_HREFS = NAV.flatMap((e) =>
  'children' in e ? e.children.map((c) => c.href) : [e.href],
);

// Longest-prefix wins, so /levels/custom beats /levels and /support/repair
// beats /support without needing per-item "exact" flags.
function bestMatch(pathname: string): string | null {
  let best: string | null = null;
  for (const href of ALL_HREFS) {
    if (pathname === href || pathname.startsWith(href + '/')) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}

export function AppSidebar() {
  const pathname = usePathname();
  const active = bestMatch(pathname);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <span className="text-sm font-semibold">一百见时</span>
        <span className="text-xs text-muted-foreground">管理后台</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((entry) => {
                if (!('children' in entry)) {
                  return (
                    <SidebarMenuItem key={entry.href}>
                      <SidebarMenuButton
                        isActive={entry.href === active}
                        render={<Link href={entry.href} />}
                      >
                        <entry.icon className="size-4" />
                        <span>{entry.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                const containsActive = entry.children.some(
                  (c) => c.href === active,
                );
                const open = overrides[entry.key] ?? containsActive;

                return (
                  <SidebarMenuItem key={entry.key}>
                    <SidebarMenuButton
                      aria-expanded={open}
                      onClick={() =>
                        setOverrides((prev) => ({ ...prev, [entry.key]: !open }))
                      }
                    >
                      <entry.icon className="size-4" />
                      <span>{entry.title}</span>
                      <ChevronRight
                        className={`ml-auto size-4 text-muted-foreground transition-transform duration-150 ${
                          open ? 'rotate-90' : ''
                        }`}
                      />
                    </SidebarMenuButton>
                    {open && (
                      <SidebarMenuSub>
                        {entry.children.map((c) => (
                          <SidebarMenuSubItem key={c.href}>
                            <SidebarMenuSubButton
                              isActive={c.href === active}
                              render={<Link href={c.href} />}
                            >
                              <span>{c.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
