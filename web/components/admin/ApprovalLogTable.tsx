import Link from 'next/link';

interface Row {
  id: number;
  action: string;
  at: string;
  comment: string | null;
  employee: string;
  employee_code: string;
  week_start: string;
  actor: string;
  user_id: string;
}

const ACTION_TONE: Record<string, string> = {
  submit: 'var(--color-status-submitted-fg)',
  approve: 'var(--color-status-approved-fg)',
  decline: 'var(--color-status-declined-fg)',
  unlock: 'var(--color-status-declined-fg)',
  imported: 'var(--color-text-muted)',
  ledger_recompute: 'var(--color-text-muted)',
};

export function ApprovalLogTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 text-sm text-[var(--color-text-muted)]">
        No activity yet. Approvals, declines, and unlocks will appear here as they happen.
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
          <tr>
            <th className="text-left px-4 py-3 font-normal">When</th>
            <th className="text-left px-4 py-3 font-normal">Action</th>
            <th className="text-left px-4 py-3 font-normal">Employee</th>
            <th className="text-left px-4 py-3 font-normal">Week</th>
            <th className="text-left px-4 py-3 font-normal">Actor</th>
            <th className="text-left px-4 py-3 font-normal">Comment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--color-border-soft)]">
              <td className="px-4 py-3 font-mono text-xs">{new Date(r.at).toISOString().replace('T', ' ').slice(0, 16)}</td>
              <td className="px-4 py-3" style={{ color: ACTION_TONE[r.action] ?? 'inherit' }}>{r.action}</td>
              <td className="px-4 py-3">
                {r.user_id && r.week_start ? (
                  <Link href={`/admin/employees/${r.user_id}/week/${r.week_start}`} className="hover:underline">
                    {r.employee} <span className="text-xs text-[var(--color-text-muted)] font-mono">({r.employee_code})</span>
                  </Link>
                ) : (
                  <>{r.employee} <span className="text-xs text-[var(--color-text-muted)] font-mono">({r.employee_code})</span></>
                )}
              </td>
              <td className="px-4 py-3 font-mono">{r.week_start || '—'}</td>
              <td className="px-4 py-3">{r.actor}</td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.comment ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
