'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Undo2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { unsubmitExpense } from '@/lib/expenses/mutations';

interface Props {
  expenseId: string;
  submittedAt: string;   // ISO timestamp
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function UnsubmitButton({ expenseId, submittedAt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const submittedMs = new Date(submittedAt).getTime();
  const elapsed = Date.now() - submittedMs;
  if (Number.isNaN(submittedMs) || elapsed > WINDOW_MS) return null;
  const remainingH = Math.max(0, Math.round((WINDOW_MS - elapsed) / (60 * 60 * 1000)));

  const run = () => {
    if (!confirm('Pull this report back to draft? Admin will no longer see it in the inbox.')) return;
    setErr(null);
    startTransition(async () => {
      try {
        await unsubmitExpense(getSupabaseBrowser(), expenseId);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to pull back');
      }
    });
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm hover:bg-[var(--color-surface-2)] disabled:opacity-50"
        title={`You have ~${remainingH}h left to pull this back`}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
        {pending ? 'Pulling back…' : 'Pull back to draft'}
      </button>
      <span className="text-[var(--color-text-muted)]">~{remainingH}h left</span>
      {err ? <span className="text-[var(--color-status-declined-fg)]">{err}</span> : null}
    </div>
  );
}
