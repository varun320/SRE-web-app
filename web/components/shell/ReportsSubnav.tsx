'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin/reports/payroll',    label: 'Payroll',    match: (p: string) => p.startsWith('/admin/reports/payroll') },
  { href: '/admin/reports/period',     label: 'Period',     match: (p: string) => p.startsWith('/admin/reports/period') },
  { href: '/admin/reports/categories', label: 'Categories', match: (p: string) => p.startsWith('/admin/reports/categories') },
  { href: '/admin/reports/projects',   label: 'Projects',   match: (p: string) => p.startsWith('/admin/reports/projects') },
  { href: '/admin/reports/balances',   label: 'Balances',   match: (p: string) => p.startsWith('/admin/reports/balances') },
];

export function ReportsSubnav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      role="tablist"
      aria-label="Reports"
      className="flex items-center gap-1 overflow-x-auto"
    >
      {ITEMS.map((it) => {
        const active = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            role="tab"
            aria-selected={active}
            className={[
              'shrink-0 inline-flex items-center rounded-md px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-[var(--color-surface-2)] text-[var(--color-text)] font-medium'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/60',
            ].join(' ')}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
