'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { adminForceSubmit } from '@/lib/admin/mutations';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function ForceSubmitDialog({ timesheetId }: { timesheetId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const m = useMutation({
    mutationFn: () => adminForceSubmit(getSupabaseBrowser(), timesheetId, reason.trim()),
    onSuccess: () => {
      toast.success('Submitted on employee’s behalf.');
      qc.invalidateQueries();
      setOpen(false);
      setReason('');
      router.refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Force-submit</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit on employee’s behalf</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-text-muted)]">
          Pushes this draft into <strong>submitted</strong> so it can be approved. The reason will appear in the audit log.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="force-reason">Reason</Label>
          <textarea
            id="force-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Employee out sick — submitting on their behalf for payroll cutoff"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || reason.trim().length === 0}>
            {m.isPending ? 'Submitting…' : 'Submit on their behalf'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
