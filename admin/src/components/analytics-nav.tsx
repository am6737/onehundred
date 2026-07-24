'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { title: '概览', href: '/analytics' },
  { title: '用户增长', href: '/analytics/growth' },
  { title: '留存分析', href: '/analytics/retention' },
  { title: '内容趋势', href: '/analytics/content' },
  { title: '推送效果', href: '/analytics/push' },
  { title: '邀记漏斗', href: '/analytics/invites' },
];

export function AnalyticsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b pb-3">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === '/analytics'
            ? pathname === '/analytics'
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
