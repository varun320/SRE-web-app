import Link from 'next/link';
import { Receipt, Plus, ArrowUpRight } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchMyExpenses, fetchSummary } from '@/lib/expenses/queries';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';

function money(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

function statusTone(s: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'muted' {
  switch (s) {
    case 'approved': return 'info';
    case 'paid':     return 'success';
    case 'submitted': return 'warning';
    case 'declined': return 'danger';
    default:         return 'muted';
  }
}

export default async function ExpensesPage() {
  const supabase = await getSupabaseServer();
  const { data: userRow } = await supabase.auth.getUser();
  const userId = userRow.user?.id;
  if (!userId) throw new Error('unauthenticated');

  const [rows, summary] = await Promise.all([
    fetchMyExpenses(supabase),
    fetchSummary(supabase, userId),
  ]);

  const submitted = Number(summary?.total_submitted ?? 0);
  const received = Number(summary?.total_received ?? 0);
  const outstanding = Number(summary?.outstanding_principal ?? 0);
  const interest = Number(summary?.interest_accrued ?? 0);
  const owing = Number(summary?.total_owing ?? 0);

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-gradient-to-br from-[var(--color-status-approved-bg)] via-[var(--color-surface)] to-[var(--color-surface-2)] p-5 md:p-7 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
              <Receipt className="h-3.5 w-3.5" />
              Expense reports
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your monthly submissions</h1>
            <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
              One row per monthly expense report. Submit by the 30th of each month; interest accrues
              on any unpaid balance after Net-30.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/expenses/new"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 shadow-[var(--shadow-card)]"
            >
              <Plus className="h-4 w-4" /> New report
            </Link>
            <Link
              href="/expenses/balance"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface-2)]"
            >
              Balance <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Submitted"   value={money(submitted)} />
        <Stat label="Received"    value={money(received)} tone="success" />
        <Stat label="Outstanding" value={money(outstanding)} tone={outstanding > 0 ? 'warning' : undefined} />
        <Stat label="Interest"    value={money(interest)} tone={interest > 0 ? 'warning' : undefined} />
        <Stat label="Total owing" value={money(owing)} tone={owing > 0 ? 'warning' : 'success'} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expense reports yet"
          description="Create your first monthly report to start tracking submissions and payouts."
        />
      ) : (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
                <tr>
                  <th className="text-left px-4 py-2.5 font-normal">Invoice #</th>
                  <th className="text-left px-4 py-2.5 font-normal">Period</th>
                  <th className="text-left px-4 py-2.5 font-normal">Submitted</th>
                  <th className="text-right px-4 py-2.5 font-normal">Amount</th>
                  <th className="text-right px-4 py-2.5 font-normal">GST</th>
                  <th className="text-right px-4 py-2.5 font-normal">Total</th>
                  <th className="text-left px-4 py-2.5 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/expenses/${encodeURIComponent(r.invoice_no)}`} className="font-medium hover:underline">
                        {r.invoice_no}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                      {r.period_from} → {r.period_to}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{r.submission_date}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{money(Number(r.amount_cad))}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{money(Number(r.gst_cad))}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium">{money(Number(r.total_cad))}</td>
                    <td className="px-4 py-2.5"><StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

interface StatProps {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'info';
}

function Stat({ label, value, tone }: StatProps) {
  const toneClass =
    tone === 'success'
      ? 'text-[var(--color-status-approved-fg)]'
      : tone === 'warning'
      ? 'text-[var(--color-status-declined-fg)]'
      : 'text-[var(--color-text)]';
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
      <div className={`mt-0.5 font-mono tabular-nums text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
