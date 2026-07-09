import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchExpenseByInvoice, fetchPayouts } from '@/lib/expenses/queries';
import { ExpenseEditor } from '@/components/expenses/ExpenseEditor';
import { StatusBadge } from '@/components/ui/status-badge';

function money(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

export default async function ExpenseDetail({ params }: { params: Promise<{ invoice_no: string }> }) {
  const { invoice_no } = await params;
  const invoice = decodeURIComponent(invoice_no);
  const supabase = await getSupabaseServer();
  const { data: userRow } = await supabase.auth.getUser();
  const userId = userRow.user?.id;
  if (!userId) throw new Error('unauthenticated');

  const report = await fetchExpenseByInvoice(supabase, userId, invoice);
  if (!report) notFound();
  const payouts = await fetchPayouts(supabase, invoice);

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to expenses
      </Link>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{report.invoice_no}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {report.period_from} → {report.period_to} • submitted {report.submission_date}
            </p>
          </div>
          <StatusBadge
            tone={
              report.status === 'paid'
                ? 'success'
                : report.status === 'approved'
                ? 'info'
                : report.status === 'submitted'
                ? 'warning'
                : report.status === 'declined'
                ? 'danger'
                : 'muted'
            }
          >
            {report.status}
          </StatusBadge>
        </div>
        {report.decline_reason ? (
          <div className="mt-3 rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <strong>Reason:</strong> {report.decline_reason}
          </div>
        ) : null}
        <div className="mt-5">
          <ExpenseEditor initial={report} isNew={false} />
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <h2 className="text-sm font-medium">Payments received</h2>
        {payouts.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">No payments recorded yet.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <tr>
                <th className="text-left py-1 font-normal">Date</th>
                <th className="text-right py-1 font-normal">Amount</th>
                <th className="text-left py-1 font-normal">Reference</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-t border-[var(--color-border-soft)]">
                  <td className="py-1.5">{p.payout_date}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{money(Number(p.amount_cad))}</td>
                  <td className="py-1.5 text-[var(--color-text-muted)]">{p.reference ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
