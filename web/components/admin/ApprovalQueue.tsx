import Link from 'next/link';
import { Inbox } from 'lucide-react';
import type { QueueRow } from '@/lib/admin/queries';
import { formatDistanceToNow } from 'date-fns';
import { EmptyState } from '@/components/ui/empty-state';

export function ApprovalQueue({ rows }: { rows: QueueRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Inbox zero"
        description="No timesheets waiting for approval right now. New submissions land here oldest-first."
      />
    );
  }
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
            <tr>
              <th className="text-left px-4 py-3 font-normal">Employee</th>
              <th className="text-left px-4 py-3 font-normal">Week</th>
              <th className="text-right px-4 py-3 font-normal">Hours</th>
              <th className="text-right px-4 py-3 font-normal">Overtime</th>
              <th className="text-left px-4 py-3 font-normal">Submitted</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.timesheet_id} className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.full_name}</div>
                  <div className="text-xs text-[var(--color-text-muted)] font-mono">{r.employee_code}</div>
                </td>
                <td className="px-4 py-3 font-mono">{r.week_start}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{r.total_hrs.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {r.overtime_earned > 0 ? (
                    <span className="text-amber-700 dark:text-amber-300 font-medium">{r.overtime_earned.toFixed(2)}</span>
                  ) : (
                    r.overtime_earned.toFixed(2)
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline font-medium"
                    href={`/admin/employees/${r.user_id}/week/${r.week_start}`}
                  >
                    Review <span aria-hidden>→</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
