'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Clock,
  Home,
  Palmtree,
  Receipt,
  Shield,
  Menu,
  X,
  LogOut,
  Bell,
  Plug,
  User,
} from 'lucide-react';
import { HelpButton } from './HelpButton';
import { NotificationsBell } from './NotificationsBell';
import { ThemeToggle } from './ThemeToggle';
import { SnakeGame } from '@/components/fun/SnakeGame';
import { useIdle } from '@/lib/hooks/useIdle';
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

// Top-level tabs. TIL bank + Vacation intentionally live under the Me dropdown
// (they're already surfaced as cards on /home) to keep the top bar to four
// primary tabs: Home, Week, Expenses, Admin.
const TOP_NAV: NavItem[] = [
  { href: '/home',          label: 'Home',     icon: Home,         match: (p) => p === '/home' || p === '/' },
  { href: '/week/current',  label: 'Week',     icon: CalendarDays, match: (p) => p.startsWith('/week') },
  { href: '/expenses',      label: 'Expenses', icon: Receipt,      match: (p) => p.startsWith('/expenses') },
];

const ME_NAV: NavItem[] = [
  { href: '/me/til',           label: 'TIL bank',      icon: Clock,    match: (p) => p.startsWith('/me/til') },
  { href: '/me/vacation',      label: 'Vacation',      icon: Palmtree, match: (p) => p.startsWith('/me/vacation') },
  { href: '/me/notifications', label: 'Notifications', icon: Bell,     match: (p) => p.startsWith('/me/notifications') },
];

const ADMIN_ITEM: NavItem = {
  href: '/admin', label: 'Admin', icon: Shield, match: (p) => p.startsWith('/admin'),
};

interface HeaderProps {
  email: string;
  isAdmin?: boolean;
}

export function Header({ email, isAdmin }: HeaderProps) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const [snakeOpen, setSnakeOpen] = useState(false);
  const idle = useIdle(30_000);
  const wiggle = idle && !snakeOpen;
  const tapStreak = useRef<number[]>([]);

  const topItems: NavItem[] = isAdmin ? [...TOP_NAV, ADMIN_ITEM] : TOP_NAV;
  const meActive = ME_NAV.some((it) => it.match(pathname));
  const initial = (email?.[0] ?? '?').toUpperCase();

  const onBrandTap = () => {
    const now = Date.now();
    tapStreak.current = [...tapStreak.current.filter((t) => now - t < 2000), now];
    if (tapStreak.current.length >= 5) {
      tapStreak.current = [];
      setSnakeOpen(true);
    }
  };

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_88%,transparent)] backdrop-blur">
      <div className="w-full px-3 md:px-4 h-12 grid grid-cols-[auto_1fr_auto] items-center gap-2">
        {/* Brand — 5× tap the glyph for Snake */}
        <Link
          href="/home"
          className="flex items-center gap-2 font-semibold tracking-tight text-[var(--color-text)]"
        >
          <span
            onClick={(e) => { e.preventDefault(); onBrandTap(); }}
            className={[
              'inline-flex h-6 w-6 items-center justify-center cursor-pointer select-none active:scale-95 transition-transform',
              wiggle ? 'brand-wiggle' : '',
            ].join(' ')}
            title="psst — tap me 5×"
          >
            <img src="/sre-logo.svg" alt="SRE" className="h-6 w-6" />
          </span>
          <span className="hidden sm:inline text-sm">SRE</span>
        </Link>

        {/* Center — tabs */}
        <nav className="hidden md:flex items-center justify-center gap-0.5">
          {topItems.map((it) => (
            <NavLink key={it.href} item={it} active={it.match(pathname)} />
          ))}
          <MeDropdown items={ME_NAV} active={meActive} pathname={pathname} />
        </nav>
        <div className="md:hidden" />

        {/* Right — chrome */}
        <div className="hidden md:flex items-center gap-1 justify-self-end">
          <NotificationsBell />
          <HelpButton />
          <ThemeToggle />
          <UserMenu email={email} initial={initial} isAdmin={isAdmin} />
        </div>

        {/* Mobile actions */}
        <div className="flex md:hidden items-center gap-0.5 justify-self-end">
          <NotificationsBell />
          <ThemeToggle />
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

      {snakeOpen ? <SnakeGame onClose={() => setSnakeOpen(false)} /> : null}

      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        topItems={topItems}
        meItems={ME_NAV}
        pathname={pathname}
        email={email}
        isAdmin={isAdmin}
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
        'relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md transition-colors',
        active
          ? 'text-[var(--color-text)] font-medium'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" />
      {item.label}
      {active ? (
        <span
          aria-hidden
          className="underline-slide absolute left-2 right-2 -bottom-[9px] h-[2px] rounded-t"
          style={{ background: 'var(--color-accent)' }}
        />
      ) : null}
    </Link>
  );
}

function MeDropdown({ items, active, pathname }: { items: NavItem[]; active: boolean; pathname: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={[
          'relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md transition-colors',
          active
            ? 'text-[var(--color-text)] font-medium'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
        ].join(' ')}
      >
        <User className="h-3.5 w-3.5" />
        Me
        <ChevronDown className="h-3 w-3 opacity-60" />
        {active ? (
          <span
            aria-hidden
            className="underline-slide absolute left-2 right-2 -bottom-[9px] h-[2px] rounded-t"
            style={{ background: 'var(--color-accent)' }}
          />
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="min-w-44">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = it.match(pathname);
          return (
            <DropdownMenuItem
              key={it.href}
              onClick={() => { window.location.href = it.href; }}
              className={isActive ? 'font-medium text-[var(--color-accent)]' : ''}
            >
              <Icon className="h-3.5 w-3.5" />
              {it.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ email, initial, isAdmin }: { email: string; initial: string; isAdmin?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={formRef} action="/auth/signout" method="post" className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-xs font-semibold text-[var(--color-text)] ring-1 ring-[var(--color-border)] hover:ring-[var(--color-accent)] transition-colors"
        >
          {initial}
          {isAdmin ? (
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--color-surface)]"
              style={{ background: 'var(--color-accent)' }}
              title="Admin"
            />
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-xs text-[var(--color-text-muted)] font-normal">Signed in as</span>
              <span className="truncate text-sm text-[var(--color-text)]">{email}</span>
              <span className="mt-1 inline-flex w-fit rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                {isAdmin ? 'Admin' : 'Employee'}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { window.location.href = '/mcp-setup'; }}>
            <Plug className="h-3.5 w-3.5" />
            Claude connector
          </DropdownMenuItem>
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
  topItems: NavItem[];
  meItems: NavItem[];
  pathname: string;
  email: string;
  isAdmin?: boolean;
}

function MobileDrawer({ open, onClose, topItems, meItems, pathname, email, isAdmin }: MobileDrawerProps) {
  return (
    <div
      className={[
        'md:hidden fixed inset-x-0 top-12 bottom-0 z-30 transition-opacity',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      ].join(' ')}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />
      <div
        className={[
          'absolute inset-x-0 top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] shadow-lg',
          'transition-transform duration-200',
          open ? 'translate-y-0' : '-translate-y-2',
        ].join(' ')}
      >
        <nav className="flex flex-col p-3 gap-0.5">
          {topItems.map((it) => (
            <DrawerLink key={it.href} item={it} pathname={pathname} />
          ))}
          <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Me</div>
          {meItems.map((it) => (
            <DrawerLink key={it.href} item={it} pathname={pathname} />
          ))}
          <div className="my-2 h-px bg-[var(--color-border-soft)]" />
          <div className="px-3 pt-1 pb-2">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Signed in as</div>
            <div className="truncate text-sm text-[var(--color-text)]">{email}</div>
            <span className="mt-1 inline-flex w-fit rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              {isAdmin ? 'Admin' : 'Employee'}
            </span>
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

function DrawerLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = item.match(pathname);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium'
          : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
