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
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
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
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Submitted</th>
                  <th>Due (Net 30)</th>
                  <th className="num">Claimed</th>
                  <th className="num">Paid</th>
                  <th className="num">Outstanding</th>
                  <th className="num">Interest</th>
                  <th className="num">Total owing</th>
                  <th className="num">Days od</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">
                      <Link href={`/expenses/${encodeURIComponent(r.invoice_no)}`} className="hover:underline">
                        {r.invoice_no}
                      </Link>
                    </td>
                    <td className="col-muted">{r.submission_date}</td>
                    <td className="col-muted">{r.due_date}</td>
                    <td className="num">{money(Number(r.claimed))}</td>
                    <td className="num">{money(Number(r.paid))}</td>
                    <td className="num">{money(Number(r.outstanding))}</td>
                    <td className="num">{money(Number(r.interest_owing))}</td>
                    <td className="num font-semibold">{money(Number(r.total_owing))}</td>
                    <td className="num">{r.days_overdue}</td>
                    <td><StatusBadge tone={bTone(r.balance_status)}>{r.balance_status.replace('_', ' ')}</StatusBadge></td>
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
