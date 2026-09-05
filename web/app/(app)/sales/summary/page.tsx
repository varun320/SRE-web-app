import { AlertTriangle, FileText } from 'lucide-react';
import { getSummary } from '@/features/sales/client';
import { PageHeader } from '@/shared/ui/page-header';
import { EmptyState } from '@/shared/ui/empty-state';
import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function SalesSummaryPage() {
  const { data: summary, stale, error, source } = await getSummary();

  if (summary.totalOpportunities === 0) {
    return (
      <div className="px-3 md:px-4 py-5 md:py-6">
        <EmptyState
          icon={FileText}
          title="No sales data"
          description="Once opportunities land in the GHL pipeline, they'll appear here."
        />
      </div>
    );
  }

  const maxStageCount = Math.max(...summary.byStage.map((s) => s.count), 1);
  const maxStageValue = Math.max(...summary.byStage.map((s) => s.value), 1);

  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-6 print:py-2">
      <style>{`
        @media print {
          nav { display: none; }
          .no-print { display: none; }
          body { background: white; }
        }
      `}</style>

      <div className="flex items-start justify-between gap-4 print:block">
        <PageHeader
          title="SRE Sales — Exec Summary"
          description={`Generated ${fmtDateTime(summary.generatedAt)}`}
        />
        <div className="no-print">
          <PrintButton />
        </div>
      </div>

      {stale ? (
        <div className="no-print flex items-start gap-2 rounded-md border border-[var(--color-status-declined-bg)] bg-[var(--color-status-declined-bg)]/40 px-3 py-2 text-sm text-[var(--color-status-declined-fg)]">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">
              {source === 'fixture'
                ? 'Live sync unavailable — showing fixture data.'
                : 'Showing cached data.'}
            </div>
            {error ? <div className="mt-0.5 text-xs opacity-80">{error}</div> : null}
          </div>
        </div>
      ) : null}

      <Section title="Pipeline by stage">
        <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)]/40 text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)]">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Stage</th>
                <th className="text-left px-3 py-2 font-medium w-1/3">Count</th>
                <th className="text-left px-3 py-2 font-medium w-1/3">Value</th>
              </tr>
            </thead>
            <tbody>
              {summary.byStage.map((row) => (
                <tr
                  key={row.stage}
                  className="border-t border-[var(--color-border-soft)]"
                >
                  <td className="px-3 py-2 text-[var(--color-text)]">{row.stage}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-accent)]"
                          style={{ width: `${(row.count / maxStageCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-right font-mono tabular text-[var(--color-text)]">
                        {row.count}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-accent)] opacity-60"
                          style={{ width: `${(row.value / maxStageValue) * 100}%` }}
                        />
                      </div>
                      <span className="w-20 text-right font-mono tabular text-[var(--color-text)]">
                        {fmtCurrency(row.value)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Section title="Win rate (90d)">
          <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-6 text-center h-full">
            <div className="text-5xl font-semibold text-[var(--color-text)] tabular">
              {summary.winRate90d.ratePct}%
            </div>
            <div className="mt-2 text-sm text-[var(--color-text-muted)]">
              {summary.winRate90d.won} won · {summary.winRate90d.lost} lost
            </div>
          </div>
        </Section>

        <Section title="Total opportunities" className="md:col-span-2">
          <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-6 h-full">
            <div className="text-5xl font-semibold text-[var(--color-text)] tabular">
              {summary.totalOpportunities}
            </div>
            <div className="mt-2 text-sm text-[var(--color-text-muted)]">
              across {summary.byCountry.length} countries and{' '}
              {summary.byStage.filter((s) => s.count > 0).length} active stages
            </div>
          </div>
        </Section>
      </div>

      <Section title="Top customers by value">
        <Table
          headers={['Customer', 'Deals', 'Total value']}
          rows={summary.topCustomers.map((c) => [
            c.customer,
            <span key="c" className="font-mono tabular">{c.count}</span>,
            <span key="v" className="font-mono tabular">{fmtCurrency(c.value)}</span>,
          ])}
        />
      </Section>

      <Section title="Aging deals (≥30d in stage)">
        {summary.agingDeals.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] italic">
            No deals are aging.
          </p>
        ) : (
          <Table
            headers={['Days', 'Stage', 'Deal']}
            rows={summary.agingDeals.map((d) => [
              <span
                key="d"
                className={`font-mono tabular ${
                  d.daysInStage >= 30
                    ? 'text-[var(--color-status-declined-fg)] font-medium'
                    : ''
                }`}
              >
                {d.daysInStage}d
              </span>,
              d.stage,
              d.name,
            ])}
          />
        )}
      </Section>

      <Section title="By country">
        <Table
          headers={['Country', 'Deals', 'Value']}
          rows={summary.byCountry.map((c) => [
            c.country,
            <span key="c" className="font-mono tabular">{c.count}</span>,
            <span key="v" className="font-mono tabular">{fmtCurrency(c.value)}</span>,
          ])}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h3 className="mb-2 text-sm font-medium text-[var(--color-text)]">{title}</h3>
      {children}
    </section>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-2)]/40 text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-[var(--color-border-soft)]">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-[var(--color-text)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
