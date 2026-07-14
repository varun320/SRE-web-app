import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { Receipt } from 'lucide-react';
import { AdminExpenseActions } from '@/components/admin/AdminExpenseActions';

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

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; employee?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const status = sp.status && sp.status !== 'all' ? sp.status : undefined;
  const employee = sp.employee ?? '';

  const sb = await getSupabaseServer();
  let q = sb
    .from('expense_reports')
    .select('id, user_id, invoice_no, period_from, period_to, submission_date, total_cad, status, locked, decline_reason')
    .order('submission_date', { ascending: false })
    .limit(200);
  if (status) q = q.eq('status', status);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
  const usersRes = userIds.length
    ? await sb.from('users').select('id, full_name, employee_code').in('id', userIds)
    : { data: [] as Array<{ id: string; full_name: string; employee_code: string }> };
  const userMap = new Map((usersRes.data ?? []).map((u) => [u.id, u]));

  const filtered = (rows ?? []).filter((r) => {
    if (!employee) return true;
    const u = userMap.get(r.user_id);
    const needle = employee.toLowerCase();
    return (
      u?.full_name?.toLowerCase().includes(needle) ||
      u?.employee_code?.toLowerCase().includes(needle) ||
      r.invoice_no.toLowerCase().includes(needle)
    );
  });

  const statuses = ['all', 'draft', 'submitted', 'approved', 'declined', 'paid'];

  return (
    <main className="w-full px-3 md:px-4 py-5 md:py-6 space-y-4">
      <div className="flex items-center justify-end">
        <Link
          href="/admin/expenses/payouts"
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
        >
          Payout log →
        </Link>
      </div>

      <form className="flex flex-wrap gap-2 items-end">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] block">Status</span>
          <select
            name="status"
            defaultValue={status ?? 'all'}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] block">Employee / invoice</span>
          <input
            type="text"
            name="employee"
            defaultValue={employee}
            placeholder="Search name, code, or invoice #"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm min-w-[240px]"
          />
        </label>
        <button
          type="submit"
          className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white"
        >
          Apply
        </button>
      </form>

      {filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="No expense reports match" description="Try clearing the filters." />
      ) : (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
                <tr>
                  <th className="text-left px-4 py-2.5 font-normal">Employee</th>
                  <th className="text-left px-4 py-2.5 font-normal">Invoice #</th>
                  <th className="text-left px-4 py-2.5 font-normal">Period</th>
                  <th className="text-left px-4 py-2.5 font-normal">Submitted</th>
                  <th className="text-right px-4 py-2.5 font-normal">Total</th>
                  <th className="text-left px-4 py-2.5 font-normal">Status</th>
                  <th className="text-right px-4 py-2.5 font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const u = userMap.get(r.user_id);
                  return (
                    <tr key={r.id} className="border-t border-[var(--color-border-soft)]">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{u?.full_name ?? '—'}</div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">{u?.employee_code ?? ''}</div>
                      </td>
                      <td className="px-4 py-2.5 font-medium">{r.invoice_no}</td>
                      <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                        {r.period_from} → {r.period_to}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{r.submission_date}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {money(Number(r.total_cad))}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge>
                        {r.locked ? (
                          <StatusBadge tone="muted" className="ml-1">locked</StatusBadge>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <AdminExpenseActions
                          expenseId={r.id}
                          status={r.status}
                          locked={r.locked}
                          userId={r.user_id}
                          invoiceNo={r.invoice_no}
                        />
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
