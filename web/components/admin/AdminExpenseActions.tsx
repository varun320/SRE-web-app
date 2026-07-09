'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import {
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
            className="rounded-md bg-emerald-600 text-white px-2 py-1 hover:opacity-90 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={pending}
            onClick={() => {
              const reason = prompt('Reason for declining?');
              if (!reason) return;
              run(() => declineExpense(sb, expenseId, reason));
            }}
            className="rounded-md border border-[color-mix(in_oklab,var(--color-destructive)_40%,transparent)] text-[var(--color-status-declined-fg)] px-2 py-1 hover:bg-[color-mix(in_oklab,var(--color-destructive)_8%,transparent)] disabled:opacity-50"
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
          className="rounded-md border border-[color-mix(in_oklab,var(--color-destructive)_40%,transparent)] text-[var(--color-status-declined-fg)] px-2 py-1 hover:bg-[color-mix(in_oklab,var(--color-destructive)_8%,transparent)] disabled:opacity-50"
        >
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
          className="rounded-md bg-[var(--color-accent)] text-white px-2 py-1 hover:opacity-90 disabled:opacity-50"
        >
          + Payout
        </button>
      )}
      {err ? <span className="text-[var(--color-status-declined-fg)]">{err}</span> : null}
    </div>
  );
}
