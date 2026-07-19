'use client';
import { Loader2, Paperclip, Trash2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { EXPENSE_CATEGORIES, type CreditCard, type ExpenseCategory } from '@/lib/expenses/types';
import type { Project } from '@/lib/types';

export interface LineCardValue {
  line_date: string;
  category: ExpenseCategory;
  description: string;
  amount_cad: string;
  gst_cad: string;
  credit_card_id: string | null;
  receipt_url: string | null;
  pending_file: File | null;
  project_id: string | null;
}

interface Props {
  index: number;
  line: LineCardValue;
  activeCards: CreditCard[];
  projects: Project[];
  readOnly: boolean;
  canAttach: boolean;
  canRemove: boolean;
  uploading: boolean;
  onChange: (patch: Partial<LineCardValue>) => void;
  onRemove: () => void;
  onAttach: (file: File) => void;
}

const inputCls =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60';

export function ExpenseLineCardMobile({
  index,
  line,
  activeCards,
  projects,
  readOnly,
  canAttach,
  canRemove,
  uploading,
  onChange,
  onRemove,
  onAttach,
}: Props) {
  const lineTotal = Number(line.amount_cad || 0) + Number(line.gst_cad || 0);
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Line {index + 1}</span>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove line ${index + 1}`}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)] p-1 -m-1 rounded"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <DatePicker
            value={line.line_date}
            onChange={(v) => onChange({ line_date: v })}
            disabled={readOnly}
            required
            ariaLabel={`Line ${index + 1} date`}
          />
        </Field>
        <Field label="Category">
          <select
            className={inputCls}
            value={line.category}
            onChange={(e) => onChange({ category: e.target.value as ExpenseCategory })}
            disabled={readOnly}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description">
        <input
          className={inputCls}
          value={line.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What was purchased and why"
          disabled={readOnly}
          required
        />
      </Field>

      <Field label="Project (optional)">
        <select
          className={inputCls}
          value={line.project_id ?? ''}
          onChange={(e) => onChange({ project_id: e.target.value || null })}
          disabled={readOnly}
        >
          <option value="">— none —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_number} — {p.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (CAD)">
          <input
            type="number" step="0.01" min="0" inputMode="decimal"
            className={`${inputCls} text-right font-mono`}
            value={line.amount_cad}
            onChange={(e) => onChange({ amount_cad: e.target.value })}
            disabled={readOnly}
            required
          />
        </Field>
        <Field label="GST">
          <input
            type="number" step="0.01" min="0" inputMode="decimal"
            className={`${inputCls} text-right font-mono`}
            value={line.gst_cad}
            onChange={(e) => onChange({ gst_cad: e.target.value })}
            disabled={readOnly}
          />
        </Field>
      </div>

      <Field label="Card (optional)">
        <select
          className={inputCls}
          value={line.credit_card_id ?? ''}
          onChange={(e) => onChange({ credit_card_id: e.target.value || null })}
          disabled={readOnly}
        >
          <option value="">— none —</option>
          {activeCards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}{c.last_four ? ` ••${c.last_four}` : ''}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-center justify-between pt-1">
        {line.receipt_url ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)]">
            <Paperclip className="h-4 w-4" /> Receipt attached
            {!readOnly ? (
              <button
                type="button"
                onClick={() => onChange({ receipt_url: null })}
                className="ml-1 text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)] text-sm"
                aria-label="Detach receipt"
              >
                remove
              </button>
            ) : null}
          </span>
        ) : line.pending_file ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)]">
            <Paperclip className="h-4 w-4" /> Ready to upload
            {!readOnly ? (
              <button
                type="button"
                onClick={() => onChange({ pending_file: null })}
                className="ml-1 text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)] text-sm"
                aria-label="Remove pending receipt"
              >
                remove
              </button>
            ) : null}
          </span>
        ) : canAttach ? (
          <label className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text)] cursor-pointer">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Attach receipt'}
            <input
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onAttach(f);
                e.target.value = '';
              }}
            />
          </label>
        ) : (
          <span className="text-sm text-[var(--color-text-muted)] opacity-60 inline-flex items-center gap-1.5">
            <Paperclip className="h-4 w-4" /> No receipt
          </span>
        )}
        <span className="text-xs text-[var(--color-text-muted)] font-mono tabular-nums">
          = {lineTotal.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
        </span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      {children}
    </label>
  );
}
