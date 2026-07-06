'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin/reports',          label: 'Overview',  match: (p: string) => p === '/admin/reports' },
  { href: '/admin/reports/payroll',    label: 'Payroll',    match: (p: string) => p.startsWith('/admin/reports/payroll') },
  { href: '/admin/reports/categories', label: 'Categories', match: (p: string) => p.startsWith('/admin/reports/categories') },
  { href: '/admin/reports/projects',   label: 'Projects',   match: (p: string) => p.startsWith('/admin/reports/projects') },
  { href: '/admin/reports/period',   label: 'Period',    match: (p: string) => p.startsWith('/admin/reports/period') },
  { href: '/admin/reports/balances', label: 'Balances',  match: (p: string) => p.startsWith('/admin/reports/balances') },
];

export function ReportsSubnav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      aria-label="Reports sections"
      className="flex items-center gap-1 overflow-x-auto -mb-px"
    >
      {ITEMS.map((it) => {
        const active = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'shrink-0 inline-flex items-center rounded-md px-2.5 py-1.5 text-sm transition-colors',
              active
                ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
            ].join(' ')}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
