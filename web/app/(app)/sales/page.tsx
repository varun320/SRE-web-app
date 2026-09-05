import Link from 'next/link';
import { LineChart, AlertTriangle } from 'lucide-react';
import { getSupabaseServer } from '@/shared/supabase/server';
import { fetchIsAdmin } from '@/shared/lib/role';
import { listOpportunities } from '@/features/sales/client';
import { OPPORTUNITY_STAGES } from '@/features/sales/types';
import { PageHeader } from '@/shared/ui/page-header';
import { Button } from '@/shared/ui/button';
import { KanbanBoard } from '@/features/sales/kanban/KanbanBoard';

export const dynamic = 'force-dynamic';

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export default async function SalesPage() {
  const sb = await getSupabaseServer();
  const { data: authData } = await sb.auth.getUser();
  const isAdmin = await fetchIsAdmin(sb);
  // Fixture mode maps auth uid → "u_maaz" so demo "My deals" isn't empty.
  const currentEngineerId =
    process.env.SRE_SALES_FIXTURES === '1' || !process.env.SRE_AUTOMATIONS_URL
      ? 'u_maaz'
      : authData.user?.id ?? null;

  const { data: opportunities, stale, error, source } = await listOpportunities();

  const kpis = {
    inquiries: opportunities.filter((o) => o.stage === 'Inquiry').length,
    proposalsSent: opportunities.filter((o) => o.stage === 'Proposal Sent').length,
    approved: opportunities.filter((o) => o.stage === 'Approved').length,
    wonThisMonth: opportunities.filter((o) => {
      if (o.stage !== 'Won') return false;
      const d = new Date(o.stageEnteredAt);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length,
  };
  const totalPipelineValue = opportunities
    .filter((o) => o.status === 'open')
    .reduce((a, o) => a + (o.monetaryValue ?? 0), 0);

  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-5">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            Sales pipeline
            <span className="rounded-sm bg-[var(--color-accent-tint)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)] leading-none">
              Beta
            </span>
          </span>
        }
        description={
          isAdmin
            ? 'Read/write mirror of the SRE Sales pipeline in GoHighLevel. GHL is the system of record.'
            : 'Everyone can see the pipeline. You can edit deals assigned to you; other cards are read-only.'
        }
        action={
          <Link href="/sales/summary">
            <Button variant="secondary" size="sm">
              <LineChart className="h-4 w-4" />
              Exec summary
            </Button>
          </Link>
        }
      />

      {stale ? (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-status-declined-bg)] bg-[var(--color-status-declined-bg)]/40 px-3 py-2 text-sm text-[var(--color-status-declined-fg)]">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">
              {source === 'fixture'
                ? 'Live sync unavailable — showing fixture data.'
                : 'Showing cached data.'}
            </div>
            {error ? (
              <div className="mt-0.5 text-xs opacity-80">{error}</div>
            ) : (
              <div className="mt-0.5 text-xs opacity-80">
                The GHL automations sidecar hasn&apos;t been wired up yet. Set{' '}
                <code className="font-mono">SRE_AUTOMATIONS_URL</code> to connect.
              </div>
            )}
          </div>
        </div>
      ) : null}

      <KpiStrip
        inquiries={kpis.inquiries}
        proposalsSent={kpis.proposalsSent}
        approved={kpis.approved}
        wonThisMonth={kpis.wonThisMonth}
        pipelineValue={fmtCurrency(totalPipelineValue)}
      />

      <KanbanBoard
        opportunities={opportunities}
        currentEngineerId={currentEngineerId}
        isAdmin={isAdmin}
      />
    </div>
  );
}

interface KpiStripProps {
  inquiries: number;
  proposalsSent: number;
  approved: number;
  wonThisMonth: number;
  pipelineValue: string;
}

function KpiStrip({
  inquiries,
  proposalsSent,
  approved,
  wonThisMonth,
  pipelineValue,
}: KpiStripProps) {
  const items: { label: string; value: string | number }[] = [
    { label: 'Inquiries', value: inquiries },
    { label: 'Proposals sent', value: proposalsSent },
    { label: 'Approved', value: approved },
    { label: 'Won this month', value: wonThisMonth },
    { label: 'Open pipeline value', value: pipelineValue },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2.5"
        >
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)]">
            {it.label}
          </div>
          <div className="mt-1 text-xl font-semibold text-[var(--color-text)] tabular">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

void OPPORTUNITY_STAGES;
