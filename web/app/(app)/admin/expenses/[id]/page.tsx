import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Paperclip } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/ui/status-badge';
import { AdminExpenseActions } from '@/components/admin/AdminExpenseActions';
import type { ExpenseLineItem, ExpenseReport, ExpensePayout, CreditCard } from '@/lib/expenses/types';

function money(n: number): string {
  return Number(n).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

function tone(s: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'muted' {
  switch (s) {
    case 'approved': return 'info';
    case 'paid':     return 'success';
    case 'submitted': return 'warning';
    case 'declined': return 'danger';
    default:         return 'muted';
  }
}

export default async function AdminExpenseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await getSupabaseServer();

  const { data: report, error } = await sb
    .from('expense_reports')
    .select('*')
    .eq('id', id)
    .maybeSingle<ExpenseReport>();
  if (error) throw new Error(error.message);
  if (!report) notFound();

  const [userRes, linesRes, payoutsRes, cardsRes, projectsRes] = await Promise.all([
    sb.from('users').select('id, full_name, employee_code, email').eq('id', report.user_id).maybeSingle(),
    sb.from('expense_line_items').select('*').eq('expense_id', report.id).order('position', { ascending: true }),
    sb.from('expense_payouts').select('*').eq('invoice_no', report.invoice_no).order('payout_date', { ascending: false }),
    sb.from('user_credit_cards').select('id, label, last_four').eq('user_id', report.user_id),
    sb.from('projects').select('id, project_number, name'),
  ]);

  const lines = (linesRes.data ?? []) as ExpenseLineItem[];
  const payouts = (payoutsRes.data ?? []) as ExpensePayout[];
  const cards = (cardsRes.data ?? []) as Pick<CreditCard, 'id' | 'label' | 'last_four'>[];
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const projects = (projectsRes.data ?? []) as { id: string; project_number: number; name: string }[];
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const receiptKeys = lines.map((l) => l.receipt_url).filter((k): k is string => !!k);
  const signed = receiptKeys.length
    ? await sb.storage.from('expense-receipts').createSignedUrls(receiptKeys, 3600)
    : { data: [] as { path: string | null; signedUrl: string; error: string | null }[] };
  const urlByKey = new Map<string, string>();
  for (const s of signed.data ?? []) {
    if (s.path && s.signedUrl) urlByKey.set(s.path, s.signedUrl);
  }

  const totalAmount = lines.reduce((s, l) => s + Number(l.amount_cad), 0);
  const totalGst = lines.reduce((s, l) => s + Number(l.gst_cad), 0);

  const byCategory = lines.reduce<Map<string, number>>((acc, l) => {
    const key = l.category;
    acc.set(key, (acc.get(key) ?? 0) + Number(l.amount_cad) + Number(l.gst_cad));
    return acc;
  }, new Map());
  const categoryBreakdown = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);

  const byProject = lines.reduce<Map<string, number>>((acc, l) => {
    const key = l.project_id ?? '__none__';
    acc.set(key, (acc.get(key) ?? 0) + Number(l.amount_cad) + Number(l.gst_cad));
    return acc;
  }, new Map());
  const projectBreakdown = Array.from(byProject.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <Link
        href="/admin/expenses"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to expense inbox
      </Link>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-h1">{report.invoice_no}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              <span className="font-medium text-[var(--color-text)]">{userRes.data?.full_name ?? '—'}</span>
              {userRes.data?.employee_code ? <> · {userRes.data.employee_code}</> : null}
              {' · '}
              {report.period_from} → {report.period_to}
              {' · submitted '}{report.submission_date}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={tone(report.status)}>{report.status}</StatusBadge>
            {report.locked ? <StatusBadge tone="muted">locked</StatusBadge> : null}
            <AdminExpenseActions
              expenseId={report.id}
              status={report.status}
              locked={report.locked}
              userId={report.user_id}
              invoiceNo={report.invoice_no}
            />
          </div>
        </div>
        {report.decline_reason ? (
          <div className="mt-3 err-box"><strong>Decline reason:</strong> {report.decline_reason}</div>
        ) : null}
        {report.notes ? (
          <p className="mt-3 text-sm text-[var(--color-text-muted)] whitespace-pre-wrap">{report.notes}</p>
        ) : null}
      </section>

      {lines.length > 0 ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4 space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">By category</div>
            <div className="flex flex-wrap gap-1.5">
              {categoryBreakdown.map(([cat, amt]) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs"
                >
                  <span className="font-medium">{cat}</span>
                  <span className="font-mono tabular-nums text-[var(--color-text-muted)]">{money(amt)}</span>
                </span>
              ))}
            </div>
          </div>
          {projectBreakdown.length > 0 ? (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">By project</div>
              <div className="flex flex-wrap gap-1.5">
                {projectBreakdown.map(([pid, amt]) => {
                  const p = pid === '__none__' ? null : projectMap.get(pid);
                  return (
                    <span
                      key={pid}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs"
                    >
                      <span className="font-mono font-medium">{p ? p.project_number : 'unassigned'}</span>
                      {p ? <span className="text-[var(--color-text-muted)] truncate max-w-[160px]">{p.name}</span> : null}
                      <span className="font-mono tabular-nums text-[var(--color-text-muted)]">{money(amt)}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
              <tr>
                <th className="text-left px-3 py-2 font-normal">Date</th>
                <th className="text-left px-3 py-2 font-normal">Category</th>
                <th className="text-left px-3 py-2 font-normal">Project</th>
                <th className="text-left px-3 py-2 font-normal">Description</th>
                <th className="text-left px-3 py-2 font-normal">Card</th>
                <th className="text-right px-3 py-2 font-normal">Native</th>
                <th className="text-right px-3 py-2 font-normal">Amount (CAD)</th>
                <th className="text-right px-3 py-2 font-normal">GST</th>
                <th className="text-right px-3 py-2 font-normal">Line total</th>
                <th className="text-left px-3 py-2 font-normal">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                    No line items on this report.
                  </td>
                </tr>
              ) : (
                lines.map((l) => {
                  const card = l.credit_card_id ? cardMap.get(l.credit_card_id) : null;
                  const url = l.receipt_url ? urlByKey.get(l.receipt_url) : null;
                  const project = l.project_id ? projectMap.get(l.project_id) : null;
                  const total = Number(l.amount_cad) + Number(l.gst_cad);
                  return (
                    <tr key={l.id} className="border-t border-[var(--color-border-soft)] align-top">
                      <td className="px-3 py-2 whitespace-nowrap">{l.line_date}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{l.category}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                        {project ? project.project_number : <span className="text-[var(--color-text-muted)]">—</span>}
                      </td>
                      <td className="px-3 py-2">{l.description}</td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)] whitespace-nowrap">
                        {card ? `${card.label}${card.last_four ? ` ••${card.last_four}` : ''}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--color-text-muted)] whitespace-nowrap">
                        {l.native_amount != null && l.native_currency
                          ? `${l.native_currency} ${Number(l.native_amount).toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{money(l.amount_cad)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{money(l.gst_cad)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">{money(total)}</td>
                      <td className="px-3 py-2">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" /> View
                          </a>
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {lines.length > 0 ? (
              <tfoot>
                <tr className="border-t border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/40">
                  <td colSpan={6} className="px-3 py-2 text-right text-[var(--color-text-muted)]">Totals</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">{money(totalAmount)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">{money(totalGst)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">
                    {money(totalAmount + totalGst)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            ) : null}
          </table>
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
                  <td className="py-1.5 text-right font-mono tabular-nums">{money(p.amount_cad)}</td>
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
