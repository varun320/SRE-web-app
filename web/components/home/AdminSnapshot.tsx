import Link from 'next/link';
import {
  Inbox,
  LineChart,
  Users,
  ArrowUpRight,
} from 'lucide-react';

export interface AdminSnapshotProps {
  pendingApprovals: number;
  openPipelineValue: number;
  agingDeals: number;
  balanceAlerts: number;
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export function AdminSnapshot({
  pendingApprovals,
  openPipelineValue,
  agingDeals,
  balanceAlerts,
}: AdminSnapshotProps) {
  const cards: {
    key: string;
    href: string;
    label: string;
    value: string;
    detail: string;
    icon: typeof Inbox;
  }[] = [
    {
      key: 'approvals',
      href: '/admin',
      label: 'Pending approvals',
      value: String(pendingApprovals),
      detail: pendingApprovals === 0 ? 'Inbox clear' : `${pendingApprovals} week${pendingApprovals === 1 ? '' : 's'} awaiting review`,
      icon: Inbox,
    },
    {
      key: 'pipeline',
      href: '/sales',
      label: 'Sales pipeline',
      value: money(openPipelineValue),
      detail: agingDeals === 0 ? 'Nothing aging' : `${agingDeals} deal${agingDeals === 1 ? '' : 's'} ≥30d in stage`,
      icon: LineChart,
    },
    {
      key: 'balances',
      href: '/admin?view=balances',
      label: 'Balance alerts',
      value: String(balanceAlerts),
      detail: balanceAlerts === 0 ? 'All clear' : `${balanceAlerts} employee${balanceAlerts === 1 ? '' : 's'} need action`,
      icon: Users,
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-h3">Admin snapshot</h2>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-body-sm text-[var(--color-accent)] hover:gap-1.5 transition-all"
        >
          Open admin
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.key}
              href={c.href}
              className="lift-hover rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3.5 hover:bg-[var(--color-surface-2)]/40 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-caption uppercase tracking-wide text-[var(--color-text-subtle)]">
                <Icon className="h-3 w-3" />
                {c.label}
              </div>
              <div className="mt-1.5 font-mono tabular text-2xl font-medium text-[var(--color-text)] leading-none">
                {c.value}
              </div>
              <div className="mt-1 text-body-sm text-[var(--color-text-muted)]">{c.detail}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
