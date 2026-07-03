import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchBalanceForUser, fetchSummary } from '@/lib/expenses/queries';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';

function money(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

function bTone(s: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  return s === 'paid' ? 'success' : s === 'overdue' ? 'danger' : s === 'interest_owing' ? 'warning' : 'info';
}

export default async function BalancePage() {
  const supabase = await getSupabaseServer();
  const { data: userRow } = await supabase.auth.getUser();
  const userId = userRow.user?.id;
  if (!userId) throw new Error('unauthenticated');

  const [rows, summary] = await Promise.all([
    fetchBalanceForUser(supabase, userId),
    fetchSummary(supabase, userId),
  ]);
  const owing = Number(summary?.total_owing ?? 0);

  return (
    <main className="mx-auto max-w-6xl px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/expenses"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to expenses
        </Link>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 md:p-7">
        <h1 className="text-2xl font-semibold tracking-tight">Balance & Interest</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Interest = <code>unpaid × (days_overdue / 365) × APR</code>. Payments made before the 30-day due
          date reduce the balance and stop the interest clock.
        </p>
        <div className="mt-4 flex items-baseline gap-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Total owing</div>
          <div
            className={`font-mono tabular-nums text-3xl font-semibold ${
              owing > 0 ? 'text-[var(--color-status-declined-fg)]' : 'text-[var(--color-status-approved-fg)]'
            }`}
          >
            {money(owing)}
          </div>
        </div>
      </section>

      {rows.length === 0 ? (
        <EmptyState
          icon={Info}
          title="No submitted expenses yet"
          description="Once you submit an expense report it will appear here with its balance and interest tracking."
        />
      ) : (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
                <tr>
                  <th className="text-left px-4 py-2.5 font-normal">Invoice #</th>
                  <th className="text-left px-4 py-2.5 font-normal">Submitted</th>
                  <th className="text-left px-4 py-2.5 font-normal">Due (Net 30)</th>
                  <th className="text-right px-4 py-2.5 font-normal">Claimed</th>
                  <th className="text-right px-4 py-2.5 font-normal">Paid</th>
                  <th className="text-right px-4 py-2.5 font-normal">Outstanding</th>
                  <th className="text-right px-4 py-2.5 font-normal">Interest</th>
                  <th className="text-right px-4 py-2.5 font-normal">Total owing</th>
                  <th className="text-right px-4 py-2.5 font-normal">Days od</th>
                  <th className="text-left px-4 py-2.5 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--color-border-soft)]">
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/expenses/${encodeURIComponent(r.invoice_no)}`} className="hover:underline">
                        {r.invoice_no}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{r.submission_date}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{r.due_date}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{money(Number(r.claimed))}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{money(Number(r.paid))}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{money(Number(r.outstanding))}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{money(Number(r.interest_owing))}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold">
                      {money(Number(r.total_owing))}
                    </td>
                    <td className="px-4 py-2.5 text-right">{r.days_overdue}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tone={bTone(r.balance_status)}>{r.balance_status.replace('_', ' ')}</StatusBadge>
                    </td>
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
