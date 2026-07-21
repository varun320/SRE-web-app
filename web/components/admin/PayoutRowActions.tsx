'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Loader2 } from 'lucide-react';
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
import { deletePayout, upsertPayout } from '@/lib/expenses/mutations';
import { friendlyError } from '@/lib/errors';

export interface PayoutRow {
  id: string;
  user_id: string;
  invoice_no: string;
  payout_date: string;
  amount_cad: number;
  reference: string | null;
  notes: string | null;
}

interface Props {
  payout: PayoutRow;
}

export function PayoutRowActions({ payout }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, start] = useTransition();
  const [date, setDate] = useState(payout.payout_date);
  const [amount, setAmount] = useState(String(payout.amount_cad));
  const [reference, setReference] = useState(payout.reference ?? '');
  const [notes, setNotes] = useState(payout.notes ?? '');

  function save() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }
    start(async () => {
      try {
        await upsertPayout(getSupabaseBrowser(), {
          id: payout.id,
          user_id: payout.user_id,
          invoice_no: payout.invoice_no,
          payout_date: date,
          amount_cad: amt,
          reference: reference || null,
          notes: notes || null,
        });
        toast.success('Payout updated');
        setEditOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(friendlyError(err));
      }
    });
  }

  async function remove() {
    await deletePayout(getSupabaseBrowser(), payout.id);
    router.refresh();
  }

  return (
    <div className="inline-flex items-center gap-1">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogPrimitive.Trigger
          render={<Button variant="ghost" size="xs" aria-label="Edit payout" />}
        >
          <Pencil className="h-3.5 w-3.5" />
        </DialogPrimitive.Trigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit payout · {payout.invoice_no}</DialogTitle>
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
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        triggerLabel={<Trash2 className="h-3.5 w-3.5" />}
        triggerVariant="ghost"
        triggerSize="xs"
        title={`Delete payout for ${payout.invoice_no}?`}
        description={`This removes the ${payout.amount_cad.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })} payment recorded on ${payout.payout_date}. The report's outstanding balance will re-open.`}
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
        successMessage="Payout deleted"
      />
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
