'use client';

import { Receipt, List, Scale, Settings, BadgeDollarSign } from 'lucide-react';
import { SectionTabs, type SectionTab } from '@/components/ui/section-tabs';

export const EMPLOYEE_EXPENSE_TABS: SectionTab[] = [
  {
    href: '/expenses',
    label: 'Reports',
    hint: 'Your monthly submissions',
    icon: Receipt,
    match: (p) =>
      p === '/expenses' ||
      (p.startsWith('/expenses/') &&
        !p.startsWith('/expenses/lines') &&
        !p.startsWith('/expenses/balance') &&
        !p.startsWith('/expenses/settings')),
  },
  {
    href: '/expenses/lines',
    label: 'All lines',
    hint: 'Every line item, filterable',
    icon: List,
    match: (p) => p.startsWith('/expenses/lines'),
  },
  {
    href: '/expenses/balance',
    label: 'Balance',
    hint: 'What SRE owes you (with interest)',
    icon: Scale,
    match: (p) => p.startsWith('/expenses/balance'),
  },
  {
    href: '/expenses/settings',
    label: 'Settings',
    hint: 'Credit cards & interest rate',
    icon: Settings,
    match: (p) => p.startsWith('/expenses/settings'),
  },
];

export const ADMIN_EXPENSE_TABS: SectionTab[] = [
  {
    href: '/admin/expenses',
    label: 'Reports',
    hint: 'Approve, decline, edit submissions',
    icon: Receipt,
    match: (p) =>
      p === '/admin/expenses' ||
      (p.startsWith('/admin/expenses/') &&
        !p.startsWith('/admin/expenses/lines') &&
        !p.startsWith('/admin/expenses/payouts')),
  },
  {
    href: '/admin/expenses/lines',
    label: 'Line items',
    hint: 'All lines across the org',
    icon: List,
    match: (p) => p.startsWith('/admin/expenses/lines'),
  },
  {
    href: '/admin/expenses/payouts',
    label: 'Payouts',
    hint: 'Log & audit payments',
    icon: BadgeDollarSign,
    match: (p) => p.startsWith('/admin/expenses/payouts'),
  },
];

export function ExpenseTabs({ tabs }: { tabs: SectionTab[] }) {
  return <SectionTabs tabs={tabs} ariaLabel="Expense sections" />;
}
