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

interface Props {
  status: TimesheetStatus;
  declineReason: string | null;
  /** Monday-ISO of the week — used to compute the submit-by-Sunday deadline copy. */
  weekStart?: string;
}

export function StatusBanner({ status, declineReason, weekStart }: Props) {
  const { icon: Icon, title, body, tone } = CONFIG[status];
  const bg = `var(--color-status-${tone}-bg)`;
  const fg = `var(--color-status-${tone}-fg)`;
  const draftDeadline = status === 'draft' && weekStart ? deadlineCopy(weekStart) : null;
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
          <div className="opacity-80">
            {body}
            {draftDeadline ? <span className="ml-1 font-medium">· {draftDeadline}</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}

/** "Submit by Sunday · 3 days left" / "Due today" / "2 days overdue". */
function deadlineCopy(weekStartIso: string): string | null {
  const start = new Date(`${weekStartIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const sunday = new Date(start);
  sunday.setDate(start.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const now = new Date();
  const ms = sunday.getTime() - now.getTime();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));

  if (days > 1) return `Submit by Sunday · ${days} days left`;
  if (days === 1) return 'Submit by Sunday · 1 day left';
  if (days === 0) return 'Due today';
  const overdue = Math.abs(days);
  return `${overdue} day${overdue === 1 ? '' : 's'} overdue — submit as soon as you can`;
}
