'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { creditCardSchema } from '@/lib/expenses/schemas';
import { deleteCreditCard, upsertCreditCard } from '@/lib/expenses/mutations';
import type { CreditCard } from '@/lib/expenses/types';

interface Props {
  initial: CreditCard[];
}

interface Draft {
  label: string;
  last_four: string;
  is_default: boolean;
  is_active: boolean;
}

const EMPTY: Draft = { label: '', last_four: '', is_default: false, is_active: true };

export function CreditCardsEditor({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  function beginEdit(c: CreditCard) {
    setEditingId(c.id);
    setDraft({
      label: c.label,
      last_four: c.last_four ?? '',
      is_default: c.is_default,
      is_active: c.is_active,
    });
    setErr(null);
  }

  function reset() {
    setEditingId(null);
    setDraft(EMPTY);
    setErr(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = creditCardSchema.safeParse({
      id: editingId ?? undefined,
      label: draft.label,
      last_four: draft.last_four ? draft.last_four : null,
      is_default: draft.is_default,
      is_active: draft.is_active,
    });
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    startTransition(async () => {
      try {
        await upsertCreditCard(getSupabaseBrowser(), parsed.data);
        reset();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  async function remove(id: string) {
    if (!confirm('Delete this card? Line items that referenced it will keep the amount but lose the card link.')) return;
    startTransition(async () => {
      try {
        await deleteCreditCard(getSupabaseBrowser(), id);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Delete failed');
      }
    });
  }

  return (
    <div className="space-y-4">
      {initial.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
            <tr>
              <th className="text-left px-2 py-2 font-normal">Label</th>
              <th className="text-left px-2 py-2 font-normal">Last 4</th>
              <th className="text-left px-2 py-2 font-normal">Default</th>
              <th className="text-left px-2 py-2 font-normal">Active</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((c) => (
              <tr key={c.id} className="border-t border-[var(--color-border-soft)]">
                <td className="px-2 py-2">{c.label}</td>
                <td className="px-2 py-2 font-mono text-[var(--color-text-muted)]">{c.last_four ? `•••• ${c.last_four}` : '—'}</td>
                <td className="px-2 py-2">{c.is_default ? 'yes' : ''}</td>
                <td className="px-2 py-2">{c.is_active ? 'yes' : 'no'}</td>
                <td className="px-2 py-2 text-right">
                  <button type="button" onClick={() => beginEdit(c)} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] mr-2">
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    aria-label={`Delete ${c.label}`}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)]"
                  >
                    <Trash2 className="h-4 w-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">No cards yet — add one below.</p>
      )}

      <form onSubmit={save} className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/40 p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Label</span>
            <input
              className={inputCls}
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="e.g. Amex Business"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Last four</span>
            <input
              className={`${inputCls} font-mono`}
              value={draft.last_four}
              onChange={(e) => setDraft((d) => ({ ...d, last_four: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              placeholder="1234"
              inputMode="numeric"
              maxLength={4}
            />
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              checked={draft.is_default}
              onChange={(e) => setDraft((d) => ({ ...d, is_default: e.target.checked }))}
            />
            <span className="text-sm">Default</span>
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
            />
            <span className="text-sm">Active</span>
          </label>
        </div>
        {err ? (
          <div className="err-box">{err}</div>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> {editingId ? 'Save changes' : 'Add card'}
          </button>
          {editingId ? (
            <button type="button" onClick={reset} className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-sm">
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

const inputCls =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60';
