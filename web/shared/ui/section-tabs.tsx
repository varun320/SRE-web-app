'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

export interface SectionTab {
  href: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  match: (pathname: string) => boolean;
}

interface Props {
  tabs: SectionTab[];
  /** Low-frequency tabs tucked into a "More" dropdown at the end. */
  overflow?: SectionTab[];
  ariaLabel: string;
}

export function SectionTabs({ tabs, overflow, ariaLabel }: Props) {
  const pathname = usePathname() ?? '';
  const overflowActive = (overflow ?? []).some((t) => t.match(pathname));
  return (
    <nav
      aria-label={ariaLabel}
      className="sticky top-0 z-10 mb-4 border-b border-[var(--color-border-soft)] bg-[color-mix(in_oklab,var(--color-surface)_92%,transparent)] backdrop-blur px-3 md:px-4"
    >
      <ul className="flex gap-0.5 overflow-x-auto overflow-y-hidden items-stretch">
        {tabs.map((t) => (
          <TabLi key={t.href} tab={t} active={t.match(pathname)} />
        ))}
        {overflow && overflow.length > 0 ? (
          <li className="flex items-stretch">
            <OverflowMenu items={overflow} active={overflowActive} pathname={pathname} />
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

function TabLi({ tab, active }: { tab: SectionTab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <li>
      <Link
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        title={tab.hint}
        className={[
          'group relative flex items-start gap-2 whitespace-nowrap px-3 py-2 border-b-2 -mb-px transition-colors',
          active
            ? 'border-[var(--color-accent)] text-[var(--color-text)]'
            : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/40',
        ].join(' ')}
      >
        {Icon ? (
          <Icon
            className={[
              'h-4 w-4 mt-0.5 shrink-0',
              active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]',
            ].join(' ')}
          />
        ) : null}
        <span className="flex flex-col leading-tight text-left">
          <span className={active ? 'text-sm font-medium' : 'text-sm'}>{tab.label}</span>
          {tab.hint ? (
            <span className="hidden md:block text-[10.5px] text-[var(--color-text-muted)] mt-0.5">
              {tab.hint}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

function OverflowMenu({
  items,
  active,
  pathname,
}: {
  items: SectionTab[];
  active: boolean;
  pathname: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More sections"
        className={[
          'group relative flex items-center gap-1 whitespace-nowrap px-3 py-2 border-b-2 -mb-px transition-colors text-sm',
          active
            ? 'border-[var(--color-accent)] text-[var(--color-text)] font-medium'
            : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/40',
        ].join(' ')}
      >
        <MoreHorizontal
          className={[
            'h-4 w-4 shrink-0',
            active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]',
          ].join(' ')}
        />
        More
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-48">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = it.match(pathname);
          return (
            <DropdownMenuItem
              key={it.href}
              onClick={() => {
                window.location.href = it.href;
              }}
              className={isActive ? 'font-medium text-[var(--color-accent)]' : ''}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {it.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
