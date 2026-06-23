'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { unlockTimesheet } from '@/lib/admin/mutations';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function UnlockDialog({ timesheetId }: { timesheetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const router = useRouter();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => unlockTimesheet(getSupabaseBrowser(), timesheetId, reason.trim()),
    onSuccess: () => {
      toast.success('Unlocked. Employee can now edit; later weeks will recompute on re-approval.');
      setOpen(false);
      setReason('');
      qc.invalidateQueries();
      router.refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors">
        Unlock
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Unlock this approved week</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-text-muted)]">
          The week reverts to declined so the employee can edit it. When they resubmit and you re-approve,
          every later week&apos;s TIL and vacation balance is automatically recomputed.
        </p>
        <div className="space-y-2">
          <Label htmlFor="unlock-reason">Reason</Label>
          <Input id="unlock-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. payroll noticed wrong project on row 2" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || reason.trim().length === 0}>
            {m.isPending ? 'Unlocking…' : 'Unlock'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
