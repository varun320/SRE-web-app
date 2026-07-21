'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  adminDeleteExpense,
  approveExpense,
  declineExpense,
  unlockExpense,
  upsertPayout,
} from '@/lib/expenses/mutations';

interface Props {
  expenseId: string;
  status: string;
  locked: boolean;
  userId: string;
  invoiceNo: string;
}

export function AdminExpenseActions({ expenseId, status, locked, userId, invoiceNo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setErr(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'action failed');
      }
    });
  }

  const sb = getSupabaseBrowser();

  return (
    <div className="flex items-center justify-end gap-1.5 text-xs">
      {status === 'submitted' && (
        <>
          <button
            disabled={pending}
            onClick={() => run(() => approveExpense(sb, expenseId))}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2 py-1 hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            {pending ? 'Working…' : 'Approve'}
          </button>
          <button
            disabled={pending}
            onClick={() => {
              const reason = prompt('Reason for declining?');
              if (!reason) return;
              run(() => declineExpense(sb, expenseId, reason));
            }}
            className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_oklab,var(--color-destructive)_40%,transparent)] text-[var(--color-status-declined-fg)] px-2 py-1 hover:bg-[color-mix(in_oklab,var(--color-destructive)_8%,transparent)] disabled:opacity-50"
          >
            Decline
          </button>
        </>
      )}
      {(status === 'approved' || status === 'paid') && locked && (
        <button
          disabled={pending}
          onClick={() => {
            const reason = prompt('Reason for unlocking?');
            if (!reason) return;
            run(() => unlockExpense(sb, expenseId, reason));
          }}
          className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_oklab,var(--color-destructive)_40%,transparent)] text-[var(--color-status-declined-fg)] px-2 py-1 hover:bg-[color-mix(in_oklab,var(--color-destructive)_8%,transparent)] disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
          Unlock
        </button>
      )}
      {(status === 'approved' || status === 'paid') && (
        <button
          disabled={pending}
          onClick={() => {
            const amountStr = prompt('Payout amount (CAD)?');
            if (!amountStr) return;
            const amount = Number(amountStr);
            if (!Number.isFinite(amount) || amount <= 0) {
              setErr('Invalid amount');
              return;
            }
            const dateStr = prompt('Payout date (YYYY-MM-DD)?', new Date().toISOString().slice(0, 10));
            if (!dateStr) return;
            const reference = prompt('Reference / cheque # (optional)?') ?? undefined;
            run(() =>
              upsertPayout(sb, {
                user_id: userId,
                invoice_no: invoiceNo,
                payout_date: dateStr,
                amount_cad: amount,
                reference: reference || null,
              }),
            );
          }}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] text-white px-2 py-1 hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
          + Payout
        </button>
      )}
      <ConfirmDialog
        triggerLabel={
          <>
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </>
        }
        triggerVariant="outline"
        triggerSize="xs"
        title={`Delete report ${invoiceNo}?`}
        description="This permanently removes the report, its line items, and any recorded payouts against this invoice. Cannot be undone."
        confirmLabel="Delete"
        destructive
        successMessage="Report deleted"
        onConfirm={async () => {
          await adminDeleteExpense(sb, expenseId);
          router.push('/admin/expenses');
          router.refresh();
        }}
      />
      {err ? <span className="text-[var(--color-status-declined-fg)]">{err}</span> : null}
    </div>
  );
}
