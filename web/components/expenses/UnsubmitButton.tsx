'use client';

import { useRouter } from 'next/navigation';
import { Undo2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { unsubmitExpense } from '@/lib/expenses/mutations';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
  expenseId: string;
  submittedAt: string;   // ISO timestamp
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function UnsubmitButton({ expenseId, submittedAt }: Props) {
  const router = useRouter();

  const submittedMs = new Date(submittedAt).getTime();
  const elapsed = Date.now() - submittedMs;
  if (Number.isNaN(submittedMs) || elapsed > WINDOW_MS) return null;
  const remainingH = Math.max(0, Math.round((WINDOW_MS - elapsed) / (60 * 60 * 1000)));

  return (
    <div className="flex items-center gap-2 text-xs">
      <ConfirmDialog
        triggerLabel={
          <>
            <Undo2 className="h-3.5 w-3.5" />
            Pull back to draft
          </>
        }
        triggerVariant="outline"
        title="Pull this report back to draft?"
        description={
          <>
            <p>Admin will no longer see it in the inbox.</p>
            <p className="mt-1">You have ~{remainingH}h left to do this.</p>
          </>
        }
        confirmLabel="Pull back"
        successMessage="Report is back in draft"
        onConfirm={async () => {
          await unsubmitExpense(getSupabaseBrowser(), expenseId);
          router.refresh();
        }}
      />
      <span className="text-[var(--color-text-muted)]">~{remainingH}h left</span>
    </div>
  );
}
