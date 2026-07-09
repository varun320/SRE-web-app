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
  declined:  { icon: AlertTriangle, title: 'Declined — fix and resubmit', body: '', tone: 'declined' },
};

export function StatusBanner({ status, declineReason }: { status: TimesheetStatus; declineReason: string | null }) {
  const { icon: Icon, title, body, tone } = CONFIG[status];
  const bg = `var(--color-status-${tone}-bg)`;
  const fg = `var(--color-status-${tone}-fg)`;
  return (
    <div
      role="status"
      className="mx-3 md:mx-4 mt-4 mb-2 flex items-start gap-3 rounded-[var(--radius-lg)] px-4 py-3"
      style={{ background: bg, color: fg }}
    >
      <Icon className="h-5 w-5 mt-0.5 shrink-0" aria-hidden />
      <div className="text-sm leading-snug flex-1">
        <div className="font-medium">{title}</div>
        {status === 'declined' && declineReason ? (
          <>
            <div className="mt-1 px-2 py-1 rounded-[var(--radius)] bg-white/40 text-[13px]">
              <span className="opacity-70">Admin said:</span> <span className="font-medium">{declineReason}</span>
            </div>
            <div className="opacity-80 mt-1 text-xs">What to do next: edit the rows above and click Submit for approval again.</div>
          </>
        ) : (
          <div className="opacity-80">{body}</div>
        )}
      </div>
    </div>
  );
}
