'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
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
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { upsertPayout } from '@/features/expenses/mutations';
import { friendlyError } from '@/lib/errors';

interface Props {
  userId: string;
  invoiceNo: string;
  suggestedAmount: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddPayoutButton({ userId, invoiceNo, suggestedAmount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(suggestedAmount > 0 ? suggestedAmount.toFixed(2) : '');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

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
        toast.success('Payment recorded');
        setOpen(false);
        setAmount('');
        setReference('');
        setNotes('');
        setDate(today());
        router.refresh();
      } catch (err) {
        toast.error(friendlyError(err));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger render={<Button variant="outline" size="xs" />}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add payment
      </DialogPrimitive.Trigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment · {invoiceNo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Amount (CAD)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputCls} text-right font-mono`}
              placeholder={suggestedAmount > 0 ? suggestedAmount.toFixed(2) : '0.00'}
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
              placeholder="Optional — e.g. tranche 2 of 3"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Record'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
