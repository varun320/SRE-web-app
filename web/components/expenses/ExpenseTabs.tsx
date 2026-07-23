'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
}

interface Props {
  tabs: Tab[];
}

export function ExpenseTabs({ tabs }: Props) {
  const pathname = usePathname() ?? '';
  return (
    <nav
      aria-label="Expense sections"
      className="sticky top-0 z-10 -mx-3 md:-mx-4 mb-4 border-b border-[var(--color-border-soft)] bg-[color-mix(in_oklab,var(--color-surface)_92%,transparent)] backdrop-blur px-3 md:px-4"
    >
      <ul className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={
                  'inline-flex items-center whitespace-nowrap px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors ' +
                  (active
                    ? 'border-[var(--color-accent)] text-[var(--color-text)] font-medium'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]')
                }
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const EMPLOYEE_EXPENSE_TABS: Tab[] = [
  {
    href: '/expenses',
    label: 'Reports',
    match: (p) =>
      p === '/expenses' ||
      (p.startsWith('/expenses/') &&
        !p.startsWith('/expenses/lines') &&
        !p.startsWith('/expenses/balance') &&
        !p.startsWith('/expenses/settings')),
  },
  { href: '/expenses/lines', label: 'All lines', match: (p) => p.startsWith('/expenses/lines') },
  { href: '/expenses/balance', label: 'Balance', match: (p) => p.startsWith('/expenses/balance') },
  { href: '/expenses/settings', label: 'Settings', match: (p) => p.startsWith('/expenses/settings') },
];

export const ADMIN_EXPENSE_TABS: Tab[] = [
  {
    href: '/admin/expenses',
    label: 'Reports',
    match: (p) =>
      p === '/admin/expenses' ||
      (p.startsWith('/admin/expenses/') &&
        !p.startsWith('/admin/expenses/lines') &&
        !p.startsWith('/admin/expenses/payouts')),
  },
  { href: '/admin/expenses/lines', label: 'Line items', match: (p) => p.startsWith('/admin/expenses/lines') },
  { href: '/admin/expenses/payouts', label: 'Payouts', match: (p) => p.startsWith('/admin/expenses/payouts') },
];
