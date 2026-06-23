'use client';
import type { TimesheetStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { approveTimesheet } from '@/lib/admin/mutations';
import { DeclineDialog } from './DeclineDialog';
import { UnlockDialog } from './UnlockDialog';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Props {
  timesheetId: string;
  status: TimesheetStatus;
}

export function DecisionBar({ timesheetId, status }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const approve = useMutation({
    mutationFn: () => approveTimesheet(getSupabaseBrowser(), timesheetId, null),
    onSuccess: () => {
      toast.success('Approved');
      qc.invalidateQueries();
      router.refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="sticky bottom-4 mx-6 mb-6 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] px-4 py-3 flex items-center justify-between">
      <span className="text-sm text-[var(--color-text-muted)]">
        Current status: <strong className="text-[var(--color-text)]">{status}</strong>
      </span>
      <div className="flex gap-2">
        {status === 'submitted' && (
          <>
            <DeclineDialog timesheetId={timesheetId} />
            <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </>
        )}
        {status === 'approved' && <UnlockDialog timesheetId={timesheetId} />}
        {(status === 'draft' || status === 'declined') && (
          <span className="text-xs text-[var(--color-text-muted)]">Employee is still editing — no admin actions available.</span>
        )}
      </div>
    </div>
  );
}
