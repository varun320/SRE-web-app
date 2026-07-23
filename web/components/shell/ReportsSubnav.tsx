'use client';

import { DollarSign, UserRound, Tag, FolderKanban, CalendarClock } from 'lucide-react';
import { SectionTabs, type SectionTab } from '@/components/ui/section-tabs';

const ITEMS: SectionTab[] = [
  {
    href: '/admin/reports/payroll',
    label: 'Pay period',
    hint: 'What to pay this biweekly cycle',
    icon: DollarSign,
    match: (p) => p.startsWith('/admin/reports/payroll'),
  },
  {
    href: '/admin/reports/period',
    label: 'Employee breakdown',
    hint: "One person's hours over a range",
    icon: UserRound,
    match: (p) => p.startsWith('/admin/reports/period'),
  },
  {
    href: '/admin/reports/categories',
    label: 'Hours by category',
    hint: 'Where team time went',
    icon: Tag,
    match: (p) => p.startsWith('/admin/reports/categories'),
  },
  {
    href: '/admin/reports/projects',
    label: 'Hours by project',
    hint: 'Time booked per project',
    icon: FolderKanban,
    match: (p) => p.startsWith('/admin/reports/projects'),
  },
  {
    href: '/admin/reports/balances',
    label: 'Time-off balances',
    hint: 'TIL & vacation left per employee',
    icon: CalendarClock,
    match: (p) => p.startsWith('/admin/reports/balances'),
  },
];

export function ReportsSubnav() {
  return <SectionTabs tabs={ITEMS} ariaLabel="Reports" />;
}

export const REPORT_ITEMS = ITEMS;
