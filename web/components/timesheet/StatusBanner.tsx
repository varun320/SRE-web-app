import type { TimesheetStatus } from '@/lib/types';

const COPY: Record<TimesheetStatus, { text: string; color: string }> = {
  draft:     { text: '📝  Draft — your edits are not yet submitted.',           color: 'var(--color-status-draft)' },
  submitted: { text: '🔒  Submitted — awaiting admin approval.',                color: 'var(--color-status-submitted)' },
  approved:  { text: '✅  Approved — this week is locked.',                     color: 'var(--color-status-approved)' },
  declined:  { text: '⚠️  Declined — fix the issues below and re-submit.',     color: 'var(--color-status-declined)' },
};

export function StatusBanner({ status, declineReason }: { status: TimesheetStatus; declineReason: string | null }) {
  const { text, color } = COPY[status];
  return (
    <div role="status" className="w-full px-6 py-3 text-sm font-medium" style={{ background: color, color: 'oklch(98% 0 0)' }}>
      {text}{declineReason ? ` — Reason: ${declineReason}` : ''}
    </div>
  );
}
