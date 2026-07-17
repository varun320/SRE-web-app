'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCheck } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { upsertPayout } from '@/lib/expenses/mutations';
import { DatePicker } from '@/components/ui/date-picker';

interface OutstandingReport {
  id: string;
  user_id: string;
  invoice_no: string;
  full_name: string;
  outstanding: number;
  days_overdue: number;
}

interface Props {
  reports: OutstandingReport[];
}

interface RowState {
  paying: boolean;
  amount: string;
  reference: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function money(n: number): string {
  return Number(n).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

export function PayoutBatchForm({ reports }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [payoutDate, setPayoutDate] = useState<string>(today());
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      reports.map((r) => [r.id, { paying: false, amount: r.outstanding.toFixed(2), reference: '' }]),
    ),
  );

  const selectedIds = reports.filter((r) => rows[r.id]?.paying).map((r) => r.id);
  const totalToPay = selectedIds.reduce((s, id) => s + Number(rows[id].amount || 0), 0);

  const update = (id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const submit = () => {
    if (selectedIds.length === 0) {
      setErr('Select at least one report.');
      return;
    }
    if (!payoutDate) {
      setErr('Pick a payout date.');
      return;
    }
    setErr(null);
    startTransition(async () => {
      const sb = getSupabaseBrowser();
      const failures: string[] = [];
      for (const id of selectedIds) {
        const r = reports.find((x) => x.id === id);
        const s = rows[id];
        if (!r) continue;
        const amt = Number(s.amount);
        if (!Number.isFinite(amt) || amt <= 0) {
          failures.push(r.invoice_no);
          continue;
        }
        try {
          await upsertPayout(sb, {
            user_id: r.user_id,
            invoice_no: r.invoice_no,
            payout_date: payoutDate,
            amount_cad: amt,
            reference: s.reference || null,
          });
        } catch (e) {
          failures.push(r.invoice_no);
          // eslint-disable-next-line no-console
          console.error('payout failed', r.invoice_no, e);
        }
      }
      router.refresh();
      if (failures.length > 0) {
        setErr(`${failures.length} payout(s) failed: ${failures.join(', ')}. Others were saved.`);
      } else {
        setErr(null);
      }
    });
  };

  if (reports.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Nothing outstanding — all approved reports are paid.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] block">Payout date</span>
          <DatePicker value={payoutDate} onChange={setPayoutDate} ariaLabel="Payout date" className="min-w-[160px]" />
        </label>
        <div className="text-sm text-[var(--color-text-muted)] mb-1.5">
          Same date applies to every cheque in this batch.
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
              <tr>
                <th className="w-[36px] px-3 py-2 font-normal"></th>
                <th className="text-left px-3 py-2 font-normal">Employee</th>
                <th className="text-left px-3 py-2 font-normal">Invoice #</th>
                <th className="text-right px-3 py-2 font-normal">Outstanding</th>
                <th className="text-left px-3 py-2 font-normal">Overdue</th>
                <th className="text-right px-3 py-2 font-normal w-[140px]">Pay amount</th>
                <th className="text-left px-3 py-2 font-normal w-[180px]">Reference / cheque #</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const s = rows[r.id];
                const overdue = r.days_overdue > 0;
                return (
                  <tr key={r.id} className={`border-t border-[var(--color-border-soft)] ${s.paying ? 'bg-[var(--color-surface-2)]/40' : ''}`}>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="checkbox"
                        checked={s.paying}
                        onChange={(e) => update(r.id, { paying: e.target.checked })}
                        aria-label={`Pay ${r.invoice_no}`}
                      />
                    </td>
                    <td className="px-3 py-2">{r.full_name}</td>
                    <td className="px-3 py-2 font-medium">{r.invoice_no}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{money(r.outstanding)}</td>
                    <td className={`px-3 py-2 text-xs ${overdue ? 'text-[var(--color-status-declined-fg)]' : 'text-[var(--color-text-muted)]'}`}>
                      {overdue ? `${r.days_overdue}d` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number" step="0.01" min="0"
                        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-right font-mono text-sm"
                        value={s.amount}
                        onChange={(e) => update(r.id, { amount: e.target.value })}
                        disabled={!s.paying}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="Optional"
                        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
                        value={s.reference}
                        onChange={(e) => update(r.id, { reference: e.target.value })}
                        disabled={!s.paying}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <strong>{selectedIds.length}</strong> selected · total <span className="font-mono">{money(totalToPay)}</span>
        </div>
        <div className="flex items-center gap-3">
          {err ? <span className="text-xs text-[var(--color-status-declined-fg)]">{err}</span> : null}
          <button
            type="button"
            disabled={pending || selectedIds.length === 0}
            onClick={submit}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            {pending ? 'Recording…' : `Record ${selectedIds.length || ''} payout${selectedIds.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
