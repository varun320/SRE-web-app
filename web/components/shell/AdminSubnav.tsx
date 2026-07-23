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
} from 'lucide-react';
import { flags } from '@/lib/flags';
import { SectionTabs, type SectionTab } from '@/components/ui/section-tabs';

const BASE_ITEMS: SectionTab[] = [
  { href: '/admin',           label: 'Approvals',    icon: Inbox,        match: (p) => p === '/admin' },
  { href: '/admin/expenses',  label: 'Expenses',     icon: Receipt,      match: (p) => p.startsWith('/admin/expenses') },
  { href: '/admin/employees', label: 'Employees',    icon: Users,        match: (p) => p.startsWith('/admin/employees') },
  { href: '/admin/projects',  label: 'Projects',     icon: FolderKanban, match: (p) => p.startsWith('/admin/projects') },
  { href: '/admin/positions', label: 'Positions',    icon: Briefcase,    match: (p) => p.startsWith('/admin/positions') },
  { href: '/admin/locked',    label: 'Locked weeks', icon: Lock,         match: (p) => p.startsWith('/admin/locked') },
  { href: '/admin/approvals', label: 'Audit log',    icon: ScrollText,   match: (p) => p.startsWith('/admin/approvals') },
  { href: '/admin/reports',   label: 'Reports',      icon: BarChart3,    match: (p) => p.startsWith('/admin/reports') },
];

const ITEMS: SectionTab[] = flags.importerEnabled
  ? [...BASE_ITEMS, { href: '/admin/import', label: 'Import', icon: Upload, match: (p) => p.startsWith('/admin/import') }]
  : BASE_ITEMS;

export function AdminSubnav() {
  return <SectionTabs tabs={ITEMS} ariaLabel="Admin sections" />;
}
