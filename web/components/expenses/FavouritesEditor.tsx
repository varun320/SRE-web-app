'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseLineFavourite } from '@/lib/expenses/types';
import type { Project } from '@/lib/types';

interface Props {
  initial: ExpenseLineFavourite[];
  projects: Project[];
}

interface Draft {
  label: string;
  category: ExpenseCategory;
  description: string;
  amount_cad: string;
  gst_cad: string;
  project_id: string | null;
}

const EMPTY: Draft = {
  label: '',
  category: 'Software Subscription',
  description: '',
  amount_cad: '',
  gst_cad: '',
  project_id: null,
};

export function FavouritesEditor({ initial, projects }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  function save() {
    if (!draft.label.trim() || !draft.description.trim()) {
      setErr('Label + description are required.');
      return;
    }
    const amount = Number(draft.amount_cad || 0);
    const gst = Number(draft.gst_cad || 0);
    if (amount < 0 || gst < 0) {
      setErr('Amounts must be non-negative.');
      return;
    }
    setErr(null);
    startTransition(async () => {
      const sb = getSupabaseBrowser();
      const { data: userRow } = await sb.auth.getUser();
      const uid = userRow.user?.id;
      if (!uid) return;
      const { error } = await sb.from('expense_line_favourites').insert({
        user_id: uid,
        label: draft.label.trim(),
        category: draft.category,
        description: draft.description.trim(),
        amount_cad: amount,
        gst_cad: gst,
        project_id: draft.project_id,
      });
      if (error) {
        setErr(error.message);
        return;
      }
      setDraft(EMPTY);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm('Delete this favourite?')) return;
    startTransition(async () => {
      const sb = getSupabaseBrowser();
      const { error } = await sb.from('expense_line_favourites').delete().eq('id', id);
      if (error) setErr(error.message);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {initial.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          No favourites yet. Add recurring rows below (gym, software, Uber) — they&apos;ll appear as
          a &quot;from favourite&quot; picker in the report editor.
        </p>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
              <tr>
                <th className="text-left px-3 py-2 font-normal">Label</th>
                <th className="text-left px-3 py-2 font-normal">Category</th>
                <th className="text-left px-3 py-2 font-normal">Description</th>
                <th className="text-right px-3 py-2 font-normal">Amount</th>
                <th className="w-[36px]"></th>
              </tr>
            </thead>
            <tbody>
              {initial.map((f) => (
                <tr key={f.id} className="border-t border-[var(--color-border-soft)]">
                  <td className="px-3 py-2 font-medium">{f.label}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{f.category}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{f.description}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {Number(f.amount_cad).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => remove(f.id)}
                      disabled={pending}
                      aria-label={`Delete ${f.label}`}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] p-3 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <input
            className={inputCls}
            placeholder="Label (e.g. Gym)"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            maxLength={60}
          />
          <select
            className={inputCls}
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as ExpenseCategory }))}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            className={`${inputCls} md:col-span-2`}
            placeholder="Description"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            maxLength={500}
          />
          <input
            type="number" step="0.01" min="0"
            className={`${inputCls} text-right font-mono`}
            placeholder="Amount"
            value={draft.amount_cad}
            onChange={(e) => setDraft((d) => ({ ...d, amount_cad: e.target.value }))}
          />
          <input
            type="number" step="0.01" min="0"
            className={`${inputCls} text-right font-mono`}
            placeholder="GST"
            value={draft.gst_cad}
            onChange={(e) => setDraft((d) => ({ ...d, gst_cad: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            className={`${inputCls} max-w-[280px]`}
            value={draft.project_id ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, project_id: e.target.value || null }))}
          >
            <option value="">— no project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add favourite
          </button>
        </div>
        {err ? <div className="text-xs text-[var(--color-status-declined-fg)]">{err}</div> : null}
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40';
