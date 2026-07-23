'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export interface SectionTab {
  href: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  match: (pathname: string) => boolean;
}

interface Props {
  tabs: SectionTab[];
  ariaLabel: string;
}

export function SectionTabs({ tabs, ariaLabel }: Props) {
  const pathname = usePathname() ?? '';
  return (
    <nav
      aria-label={ariaLabel}
      className="sticky top-0 z-10 -mx-3 md:-mx-4 mb-4 border-b border-[var(--color-border-soft)] bg-[color-mix(in_oklab,var(--color-surface)_92%,transparent)] backdrop-blur px-3 md:px-4"
    >
      <ul className="flex gap-0.5 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                title={t.hint}
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
                  <span className={active ? 'text-sm font-medium' : 'text-sm'}>{t.label}</span>
                  {t.hint ? (
                    <span className="hidden md:block text-[10.5px] text-[var(--color-text-muted)] mt-0.5">
                      {t.hint}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
