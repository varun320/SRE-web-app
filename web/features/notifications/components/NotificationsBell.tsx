'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { fetchRecent, fetchUnreadCount } from '@/features/notifications/queries';
import { markAllRead, markRead } from '@/features/notifications/mutations';
import { formatNotification } from '@/features/notifications/format';
import {
  desktopSupported,
  desktopPermission,
  enableDesktopNotifications,
  fireDesktopNotification,
} from '@/features/notifications/desktop';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const TONE_DOT: Record<string, string> = {
  info:    'dot-info',
  success: 'dot-success',
  warning: 'dot-warning',
  danger:  'dot-danger',
  neutral: 'dot-neutral',
};

export function NotificationsBell() {
  const sb = useMemo(() => getSupabaseBrowser(), []);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const countQ = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => fetchUnreadCount(sb),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const recentQ = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => fetchRecent(sb, 10),
    // Poll silently so desktop toasts fire even when dropdown is closed.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Fire a desktop toast when a new unread notification arrives. Tracks the
  // set of ids we've already toasted so a single arrival doesn't double-fire.
  const toastedIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  useEffect(() => {
    const list = recentQ.data ?? [];
    // First render: prime the set so we don't toast historical items.
    if (!primed.current) {
      for (const n of list) toastedIds.current.add(n.id);
      primed.current = true;
      return;
    }
    for (const n of list) {
      if (n.read_at) continue;
      if (toastedIds.current.has(n.id)) continue;
      toastedIds.current.add(n.id);
      fireDesktopNotification(n);
    }
  }, [recentQ.data]);

  const [permission, setPermission] = useState<NotificationPermission>('default');
  useEffect(() => setPermission(desktopPermission()), []);
  const showEnablePrompt = desktopSupported() && permission === 'default';
  async function enable() {
    const p = await enableDesktopNotifications();
    setPermission(p);
  }

  const markOne = useMutation({
    mutationFn: (id: string) => markRead(sb, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => markAllRead(sb),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = countQ.data ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span
            aria-hidden
            className="notif-badge-pulse absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-status-submitted-fg)] px-1 text-[10px] font-semibold text-white ring-2 ring-[var(--color-surface)]"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        aria-label="Notifications list"
        className="w-80 max-h-[28rem] overflow-hidden p-0"
      >
        <header className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border-soft)]">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          ) : null}
        </header>

        {showEnablePrompt ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/40">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <BellRing className="h-3 w-3" />
              Enable desktop pop-ups?
            </span>
            <button
              type="button"
              onClick={enable}
              className="text-[11px] font-medium text-[var(--color-accent)] hover:underline"
            >
              Turn on
            </button>
          </div>
        ) : null}

        <div className="max-h-80 overflow-y-auto">
          {recentQ.isLoading ? (
            <div className="px-3 py-4 text-xs text-[var(--color-text-muted)]">Loading…</div>
          ) : (recentQ.data ?? []).length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[var(--color-text-muted)]">
              You&apos;re all caught up.
            </div>
          ) : (
            <ul>
              {(recentQ.data ?? []).map((n) => {
                const f = formatNotification(n);
                return (
                  <li key={n.id}>
                    <Link
                      href={f.href}
                      onClick={() => {
                        if (!n.read_at) markOne.mutate(n.id);
                        setOpen(false);
                      }}
                      className={[
                        'flex items-start gap-2.5 px-3 py-2.5 border-b border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/60 transition-colors',
                        n.read_at ? 'opacity-60' : '',
                      ].join(' ')}
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[f.tone]}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[var(--color-text)] leading-snug">{f.title}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                          {relativeTime(new Date(n.created_at))}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="px-3 py-2 border-t border-[var(--color-border-soft)] text-center">
          <Link href="/me/notifications" className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </footer>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function relativeTime(d: Date): string {
  const m = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}
