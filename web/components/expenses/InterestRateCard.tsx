'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/client';

interface Props {
  apr: number;      // e.g. 0.2199 = 21.99%
  graceDays: number;
}

export function InterestRateCard({ apr, graceDays }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [aprPct, setAprPct] = useState(String((apr * 100).toFixed(2)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const pct = Number(aprPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 500) {
      setErr('APR must be between 0% and 500%');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getSupabaseBrowser();
        const { data: userRow } = await sb.auth.getUser();
        const uid = userRow.user?.id;
        if (!uid) throw new Error('not authenticated');
        const { error } = await sb
          .from('expense_settings')
          .upsert({ user_id: uid, apr: pct / 100, grace_days: graceDays });
        if (error) throw new Error(error.message);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  return (
    <form onSubmit={save} className="flex items-end gap-3">
      <label className="block space-y-1">
        <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">APR (%)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          max="500"
          className="w-32 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm font-mono"
          value={aprPct}
          onChange={(e) => setAprPct(e.target.value)}
          required
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        {pending ? 'Saving…' : 'Save rate'}
      </button>
      {err ? <span className="text-xs text-red-600 dark:text-red-300">{err}</span> : null}
    </form>
  );
}
