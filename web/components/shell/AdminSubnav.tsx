'use client';

import {
  Inbox,
  Receipt,
  Users,
  FolderKanban,
  Briefcase,
  Lock,
  ScrollText,
  BarChart3,
  Upload,
  LineChart,
} from 'lucide-react';
import { flags } from '@/shared/lib/flags';
import { SectionTabs, type SectionTab } from '@/shared/ui/section-tabs';

// Primary tabs: high-frequency admin surfaces (daily/weekly).
const PRIMARY: SectionTab[] = [
  { href: '/admin',           label: 'Approvals', icon: Inbox,        match: (p) => p === '/admin' },
  { href: '/admin/employees', label: 'Employees', icon: Users,        match: (p) => p.startsWith('/admin/employees') },
  { href: '/admin/projects',  label: 'Projects',  icon: FolderKanban, match: (p) => p.startsWith('/admin/projects') },
  { href: '/admin/sales',     label: 'Sales',     icon: LineChart,    match: (p) => p.startsWith('/admin/sales') },
  { href: '/admin/reports',   label: 'Reports',   icon: BarChart3,    match: (p) => p.startsWith('/admin/reports') },
];

// Low-frequency (config / investigative). Tucked under a "More" dropdown so
// the primary bar reads as work-queue, not a settings page.
const OVERFLOW_BASE: SectionTab[] = [
  { href: '/admin/expenses',  label: 'Expenses',     icon: Receipt,    match: (p) => p.startsWith('/admin/expenses') },
  { href: '/admin/positions', label: 'Positions',    icon: Briefcase,  match: (p) => p.startsWith('/admin/positions') },
  { href: '/admin/locked',    label: 'Locked weeks', icon: Lock,       match: (p) => p.startsWith('/admin/locked') },
  { href: '/admin/approvals', label: 'Audit log',    icon: ScrollText, match: (p) => p.startsWith('/admin/approvals') },
];

const OVERFLOW: SectionTab[] = flags.importerEnabled
  ? [...OVERFLOW_BASE, { href: '/admin/import', label: 'Import', icon: Upload, match: (p) => p.startsWith('/admin/import') }]
  : OVERFLOW_BASE;

export function AdminSubnav() {
  return <SectionTabs tabs={PRIMARY} overflow={OVERFLOW} ariaLabel="Admin sections" />;
}
