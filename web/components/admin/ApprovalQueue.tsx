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
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Week</th>
              <th className="num">Hours</th>
              <th className="num">Overtime</th>
              <th>Submitted</th>
              <th className="actions"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.timesheet_id}>
                <td>
                  <div className="font-medium">{r.full_name}</div>
                  <div className="text-xs col-muted font-mono">{r.employee_code}</div>
                </td>
                <td className="font-mono">{r.week_start}</td>
                <td className="num">{r.total_hrs.toFixed(2)}</td>
                <td className="num">
                  {r.overtime_earned > 0 ? (
                    <span className="text-[var(--color-status-declined-fg)] font-medium">{r.overtime_earned.toFixed(2)}</span>
                  ) : (
                    r.overtime_earned.toFixed(2)
                  )}
                </td>
                <td className="col-muted">{formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}</td>
                <td className="actions">
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
