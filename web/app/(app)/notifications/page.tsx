import Link from 'next/link';
import { Bell, ExternalLink } from 'lucide-react';
import { getSupabaseServer } from '@/shared/supabase/server';
import { fetchSalesPage } from '@/features/sales/notifications/queries';
import {
  CATEGORY_LABEL,
  CATEGORY_TONE,
  SALES_NOTIFICATION_CATEGORIES,
  isSalesNotificationCategory,
  type SalesNotificationCategory,
} from '@/features/sales/notifications/types';
import { PageHeader } from '@/shared/ui/page-header';
import { EmptyState } from '@/shared/ui/empty-state';
import { StatusBadge } from '@/shared/ui/status-badge';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

interface SearchParams {
  category?: string;
  before?: string;
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const m = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}

function toneToBadge(tone: string): 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'muted' {
  if (tone === 'success' || tone === 'warning' || tone === 'danger' || tone === 'info') return tone;
  return 'muted';
}

export default async function SalesInboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const category: SalesNotificationCategory | null = isSalesNotificationCategory(sp.category)
    ? sp.category
    : null;
  const before = sp.before && sp.before.length > 0 ? sp.before : null;

  const sb = await getSupabaseServer();
  const rows = await fetchSalesPage(sb, {
    category,
    limit: PAGE_SIZE + 1,
    before,
  });
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const lastCreatedAt = page.length > 0 ? page[page.length - 1].created_at : null;

  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-5">
      <PageHeader
        title="Sales inbox"
        description="Follow-ups, approvals, wins, and losses from GHL. Marked as read when you click through."
      />

      <FilterBar current={category} />

      {page.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={category ? `No ${CATEGORY_LABEL[category]} notifications` : 'Inbox is empty'}
          description="Notifications land here as the GHL automations sidecar posts events."
        />
      ) : (
        <ul className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
          {page.map((n) => {
            const tone = CATEGORY_TONE[n.category] ?? 'neutral';
            const href = n.action_url ?? `/sales?opp=${n.opportunity_id}`;
            return (
              <li
                key={n.id}
                className="border-b border-[var(--color-border-soft)] last:border-b-0"
              >
                <Link
                  href={href}
                  className={[
                    'flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)]/60 transition-colors',
                    n.read_at ? 'opacity-70' : '',
                  ].join(' ')}
                >
                  <div className="mt-0.5 shrink-0">
                    <StatusBadge tone={toneToBadge(tone)}>
                      {CATEGORY_LABEL[n.category] ?? n.category}
                    </StatusBadge>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-[var(--color-text)] leading-snug">{n.title}</p>
                      <span className="shrink-0 text-[11px] font-mono tabular text-[var(--color-text-subtle)]">
                        {relativeTime(n.created_at)}
                      </span>
                    </div>
                    {n.body ? (
                      <p className="mt-1 text-xs text-[var(--color-text-muted)] whitespace-pre-wrap">
                        {n.body}
                      </p>
                    ) : null}
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-1 text-[var(--color-text-subtle)]" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && lastCreatedAt ? (
        <div className="text-center">
          <Link
            href={`/notifications?${new URLSearchParams({
              ...(category ? { category } : {}),
              before: lastCreatedAt,
            }).toString()}`}
            className="inline-flex items-center rounded-md border border-[var(--color-border-soft)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/60"
          >
            Load older
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function FilterBar({ current }: { current: SalesNotificationCategory | null }) {
  const chips: { label: string; value: SalesNotificationCategory | null }[] = [
    { label: 'All', value: null },
    ...SALES_NOTIFICATION_CATEGORIES.map((c) => ({
      label: CATEGORY_LABEL[c],
      value: c,
    })),
  ];
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border-soft)] pb-3">
      {chips.map((c) => {
        const active = current === c.value;
        const href = c.value ? `/notifications?category=${c.value}` : '/notifications';
        return (
          <Link
            key={c.label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={[
              'inline-flex items-center rounded-md px-2.5 py-1 text-xs transition-colors',
              active
                ? 'bg-[var(--color-surface-2)] text-[var(--color-text)] font-medium'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/60',
            ].join(' ')}
          >
            {c.label}
          </Link>
        );
      })}
    </div>
  );
}
