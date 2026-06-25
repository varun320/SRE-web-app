'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { flags } from '@/lib/flags';

interface SubnavItem {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
}

const BASE_ITEMS: SubnavItem[] = [
  { href: '/admin', label: 'Approvals', match: (p) => p === '/admin' },
  { href: '/admin/employees', label: 'Employees', match: (p) => p.startsWith('/admin/employees') },
  { href: '/admin/projects', label: 'Projects', match: (p) => p.startsWith('/admin/projects') },
  { href: '/admin/positions', label: 'Positions', match: (p) => p.startsWith('/admin/positions') },
  { href: '/admin/approvals', label: 'Audit log', match: (p) => p.startsWith('/admin/approvals') },
  { href: '/admin/reports', label: 'Reports', match: (p) => p.startsWith('/admin/reports') },
];

const ITEMS: SubnavItem[] = flags.importerEnabled
  ? [...BASE_ITEMS, { href: '/admin/import', label: 'Import', match: (p) => p.startsWith('/admin/import') }]
  : BASE_ITEMS;

export function AdminSubnav() {
  const pathname = usePathname() ?? '';
  return (
    <div className="border-b border-[var(--color-border)] -mt-1">
      <nav
        aria-label="Admin sections"
        className="px-4 md:px-6 flex items-center gap-1 overflow-x-auto scrollbar-thin -mb-px"
      >
        {ITEMS.map((it) => {
          const active = it.match(pathname);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'shrink-0 inline-flex items-center px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors',
                active
                  ? 'border-[var(--color-accent)] text-[var(--color-text)] font-medium'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
