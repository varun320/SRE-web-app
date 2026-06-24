'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Check } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { fetchRecent, type NotificationRow } from '@/lib/notifications/queries';
import { markRead, markAllRead } from '@/lib/notifications/mutations';
import { formatNotification } from '@/lib/notifications/format';
import { EmptyState } from '@/components/ui/empty-state';

const TONE_DOT: Record<string, string> = {
  info:    'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  neutral: 'bg-[var(--color-text-muted)]',
};

export function NotificationsList({ initial }: { initial: NotificationRow[] }) {
  const sb = useMemo(() => getSupabaseBrowser(), []);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['notifications', 'page'],
    queryFn: () => fetchRecent(sb, 50),
    initialData: initial,
    refetchInterval: 60_000,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markRead(sb, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => markAllRead(sb),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const rows = q.data ?? [];
  const unreadCount = rows.filter((r) => !r.read_at).length;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications yet"
        description="When you submit a week or an admin acts on one of your weeks, it'll show up here."
      />
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-[var(--color-text-muted)]">
          <span className="font-medium text-[var(--color-text)]">{rows.length}</span>{' '}
          total · <span className="font-medium text-[var(--color-text)]">{unreadCount}</span> unread
        </p>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-60"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        ) : null}
      </div>

      <ul className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--color-border-soft)]">
        {rows.map((n) => {
          const f = formatNotification(n);
          return (
            <li
              key={n.id}
              className={[
                'flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)]/60 transition-colors',
                n.read_at ? 'opacity-60' : '',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[f.tone]}`}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={f.href}
                  onClick={() => {
                    if (!n.read_at) markOne.mutate(n.id);
                  }}
                  className="text-sm text-[var(--color-text)] hover:underline"
                >
                  {f.title}
                </Link>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 font-mono">
                  {new Date(n.created_at).toISOString().replace('T', ' ').slice(0, 16)}
                </p>
              </div>
              {!n.read_at ? (
                <button
                  type="button"
                  onClick={() => markOne.mutate(n.id)}
                  disabled={markOne.isPending}
                  title="Mark read"
                  aria-label="Mark read"
                  className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
