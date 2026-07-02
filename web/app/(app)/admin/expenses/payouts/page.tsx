import { getSupabaseServer } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { CreditCard } from 'lucide-react';

function money(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

export default async function AdminPayoutsPage() {
  const sb = await getSupabaseServer();
  const { data: rows, error } = await sb
    .from('expense_payouts')
    .select('id, user_id, invoice_no, payout_date, amount_cad, reference, notes')
    .order('payout_date', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
  const usersRes = userIds.length
    ? await sb.from('users').select('id, full_name, employee_code').in('id', userIds)
    : { data: [] as Array<{ id: string; full_name: string; employee_code: string }> };
  const userMap = new Map((usersRes.data ?? []).map((u) => [u.id, u]));

  return (
    <main className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-4">
      <h1 className="text-xl font-semibold">Payout log</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        All payments received against employee expense reports. Add payouts from the Expenses tab
        using the &quot;+ Payout&quot; button next to an approved report.
      </p>

      {(!rows || rows.length === 0) ? (
        <EmptyState icon={CreditCard} title="No payouts yet" description="Payouts appear here once recorded." />
      ) : (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
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
        </section>
      )}
    </main>
  );
}
