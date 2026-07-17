import { getSupabaseServer } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { CreditCard } from 'lucide-react';
import { PayoutBatchForm } from '@/components/admin/PayoutBatchForm';

function money(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

export default async function AdminPayoutsPage() {
  const sb = await getSupabaseServer();

  const [payoutsRes, outstandingRes] = await Promise.all([
    sb
      .from('expense_payouts')
      .select('id, user_id, invoice_no, payout_date, amount_cad, reference, notes')
      .order('payout_date', { ascending: false })
      .limit(200),
    sb
      .from('v_expense_balance_full')
      .select('id, user_id, invoice_no, outstanding, days_overdue, balance_status')
      .gt('outstanding', 0)
      .order('days_overdue', { ascending: false }),
  ]);
  if (payoutsRes.error) throw new Error(payoutsRes.error.message);

  const rows = payoutsRes.data ?? [];
  const outstanding = outstandingRes.data ?? [];

  const userIds = Array.from(new Set([
    ...rows.map((r) => r.user_id as string),
    ...outstanding.map((o) => o.user_id as string),
  ]));
  const usersRes = userIds.length
    ? await sb.from('users').select('id, full_name, employee_code').in('id', userIds)
    : { data: [] as Array<{ id: string; full_name: string; employee_code: string }> };
  const userMap = new Map((usersRes.data ?? []).map((u) => [u.id, u]));

  const batchReports = outstanding.map((o) => ({
    id: o.id as string,
    user_id: o.user_id as string,
    invoice_no: o.invoice_no as string,
    full_name: userMap.get(o.user_id as string)?.full_name ?? '—',
    outstanding: Number(o.outstanding ?? 0),
    days_overdue: Number(o.days_overdue ?? 0),
  }));

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <section>
        <h1 className="text-xl font-semibold">Batch payouts</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Pick every report you&apos;re cutting a cheque for today. Amount defaults to the outstanding
          balance but you can override for partial payments.
        </p>
        <div className="mt-4">
          <PayoutBatchForm reports={batchReports} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Payout log</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          All payments recorded to date. Individual reports also let you record single payouts.
        </p>
        {rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={CreditCard} title="No payouts yet" description="Payouts appear here once recorded." />
          </div>
        ) : (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-normal">Date</th>
                    <th className="text-left px-4 py-2.5 font-normal">Employee</th>
                    <th className="text-left px-4 py-2.5 font-normal">Invoice #</th>
                    <th className="text-right px-4 py-2.5 font-normal">Amount</th>
                    <th className="text-left px-4 py-2.5 font-normal">Reference</th>
                    <th className="text-left px-4 py-2.5 font-normal">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const u = userMap.get(r.user_id);
                    return (
                      <tr key={r.id} className="border-t border-[var(--color-border-soft)]">
                        <td className="px-4 py-2.5">{r.payout_date}</td>
                        <td className="px-4 py-2.5">{u?.full_name ?? '—'}</td>
                        <td className="px-4 py-2.5 font-medium">{r.invoice_no}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {money(Number(r.amount_cad))}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{r.reference ?? ''}</td>
                        <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{r.notes ?? ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
