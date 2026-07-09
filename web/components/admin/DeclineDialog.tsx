'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { declineTimesheet } from '@/lib/admin/mutations';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function DeclineDialog({ timesheetId, disabled }: { timesheetId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const router = useRouter();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => declineTimesheet(getSupabaseBrowser(), timesheetId, reason.trim()),
    onSuccess: () => {
      toast.success('Declined');
      setOpen(false);
      setReason('');
      qc.invalidateQueries();
      router.refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Decline
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Decline this timesheet</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason (the employee will see this)</Label>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. project number on row 3 is wrong" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Keep reviewing</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || reason.trim().length === 0}>
            {m.isPending ? 'Declining…' : 'Decline'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
