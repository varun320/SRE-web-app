'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCheck, ArrowDown, ArrowUp } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { AdminExpenseActions } from '@/components/admin/AdminExpenseActions';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { approveExpense } from '@/lib/expenses/mutations';
import { paymentStatus } from '@/lib/expenses/payment-status';

export type SortKey = 'submission_date' | 'invoice_no' | 'total_cad' | 'status' | 'employee';

interface Row {
  id: string;
  user_id: string;
  invoice_no: string;
  period_from: string;
  period_to: string;
  submission_date: string;
  total_cad: number | string;
  status: string;
  locked: boolean;
}

interface UserInfo {
  id: string;
  full_name: string;
  employee_code: string;
}

interface Props {
  rows: Row[];
  users: UserInfo[];
  paidByKey: Record<string, number>;
  sort: SortKey;
  dir: 'asc' | 'desc';
  sortHrefs: Record<SortKey, string>;
}

function money(n: number): string {
  return Number(n).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
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

export function AdminExpensesTableBody({ rows, users, paidByKey, sort, dir, sortHrefs }: Props) {
  const router = useRouter();
  const userMap = new Map(users.map((u) => [u.id, u]));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const submittedIds = rows.filter((r) => r.status === 'submitted').map((r) => r.id);
  const selectedSubmittedIds = submittedIds.filter((id) => selected.has(id));
  const allSubmittedSelected = submittedIds.length > 0 && selectedSubmittedIds.length === submittedIds.length;

  const arrow = (key: SortKey) =>
    sort === key ? (dir === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />) : null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSubmittedSelected) setSelected(new Set());
    else setSelected(new Set(submittedIds));
  };

  const bulkApprove = () => {
    if (selectedSubmittedIds.length === 0) return;
    if (!confirm(`Approve ${selectedSubmittedIds.length} expense report(s)?`)) return;
    setErr(null);
    startTransition(async () => {
      const sb = getSupabaseBrowser();
      const failures: string[] = [];
      for (const id of selectedSubmittedIds) {
        try {
          await approveExpense(sb, id);
        } catch (e) {
          failures.push(id);
          // eslint-disable-next-line no-console
          console.error('approve failed', id, e);
        }
      }
      setSelected(new Set());
      router.refresh();
      if (failures.length > 0) {
        setErr(`${failures.length} of ${selectedSubmittedIds.length} failed. Check the browser console.`);
      }
    });
  };

  return (
    <>
      <table className="min-w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
          <tr>
            <th className="px-3 py-2.5 font-normal w-[36px]">
              <input
                type="checkbox"
                aria-label="Select all submitted"
                checked={allSubmittedSelected}
                onChange={toggleAll}
                disabled={submittedIds.length === 0}
              />
            </th>
            <th className="text-left px-4 py-2.5 font-normal">
              <Link href={sortHrefs.employee} className="hover:text-[var(--color-text)] inline-flex items-center gap-1">Employee {arrow('employee')}</Link>
            </th>
            <th className="text-left px-4 py-2.5 font-normal">
              <Link href={sortHrefs.invoice_no} className="hover:text-[var(--color-text)] inline-flex items-center gap-1">Invoice # {arrow('invoice_no')}</Link>
            </th>
            <th className="text-left px-4 py-2.5 font-normal">Period</th>
            <th className="text-left px-4 py-2.5 font-normal">
              <Link href={sortHrefs.submission_date} className="hover:text-[var(--color-text)] inline-flex items-center gap-1">Submitted {arrow('submission_date')}</Link>
            </th>
            <th className="text-right px-4 py-2.5 font-normal">
              <Link href={sortHrefs.total_cad} className="hover:text-[var(--color-text)] inline-flex items-center gap-1">Total {arrow('total_cad')}</Link>
            </th>
            <th className="text-left px-4 py-2.5 font-normal">
              <Link href={sortHrefs.status} className="hover:text-[var(--color-text)] inline-flex items-center gap-1">Status {arrow('status')}</Link>
            </th>
            <th className="text-left px-4 py-2.5 font-normal">Payment</th>
            <th className="text-right px-4 py-2.5 font-normal">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-6 text-center text-[var(--color-text-muted)]">No reports.</td>
            </tr>
          ) : null}
          {rows.map((r) => {
            const u = userMap.get(r.user_id);
            const isSubmitted = r.status === 'submitted';
            return (
              <tr key={r.id} className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/30">
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.invoice_no}`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    disabled={!isSubmitted}
                    title={isSubmitted ? '' : 'Only submitted reports can be bulk-approved'}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/expenses/${r.id}`} className="block">
                    <div className="font-medium">{u?.full_name ?? '—'}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">{u?.employee_code ?? ''}</div>
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-medium">
                  <Link href={`/admin/expenses/${r.id}`} className="hover:underline">{r.invoice_no}</Link>
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                  {r.period_from} → {r.period_to}
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{r.submission_date}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{money(Number(r.total_cad))}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge>
                  {r.locked ? <StatusBadge tone="muted" className="ml-1">locked</StatusBadge> : null}
                </td>
                <td className="px-4 py-2.5">
                  {(() => {
                    const pay = paymentStatus(
                      r.status,
                      Number(r.total_cad),
                      paidByKey[`${r.user_id}:${r.invoice_no}`] ?? 0,
                    );
                    return <StatusBadge tone={pay.tone}>{pay.label}</StatusBadge>;
                  })()}
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

      {selectedSubmittedIds.length > 0 ? (
        <div className="sticky bottom-4 mx-auto mt-4 flex w-fit items-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 shadow-lg">
          <span className="text-sm">
            <strong>{selectedSubmittedIds.length}</strong> selected
          </span>
          {err ? <span className="text-xs text-[var(--color-status-declined-fg)]">{err}</span> : null}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={bulkApprove}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            {pending ? 'Approving…' : 'Approve selected'}
          </button>
        </div>
      ) : null}
    </>
  );
}
