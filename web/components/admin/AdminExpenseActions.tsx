'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdminExpenseActions({ expenseId, status, locked, userId, invoiceNo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const sb = getSupabaseBrowser();

  function run(fn: () => Promise<unknown>, successMsg?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (successMsg) toast.success(successMsg);
        router.refresh();
      } catch (e) {
        toast.error(friendlyError(e));
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5 text-xs">
      {status === 'submitted' && (
        <>
          <Button
            size="xs"
            disabled={pending}
            onClick={() => run(() => approveExpense(sb, expenseId), 'Approved')}
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            Approve
          </Button>
          <ReasonDialog
            triggerLabel="Decline"
            triggerVariant="outline"
            title={`Decline ${invoiceNo}?`}
            placeholder="Reason (shown to the employee)"
            confirmLabel="Decline"
            destructive
            onConfirm={(reason) => declineExpense(sb, expenseId, reason)}
            successMessage="Report declined"
          />
        </>
      )}
      {(status === 'approved' || status === 'paid') && locked && (
        <ReasonDialog
          triggerLabel="Unlock"
          triggerVariant="outline"
          title={`Unlock ${invoiceNo}?`}
          placeholder="Why are you unlocking this? (shown to the employee)"
          confirmLabel="Unlock"
          destructive
          onConfirm={(reason) => unlockExpense(sb, expenseId, reason)}
          successMessage="Report unlocked"
        />
      )}
      {(status === 'approved' || status === 'paid') && (
        <PayoutCreateDialog
          userId={userId}
          invoiceNo={invoiceNo}
          onSaved={() => router.refresh()}
        />
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
    </div>
  );
}

// -----------------------------------------------------------------------------

interface ReasonDialogProps {
  triggerLabel: ReactNode;
  triggerVariant?: 'default' | 'outline' | 'destructive' | 'ghost' | 'secondary';
  title: string;
  placeholder: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
  successMessage?: string;
}

function ReasonDialog({
  triggerLabel,
  triggerVariant = 'outline',
  title,
  placeholder,
  confirmLabel,
  destructive,
  onConfirm,
  successMessage,
}: ReasonDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();

  function save() {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error('Please provide a reason');
      return;
    }
    start(async () => {
      try {
        await onConfirm(trimmed);
        if (successMessage) toast.success(successMessage);
        setOpen(false);
        setReason('');
        router.refresh();
      } catch (err) {
        toast.error(friendlyError(err));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger render={<Button variant={triggerVariant} size="xs" />}>
        {triggerLabel}
      </DialogPrimitive.Trigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[80px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={save}
            disabled={pending}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------

interface PayoutCreateDialogProps {
  userId: string;
  invoiceNo: string;
  onSaved: () => void;
}

function PayoutCreateDialog({ userId, invoiceNo, onSaved }: PayoutCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, start] = useTransition();

  function reset() {
    setDate(today());
    setAmount('');
    setReference('');
    setNotes('');
  }

  function save() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }
    start(async () => {
      try {
        await upsertPayout(getSupabaseBrowser(), {
          user_id: userId,
          invoice_no: invoiceNo,
          payout_date: date,
          amount_cad: amt,
          reference: reference || null,
          notes: notes || null,
        });
        toast.success('Payout recorded');
        setOpen(false);
        reset();
        onSaved();
      } catch (err) {
        toast.error(friendlyError(err));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger render={<Button size="xs" />}>+ Payout</DialogPrimitive.Trigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payout · {invoiceNo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Amount (CAD)">
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputCls} text-right font-mono`}
            />
          </Field>
          <Field label="Reference / cheque #">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputCls} min-h-[60px]`}
              placeholder="Optional"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inputCls =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
