import type { TimesheetStatus } from '@/lib/types';
import { CheckCircle2, Clock, AlertTriangle, PencilLine } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

type Tone = 'draft' | 'submitted' | 'approved' | 'declined';

const CONFIG: Record<TimesheetStatus, {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
  tone: Tone;
}> = {
  draft:     { icon: PencilLine,    title: "You're editing a draft",       body: 'Save as you go. Submit when the week is complete.', tone: 'draft' },
  submitted: { icon: Clock,         title: 'Submitted for approval',       body: 'Waiting on admin review — you’ll see the decision here.', tone: 'submitted' },
  approved:  { icon: CheckCircle2,  title: 'Approved — this week is locked', body: 'Need a fix? Ask an admin to unlock.', tone: 'approved' },
  declined:  { icon: AlertTriangle, title: 'Declined — please fix and resubmit', body: '', tone: 'declined' },
};

export function StatusBanner({ status, declineReason }: { status: TimesheetStatus; declineReason: string | null }) {
  const { icon: Icon, title, body, tone } = CONFIG[status];
  const bg = `var(--color-status-${tone}-bg)`;
  const fg = `var(--color-status-${tone}-fg)`;
  return (
    <div
      role="status"
      className="mx-6 mt-6 mb-2 flex items-start gap-3 rounded-[var(--radius-lg)] px-4 py-3"
      style={{ background: bg, color: fg }}
    >
      <Icon className="h-5 w-5 mt-0.5 shrink-0" aria-hidden />
      <div className="text-sm leading-snug">
        <div className="font-medium">{title}</div>
        <div className="opacity-80">
          {status === 'declined' && declineReason ? `Reason: ${declineReason}` : body}
        </div>
      </div>
    </div>
  );
}
