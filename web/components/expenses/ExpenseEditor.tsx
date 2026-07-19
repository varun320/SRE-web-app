'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Paperclip, Plus, Trash2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { DatePicker } from '@/components/ui/date-picker';
import { InfoHint } from '@/components/ui/info-hint';
import { expenseDraftSchema, expenseLineSchema, type ExpenseLineInput } from '@/lib/expenses/schemas';
import { replaceExpenseLines, submitExpense, upsertExpenseDraft } from '@/lib/expenses/mutations';
import { uploadReceipt } from '@/lib/expenses/receipts';
import { EXPENSE_CATEGORIES, type CreditCard, type ExpenseCategory, type ExpenseLineFavourite, type ExpenseLineItem, type ExpenseReport } from '@/lib/expenses/types';
import type { Project } from '@/lib/types';

interface Props {
  initial?: ExpenseReport | null;
  initialLines?: ExpenseLineItem[];
  creditCards?: CreditCard[];
  projects?: Project[];
  favourites?: ExpenseLineFavourite[];
  suggestedInvoice?: string;
  isNew: boolean;
}

interface LineDraft {
  line_date: string;
  category: ExpenseCategory;
  description: string;
  amount_cad: string;
  gst_cad: string;
  credit_card_id: string | null;
  receipt_url: string | null;
  pending_file: File | null;   // set when a receipt is picked before the draft has an id
  project_id: string | null;
  // native_amount + native_currency + is_personal kept in DB for MCP/back-compat
  // but no longer surfaced in the editor UI.
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(defaultDate: string, defaultCardId: string | null): LineDraft {
  return {
    line_date: defaultDate,
    category: 'Meal',
    description: '',
    amount_cad: '',
    gst_cad: '',
    credit_card_id: defaultCardId,
    receipt_url: null,
    pending_file: null,
    project_id: null,
  };
}

export function ExpenseEditor({ initial, initialLines, creditCards = [], projects = [], favourites = [], suggestedInvoice, isNew }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const initialPeriodFrom = initial?.period_from ?? '';
  const [form, setForm] = useState({
    id: initial?.id ?? '',
    invoice_no: initial?.invoice_no ?? suggestedInvoice ?? '',
    period_from: initialPeriodFrom,
    period_to: initial?.period_to ?? '',
    submission_date: initial?.submission_date ?? today(),
    notes: initial?.notes ?? '',
    trip_label: initial?.trip_label ?? '',
  });

  const activeCards = creditCards.filter((c) => c.is_active);
  const defaultCardId = activeCards.find((c) => c.is_default)?.id ?? null;
  const [lines, setLines] = useState<LineDraft[]>(() => {
    if (initialLines && initialLines.length > 0) {
      return initialLines.map((l) => ({
        line_date: l.line_date,
        category: l.category,
        description: l.description,
        amount_cad: String(l.amount_cad),
        gst_cad: String(l.gst_cad ?? 0),
        credit_card_id: l.credit_card_id,
        receipt_url: l.receipt_url,
        pending_file: null,
        project_id: l.project_id,
      }));
    }
    return [emptyLine(initialPeriodFrom || today(), defaultCardId)];
  });

  const readOnly = !isNew && initial ? initial.locked || (initial.status !== 'draft' && initial.status !== 'declined') : false;
  const canAttach = !readOnly;
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // If the draft already has an id, upload immediately. Otherwise stash the
  // File on the line and defer the upload until save() creates the report.
  async function attachReceipt(i: number, file: File) {
    setErr(null);
    if (!initial?.id) {
      updateLine(i, { pending_file: file, receipt_url: null });
      return;
    }
    setUploadingIdx(i);
    try {
      const key = await uploadReceipt(getSupabaseBrowser(), initial.id, file);
      updateLine(i, { receipt_url: key, pending_file: null });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingIdx(null);
    }
  }

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
    setLines((ls) => [...ls, emptyLine(form.period_to || form.period_from || today(), defaultCardId)]);
  }

  function removeLine(i: number) {
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i)));
  }

  function addFromFavourite(favId: string) {
    const f = favourites.find((x) => x.id === favId);
    if (!f) return;
    setLines((ls) => [
      ...ls,
      {
        line_date: form.period_to || form.period_from || today(),
        category: f.category,
        description: f.description,
        amount_cad: String(f.amount_cad),
        gst_cad: String(f.gst_cad),
        credit_card_id: defaultCardId,
        receipt_url: null,
        pending_file: null,
        project_id: f.project_id,
      },
    ]);
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
      trip_label: form.trip_label || null,
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
        credit_card_id: l.credit_card_id ?? null,
        receipt_url: l.receipt_url ?? null,
        project_id: l.project_id ?? null,
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

        // Upload any receipts that were picked before the draft had an id.
        for (const [i, l] of lines.entries()) {
          if (l.pending_file) {
            const key = await uploadReceipt(sb, id, l.pending_file);
            parsedLines[i] = { ...parsedLines[i], receipt_url: key };
            // Reflect the new key so we don't try to re-upload on next save.
            updateLine(i, { receipt_url: key, pending_file: null });
          }
        }

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
          <DatePicker
            value={form.submission_date}
            onChange={(v) => updateForm('submission_date', v)}
            disabled={readOnly}
            ariaLabel="Submission date"
          />
        </Field>
        <Field label="Period from">
          <DatePicker
            value={form.period_from}
            onChange={(v) => updateForm('period_from', v)}
            disabled={readOnly}
            required
            ariaLabel="Period from"
          />
        </Field>
        <Field label="Period to">
          <DatePicker
            value={form.period_to}
            onChange={(v) => updateForm('period_to', v)}
            disabled={readOnly}
            required
            ariaLabel="Period to"
          />
        </Field>
      </div>

      <Field label="Trip / occasion" hint="e.g. Czech Republic Aug 2026 — helps admin cluster related lines">
        <input
          className={inputCls}
          value={form.trip_label ?? ''}
          onChange={(e) => updateForm('trip_label', e.target.value)}
          disabled={readOnly}
          maxLength={120}
          placeholder="Optional"
        />
      </Field>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/50">
              <tr>
                <th className="text-left px-2 py-2 font-normal w-[130px]">Date</th>
                <th className="text-left px-2 py-2 font-normal w-[150px]">
                  <span className="inline-flex items-center gap-1">
                    Category
                    <InfoHint label="Category">
                      <p>Pick from the 16-item list (Airfare, Hotel, Meal, SCBA Rental, …). Sets how accounting buckets the spend.</p>
                    </InfoHint>
                  </span>
                </th>
                <th className="text-left px-2 py-2 font-normal w-[130px]">
                  <span className="inline-flex items-center gap-1">
                    Project
                    <InfoHint label="Project">
                      <p>Bill the line to a specific project number. Leave blank for overhead / general spend.</p>
                    </InfoHint>
                  </span>
                </th>
                <th className="text-left px-2 py-2 font-normal w-[260px]">Description</th>
                <th className="text-left px-2 py-2 font-normal w-[150px]">
                  <span className="inline-flex items-center gap-1">
                    Card
                    <InfoHint label="Card">
                      <p>Which card paid. Register your cards under <em>Settings → Cards</em> so they show up here.</p>
                    </InfoHint>
                  </span>
                </th>
                <th className="text-right px-2 py-2 font-normal w-[130px]">
                  <span className="inline-flex items-center gap-1">
                    Amount (CAD)
                    <InfoHint label="Amount">
                      <p>CAD is authoritative. For foreign receipts, convert to CAD here — describe the FX rate in the row description if it matters.</p>
                    </InfoHint>
                  </span>
                </th>
                <th className="text-right px-2 py-2 font-normal w-[110px]">GST</th>
                <th className="w-[70px]">
                  <span className="inline-flex items-center gap-1">
                    Receipt
                    <InfoHint label="Receipt">
                      <p>Attach an image or PDF once the draft is saved. Admins view it inline during approval.</p>
                    </InfoHint>
                  </span>
                </th>
                <th className="w-[36px]"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const lineTotal = Number(l.amount_cad || 0) + Number(l.gst_cad || 0);
                return (
                  <tr key={i} className="border-t border-[var(--color-border-soft)] align-top">
                    <td className="px-2 py-2">
                      <DatePicker
                        value={l.line_date}
                        onChange={(v) => updateLine(i, { line_date: v })}
                        disabled={readOnly}
                        required
                        ariaLabel={`Line ${i + 1} date`}
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
                      <select
                        className={inputCls}
                        value={l.project_id ?? ''}
                        onChange={(e) => updateLine(i, { project_id: e.target.value || null })}
                        disabled={readOnly}
                      >
                        <option value="">— none —</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.project_number} — {p.name}
                          </option>
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
                      <select
                        className={inputCls}
                        value={l.credit_card_id ?? ''}
                        onChange={(e) => updateLine(i, { credit_card_id: e.target.value || null })}
                        disabled={readOnly}
                      >
                        <option value="">— none —</option>
                        {activeCards.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}{c.last_four ? ` ••${c.last_four}` : ''}
                          </option>
                        ))}
                      </select>
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
                      <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)] text-right font-mono tabular-nums">
                        line: {lineTotal.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                      </div>
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
                    <td className="px-2 py-2 text-center align-middle">
                      {l.receipt_url ? (
                        <div className="inline-flex items-center gap-0.5">
                          <span
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-[var(--color-surface-2)] text-[var(--color-accent)]"
                            title="Receipt attached"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </span>
                          {!readOnly ? (
                            <button
                              type="button"
                              onClick={() => updateLine(i, { receipt_url: null })}
                              className="text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)] text-sm leading-none px-1"
                              aria-label="Detach receipt"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      ) : l.pending_file ? (
                        <div className="inline-flex items-center gap-0.5">
                          <span
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-dashed border-[var(--color-accent)] text-[var(--color-accent)]"
                            title={`Will upload on save: ${l.pending_file.name}`}
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </span>
                          {!readOnly ? (
                            <button
                              type="button"
                              onClick={() => updateLine(i, { pending_file: null })}
                              className="text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)] text-sm leading-none px-1"
                              aria-label="Remove pending receipt"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      ) : canAttach ? (
                        <label
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] cursor-pointer"
                          title={uploadingIdx === i ? 'Uploading…' : 'Attach receipt'}
                          aria-label={uploadingIdx === i ? 'Uploading' : 'Attach receipt'}
                        >
                          {uploadingIdx === i ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Paperclip className="h-3.5 w-3.5" />
                          )}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) attachReceipt(i, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      ) : (
                        <span
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[var(--color-text-muted)] opacity-50"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </span>
                      )}
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
                <td colSpan={5} className="px-2 py-2">
                  {!readOnly ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={addLine}
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add line
                      </button>
                      {favourites.length > 0 ? (
                        <label className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                          <Plus className="h-3.5 w-3.5" />
                          <span>from favourite</span>
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                addFromFavourite(e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-xs"
                          >
                            <option value="">— pick —</option>
                            {favourites.map((f) => (
                              <option key={f.id} value={f.id}>{f.label}</option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold">
                  {totals.amount.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold">
                  {totals.gst.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                </td>
                <td colSpan={2} className="px-2 py-2 text-right font-mono tabular-nums font-semibold">
                  ={' '}{totals.total.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                </td>
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
        <div className="err-box">
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
