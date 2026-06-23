import Link from 'next/link';
import type { QueueRow } from '@/lib/admin/queries';
import { formatDistanceToNow } from 'date-fns';

export function ApprovalQueue({ rows }: { rows: QueueRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="mx-6 my-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-8 text-center">
        <p className="text-[var(--color-text-muted)]">No timesheets waiting for approval right now.</p>
      </div>
    );
  }
  return (
    <div className="mx-6 my-6 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
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
              <td className="px-4 py-3 text-right font-mono tabular-nums">{r.overtime_earned.toFixed(2)}</td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}</td>
              <td className="px-4 py-3 text-right">
                <Link className="text-[var(--color-accent)] hover:underline" href={`/admin/employees/${r.user_id}/week/${r.week_start}`}>
                  Review →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
