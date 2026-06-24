'use client';
import type { TimesheetStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { approveTimesheet } from '@/lib/admin/mutations';
import { DeclineDialog } from './DeclineDialog';
import { UnlockDialog } from './UnlockDialog';
import { ForceSubmitDialog } from './ForceSubmitDialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Props {
  timesheetId: string;
  status: TimesheetStatus;
}

const STATUS_TONE = {
  draft:     'muted',
  submitted: 'info',
  approved:  'success',
  declined:  'danger',
} as const;

const STATUS_LABEL = {
  draft:     'Draft — employee editing',
  submitted: 'Submitted — awaiting your review',
  approved:  'Approved & locked',
  declined:  'Declined — back to employee',
} as const;

export function DecisionBar({ timesheetId, status }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const approve = useMutation({
    mutationFn: () => approveTimesheet(getSupabaseBrowser(), timesheetId, null),
    onSuccess: () => {
      toast.success('Approved — week is now locked.');
      qc.invalidateQueries();
      router.refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="sticky bottom-4 mx-4 md:mx-6 mb-6 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)]/95 backdrop-blur shadow-[var(--shadow-card)] p-3 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[var(--color-text-muted)]">Status:</span>
        <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusBadge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Approve — allowed from any non-approved state. */}
        {status !== 'approved' && (
          <Button onClick={() => approve.mutate()} disabled={approve.isPending} title="Mark this week approved and freeze its ledgers.">
            {approve.isPending ? 'Approving…' : status === 'submitted' ? 'Approve' : 'Approve (override)'}
          </Button>
        )}

        {/* Decline — allowed from any non-declined state. */}
        {status !== 'declined' && (
          <DeclineDialog timesheetId={timesheetId} />
        )}

        {/* Unlock — only meaningful on approved. */}
        {status === 'approved' && <UnlockDialog timesheetId={timesheetId} />}

        {/* Force-submit — only meaningful when draft or declined. */}
        {(status === 'draft' || status === 'declined') && (
          <ForceSubmitDialog timesheetId={timesheetId} />
        )}
      </div>
    </div>
  );
}
