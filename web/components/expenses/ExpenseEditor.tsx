'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { expenseDraftSchema, expenseLineSchema, type ExpenseLineInput } from '@/lib/expenses/schemas';
import { replaceExpenseLines, submitExpense, upsertExpenseDraft } from '@/lib/expenses/mutations';
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseLineItem, type ExpenseReport } from '@/lib/expenses/types';

interface Props {
  initial?: ExpenseReport | null;
  initialLines?: ExpenseLineItem[];
  isNew: boolean;
}

interface LineDraft {
  line_date: string;
  category: ExpenseCategory;
  description: string;
  amount_cad: string;
  gst_cad: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(defaultDate: string): LineDraft {
  return { line_date: defaultDate, category: 'Meals', description: '', amount_cad: '', gst_cad: '' };
}

export function ExpenseEditor({ initial, initialLines, isNew }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const initialPeriodFrom = initial?.period_from ?? '';
  const [form, setForm] = useState({
    id: initial?.id ?? '',
    invoice_no: initial?.invoice_no ?? '',
    period_from: initialPeriodFrom,
    period_to: initial?.period_to ?? '',
    submission_date: initial?.submission_date ?? today(),
    notes: initial?.notes ?? '',
  });

  const [lines, setLines] = useState<LineDraft[]>(() => {
    if (initialLines && initialLines.length > 0) {
      return initialLines.map((l) => ({
        line_date: l.line_date,
        category: l.category,
        description: l.description,
        amount_cad: String(l.amount_cad),
        gst_cad: String(l.gst_cad ?? 0),
      }));
    }
    return [emptyLine(initialPeriodFrom || today())];
  });

  const readOnly = !isNew && initial ? initial.locked || (initial.status !== 'draft' && initial.status !== 'declined') : false;

  const totals = useMemo(() => {
    let amount = 0;
    let gst = 0;
    for (const l of lines) {
      amount += Number(l.amount_cad || 0);
      gst += Number(l.gst_cad || 0);
    }
    return { amount, gst, total: amount + gst };
  }, [lines]);

  function updateForm<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, emptyLine(form.period_to || form.period_from || today())]);
  }

  function removeLine(i: number) {
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i)));
  }

  async function save(thenSubmit: boolean) {
    setErr(null);
    const draft = expenseDraftSchema.safeParse({
      id: form.id || undefined,
      invoice_no: form.invoice_no,
      period_from: form.period_from,
      period_to: form.period_to,
      submission_date: form.submission_date || undefined,
      amount_cad: totals.amount,
      gst_cad: totals.gst,
      notes: form.notes || null,
    });
    if (!draft.success) {
      setErr(draft.error.issues[0]?.message ?? 'Invalid header');
      return;
    }

    const parsedLines: ExpenseLineInput[] = [];
    for (const [i, l] of lines.entries()) {
      const p = expenseLineSchema.safeParse({
        line_date: l.line_date,
        category: l.category,
        description: l.description,
        amount_cad: Number(l.amount_cad || 0),
        gst_cad: Number(l.gst_cad || 0),
      });
      if (!p.success) {
        setErr(`Line ${i + 1}: ${p.error.issues[0]?.message ?? 'invalid'}`);
        return;
      }
      parsedLines.push(p.data);
    }

    if (thenSubmit && totals.total <= 0) {
      setErr('Total must be positive to submit');
      return;
    }

    startTransition(async () => {
      try {
        const sb = getSupabaseBrowser();
        const id = await upsertExpenseDraft(sb, draft.data);
        await replaceExpenseLines(sb, id, parsedLines);
        if (thenSubmit) await submitExpense(sb, id);
        router.push(`/expenses/${encodeURIComponent(draft.data.invoice_no)}`);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Field label="Invoice #" hint="e.g. UC2026004">
          <input
            className={inputCls}
            value={form.invoice_no}
            onChange={(e) => updateForm('invoice_no', e.target.value)}
            disabled={readOnly}
            required
          />
        </Field>
        <Field label="Submission date">
          <input
            type="date"
            className={inputCls}
            value={form.submission_date}
            onChange={(e) => updateForm('submission_date', e.target.value)}
            disabled={readOnly}
          />
        </Field>
        <Field label="Period from">
          <input
            type="date"
            className={inputCls}
            value={form.period_from}
            onChange={(e) => updateForm('period_from', e.target.value)}
            disabled={readOnly}
            required
          />
        </Field>
        <Field label="Period to">
          <input
            type="date"
            className={inputCls}
            value={form.period_to}
            onChange={(e) => updateForm('period_to', e.target.value)}
            disabled={readOnly}
            required
          />
        </Field>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/50">
              <tr>
                <th className="text-left px-2 py-2 font-normal w-[130px]">Date</th>
                <th className="text-left px-2 py-2 font-normal w-[160px]">Category</th>
                <th className="text-left px-2 py-2 font-normal">Description</th>
                <th className="text-right px-2 py-2 font-normal w-[120px]">Amount</th>
                <th className="text-right px-2 py-2 font-normal w-[110px]">GST</th>
                <th className="text-right px-2 py-2 font-normal w-[110px]">Line total</th>
                <th className="w-[36px]"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const lineTotal = Number(l.amount_cad || 0) + Number(l.gst_cad || 0);
                return (
                  <tr key={i} className="border-t border-[var(--color-border-soft)] align-top">
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        className={inputCls}
                        value={l.line_date}
                        onChange={(e) => updateLine(i, { line_date: e.target.value })}
                        disabled={readOnly}
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className={inputCls}
                        value={l.category}
                        onChange={(e) => updateLine(i, { category: e.target.value as ExpenseCategory })}
                        disabled={readOnly}
                      >
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={inputCls}
                        value={l.description}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                        placeholder="What was purchased and why"
                        disabled={readOnly}
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number" step="0.01" min="0"
                        className={`${inputCls} text-right font-mono`}
                        value={l.amount_cad}
                        onChange={(e) => updateLine(i, { amount_cad: e.target.value })}
                        disabled={readOnly}
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number" step="0.01" min="0"
                        className={`${inputCls} text-right font-mono`}
                        value={l.gst_cad}
                        onChange={(e) => updateLine(i, { gst_cad: e.target.value })}
                        disabled={readOnly}
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">
                      {lineTotal.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      {!readOnly && lines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          aria-label={`Remove line ${i + 1}`}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)] p-1 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/40">
                <td colSpan={3} className="px-2 py-2">
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={addLine}
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add line
                    </button>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold">
                  {totals.amount.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold">
                  {totals.gst.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold">
                  {totals.total.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <Field label="Notes (whole report)">
        <textarea
          className={`${inputCls} min-h-[3.5rem]`}
          rows={3}
          value={form.notes ?? ''}
          onChange={(e) => updateForm('notes', e.target.value)}
          disabled={readOnly}
        />
      </Field>

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

const inputCls =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60';

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
