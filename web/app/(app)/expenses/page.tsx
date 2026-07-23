import Link from 'next/link';
import { Receipt, Plus, Copy } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchMyExpenses, fetchSummary } from '@/lib/expenses/queries';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { InfoHint } from '@/components/ui/info-hint';
import { formatDate } from '@/lib/dates';

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

  const [rows, summary, payoutAgg] = await Promise.all([
    fetchMyExpenses(supabase),
    fetchSummary(supabase, userId),
    supabase
      .from('v_expense_payout_agg')
      .select('user_id, invoice_no, paid_amount')
      .eq('user_id', userId),
  ]);
  const paidByInvoice = new Map(
    (payoutAgg.data ?? []).map((p) => [p.invoice_no as string, Number(p.paid_amount ?? 0)]),
  );

  function paymentStatus(status: string, total: number, invoiceNo: string): {
    label: string;
    tone: 'success' | 'warning' | 'danger' | 'muted';
  } {
    if (status !== 'approved' && status !== 'paid') return { label: '—', tone: 'muted' };
    const paid = paidByInvoice.get(invoiceNo) ?? 0;
    if (paid <= 0) return { label: 'Unpaid', tone: 'danger' };
    if (paid + 0.005 < total) return { label: 'Partially Paid', tone: 'warning' };
    return { label: 'Paid', tone: 'success' };
  }

  const submitted = Number(summary?.total_submitted ?? 0);
  const received = Number(summary?.total_received ?? 0);
  const outstanding = Number(summary?.outstanding_principal ?? 0);
  const interest = Number(summary?.interest_accrued ?? 0);
  const owing = Number(summary?.total_owing ?? 0);

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 md:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full opacity-70"
          style={{ background: 'radial-gradient(circle, var(--color-accent-tint) 0%, transparent 70%)' }}
        />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
              <Receipt className="h-3.5 w-3.5" />
              Expense reports
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <h1 className="text-h1">Your monthly submissions</h1>
              <InfoHint label="Expense reports">
                <p className="mb-1"><strong>Draft</strong> — still editing. Attach receipts anytime.</p>
                <p className="mb-1"><strong>Submitted</strong> — sent to admin. You can pull it back to draft within 24 h.</p>
                <p className="mb-1"><strong>Approved</strong> — locked, waiting on payment.</p>
                <p className="mb-1"><strong>Paid</strong> — payout logged. Any unpaid balance past Net-30 accrues interest.</p>
                <p>Use <em>Duplicate</em> to clone a prior report&apos;s line items (receipts don&apos;t copy over).</p>
              </InfoHint>
            </div>
            <p className="mt-2 text-body-sm text-[var(--color-text-muted)]">
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
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Period</th>
                  <th>Submitted</th>
                  <th className="num">Amount</th>
                  <th className="num">GST</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pay = paymentStatus(r.status, Number(r.total_cad), r.invoice_no);
                  return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/expenses/${encodeURIComponent(r.invoice_no)}`} className="font-medium hover:underline">
                        {r.invoice_no}
                      </Link>
                    </td>
                    <td className="col-muted">{formatDate(r.period_from)} → {formatDate(r.period_to)}</td>
                    <td className="col-muted">{formatDate(r.submission_date)}</td>
                    <td className="num">{money(Number(r.amount_cad))}</td>
                    <td className="num">{money(Number(r.gst_cad))}</td>
                    <td className="num font-medium">{money(Number(r.total_cad))}</td>
                    <td><StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge></td>
                    <td><StatusBadge tone={pay.tone}>{pay.label}</StatusBadge></td>
                    <td className="text-right">
                      <Link
                        href={`/expenses/new?dup=${encodeURIComponent(r.invoice_no)}`}
                        title="Start a new report with the same lines"
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      >
                        <Copy className="h-3.5 w-3.5" /> Duplicate
                      </Link>
                    </td>
                  </tr>
                  );
                })}
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
