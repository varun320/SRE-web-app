'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { deleteExpenseDraft } from '@/lib/expenses/mutations';

interface Props {
  expenseId: string;
  invoiceNo: string;
}

export function DeleteDraftButton({ expenseId, invoiceNo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const run = () => {
    if (!confirm(`Delete draft ${invoiceNo}? Line items + receipts go too. This can't be undone.`)) return;
    setErr(null);
    startTransition(async () => {
      try {
        await deleteExpenseDraft(getSupabaseBrowser(), expenseId);
        router.push('/expenses');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Delete failed');
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_oklab,var(--color-destructive)_40%,transparent)] px-2.5 py-1.5 text-sm text-[var(--color-status-declined-fg)] hover:bg-[color-mix(in_oklab,var(--color-destructive)_8%,transparent)] disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        {pending ? 'Deleting…' : 'Delete draft'}
      </button>
      {err ? <span className="text-xs text-[var(--color-status-declined-fg)]">{err}</span> : null}
    </div>
  );
}
