'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock, Palmtree, Shield, Menu, X, LogOut, Bell } from 'lucide-react';
import { HelpButton } from './HelpButton';
import { NotificationsBell } from './NotificationsBell';
import { SnakeGame } from '@/components/fun/SnakeGame';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
}

const BASE_NAV: NavItem[] = [
  {
    href: '/week/current',
    label: 'Week',
    icon: CalendarDays,
    match: (p) => p.startsWith('/week'),
  },
  {
    href: '/me/til',
    label: 'TIL bank',
    icon: Clock,
    match: (p) => p.startsWith('/me/til'),
  },
  {
    href: '/me/vacation',
    label: 'Vacation',
    icon: Palmtree,
    match: (p) => p.startsWith('/me/vacation'),
  },
];

const ADMIN_ITEM: NavItem = {
  href: '/admin',
  label: 'Admin',
  icon: Shield,
  match: (p) => p.startsWith('/admin'),
};

interface HeaderProps {
  email: string;
  isAdmin?: boolean;
}

export function Header({ email, isAdmin }: HeaderProps) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const [snakeOpen, setSnakeOpen] = useState(false);
  const tapStreak = useRef<number[]>([]);
  const items = isAdmin ? [...BASE_NAV, ADMIN_ITEM] : BASE_NAV;
  const initial = (email?.[0] ?? '?').toUpperCase();

  // Easter egg: tap the SRE glyph 5 times within 2s to launch Snake.
  const onBrandTap = () => {
    const now = Date.now();
    tapStreak.current = [...tapStreak.current.filter((t) => now - t < 2000), now];
    if (tapStreak.current.length >= 5) {
      tapStreak.current = [];
      setSnakeOpen(true);
    }
  };

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_82%,transparent)] backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-surface)_72%,transparent)]">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-14 flex items-center gap-3">
        {/* Brand — tap the glyph 5× quickly to summon Snake */}
        <Link
          href="/week/current"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span
            aria-hidden
            onClick={(e) => { e.preventDefault(); onBrandTap(); }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white cursor-pointer select-none active:scale-95 transition-transform"
            style={{ background: 'var(--color-accent)' }}
            title="psst — tap me 5×"
          >
            SRE
          </span>
          <span className="hidden sm:inline">Timesheet</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {items.map((it) => (
            <NavLink key={it.href} item={it} active={it.match(pathname)} />
          ))}
        </nav>

        <div className="flex-1" />

        {/* Right cluster — desktop */}
        <div className="hidden md:flex items-center gap-2">
          <NotificationsBell />
          <HelpButton />
          <UserMenu email={email} initial={initial} />
        </div>

        {/* Mobile actions */}
        <div className="flex md:hidden items-center gap-1">
          <NotificationsBell />
          <HelpButton />
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Easter egg: hidden Snake game */}
      {snakeOpen ? <SnakeGame onClose={() => setSnakeOpen(false)} /> : null}

      {/* Mobile drawer */}
      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        pathname={pathname}
        email={email}
      />
    </header>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
        active
          ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" />
      {item.label}
    </Link>
  );
}

function UserMenu({ email, initial }: { email: string; initial: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={formRef} action="/auth/signout" method="post" className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-xs font-semibold text-[var(--color-text)] ring-1 ring-[var(--color-border)] hover:ring-[var(--color-accent)] transition-colors"
        >
          {initial}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-xs text-[var(--color-text-muted)] font-normal">
                Signed in as
              </span>
              <span className="truncate text-sm text-[var(--color-text)]">
                {email}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => formRef.current?.submit()}>
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  pathname: string;
  email: string;
}

function MobileDrawer({ open, onClose, items, pathname, email }: MobileDrawerProps) {
  return (
    <div
      className={[
        'md:hidden fixed inset-x-0 top-14 bottom-0 z-30 transition-opacity',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      ].join(' ')}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />
      {/* Panel */}
      <div
        className={[
          'absolute inset-x-0 top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] shadow-lg',
          'transition-transform duration-200',
          open ? 'translate-y-0' : '-translate-y-2',
        ].join(' ')}
      >
        <nav className="flex flex-col p-3 gap-1">
          {items.map((it) => {
            const Icon = it.icon;
            const active = it.match(pathname);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
          <Link
            href="/me/notifications"
            aria-current={pathname.startsWith('/me/notifications') ? 'page' : undefined}
            className={[
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
              pathname.startsWith('/me/notifications')
                ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium'
                : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
            ].join(' ')}
          >
            <Bell className="h-4 w-4" />
            Notifications
          </Link>
          <div className="my-2 h-px bg-[var(--color-border-soft)]" />
          <div className="px-3 pt-1 pb-2">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Signed in as
            </div>
            <div className="truncate text-sm text-[var(--color-text)]">{email}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </div>
  );
}
