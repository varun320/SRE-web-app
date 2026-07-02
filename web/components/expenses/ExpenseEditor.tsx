'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { expenseDraftSchema } from '@/lib/expenses/schemas';
import { submitExpense, upsertExpenseDraft } from '@/lib/expenses/mutations';
import type { ExpenseReport } from '@/lib/expenses/types';

interface Props {
  initial?: ExpenseReport | null;
  isNew: boolean;
}

export function ExpenseEditor({ initial, isNew }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: initial?.id ?? '',
    invoice_no: initial?.invoice_no ?? '',
    period_from: initial?.period_from ?? '',
    period_to: initial?.period_to ?? '',
    submission_date: initial?.submission_date ?? new Date().toISOString().slice(0, 10),
    amount_cad: initial?.amount_cad ? String(initial.amount_cad) : '',
    gst_cad: initial?.gst_cad ? String(initial.gst_cad) : '0',
    notes: initial?.notes ?? '',
  });

  const readOnly = !isNew && initial ? initial.locked || (initial.status !== 'draft' && initial.status !== 'declined') : false;
  const total = (Number(form.amount_cad || 0) + Number(form.gst_cad || 0));

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(thenSubmit: boolean) {
    setErr(null);
    const parsed = expenseDraftSchema.safeParse({
      id: form.id || undefined,
      invoice_no: form.invoice_no,
      period_from: form.period_from,
      period_to: form.period_to,
      submission_date: form.submission_date || undefined,
      amount_cad: Number(form.amount_cad || 0),
      gst_cad: Number(form.gst_cad || 0),
      notes: form.notes || null,
    });
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getSupabaseBrowser();
        const id = await upsertExpenseDraft(sb, parsed.data);
        if (thenSubmit) await submitExpense(sb, id);
        router.push(`/expenses/${encodeURIComponent(parsed.data.invoice_no)}`);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Invoice #" hint="e.g. UC2026004">
          <input
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            value={form.invoice_no}
            onChange={(e) => update('invoice_no', e.target.value)}
            disabled={readOnly}
            required
          />
        </Field>
        <Field label="Submission date">
          <input
            type="date"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            value={form.submission_date}
            onChange={(e) => update('submission_date', e.target.value)}
            disabled={readOnly}
          />
        </Field>
        <Field label="Period from">
          <input
            type="date"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            value={form.period_from}
            onChange={(e) => update('period_from', e.target.value)}
            disabled={readOnly}
            required
          />
        </Field>
        <Field label="Period to">
          <input
            type="date"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            value={form.period_to}
            onChange={(e) => update('period_to', e.target.value)}
            disabled={readOnly}
            required
          />
        </Field>
        <Field label="Amount (CAD)">
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-mono"
            value={form.amount_cad}
            onChange={(e) => update('amount_cad', e.target.value)}
            disabled={readOnly}
            required
          />
        </Field>
        <Field label="GST (CAD)">
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-mono"
            value={form.gst_cad}
            onChange={(e) => update('gst_cad', e.target.value)}
            disabled={readOnly}
          />
        </Field>
      </div>
      <Field label="Notes">
        <textarea
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          rows={3}
          value={form.notes ?? ''}
          onChange={(e) => update('notes', e.target.value)}
          disabled={readOnly}
        />
      </Field>

      <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/40 px-3 py-2">
        <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Total</div>
        <div className="font-mono tabular-nums text-lg font-semibold">
          {total.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
        </div>
      </div>

      {err ? (
        <div className="rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {err}
        </div>
      ) : null}

      {readOnly ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          This report is {initial?.status}
          {initial?.locked ? ' and locked' : ''}. Ask an admin to unlock it to make changes.
        </p>
      ) : (
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface-2)]"
          >
            {pending ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save(true)}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {pending ? 'Submitting…' : 'Save & submit'}
          </button>
        </div>
      )}
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label} {hint ? <span className="normal-case text-[10px]">— {hint}</span> : null}
      </span>
      {children}
    </label>
  );
}
