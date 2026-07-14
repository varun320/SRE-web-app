import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { LockOpen, Lock } from 'lucide-react';
import { UnlockDialog } from '@/components/admin/UnlockDialog';
import { formatDistanceToNow } from 'date-fns';

interface ApprovedRow {
  id: string;
  user_id: string;
  week_start: string;
  decided_at: string | null;
  full_name: string;
  employee_code: string;
  total_hrs: number;
  overtime_earned: number;
}

export default async function LockedWeeksPage() {
  const sb = await getSupabaseServer();

  const { data: ts, error } = await sb
    .from('timesheets')
    .select('id, user_id, week_start, decided_at, status')
    .eq('status', 'approved')
    .eq('locked', true)
    .order('week_start', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const tsIds = (ts ?? []).map((t) => t.id);
  const userIds = Array.from(new Set((ts ?? []).map((t) => t.user_id)));

  const [usersRes, totalsRes] = await Promise.all([
    userIds.length
      ? sb.from('users').select('id, full_name, employee_code').in('id', userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; employee_code: string }> }),
    tsIds.length
      ? sb.from('v_timesheet_totals')
          .select('timesheet_id, total_hrs, overtime_earned')
          .in('timesheet_id', tsIds)
      : Promise.resolve({ data: [] as Array<{ timesheet_id: string; total_hrs: number; overtime_earned: number }> }),
  ]);

  const userById = new Map((usersRes.data ?? []).map((u) => [u.id, u]));
  const totalsById = new Map((totalsRes.data ?? []).map((t) => [t.timesheet_id, t]));

  const rows: ApprovedRow[] = (ts ?? []).map((t) => {
    const u = userById.get(t.user_id as string);
    const tot = totalsById.get(t.id as string);
    return {
      id: t.id as string,
      user_id: t.user_id as string,
      week_start: t.week_start as string,
      decided_at: (t.decided_at as string | null) ?? null,
      full_name: u?.full_name ?? '—',
      employee_code: u?.employee_code ?? '',
      total_hrs: Number(tot?.total_hrs ?? 0),
      overtime_earned: Number(tot?.overtime_earned ?? 0),
    };
  });

  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-4">
      <p className="text-body-sm text-[var(--color-text-muted)] max-w-2xl">
        Every approved &amp; locked week. Unlock sends a week back to the employee for edits, marks subsequent ledger rows stale, and reverts the week to <em>declined</em> with your reason in the audit log.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={Lock}
          title="No approved weeks yet"
          description="Once you approve a submission, it'll appear here. Unlock is available from any approved week's row."
        />
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
                <tr>
                  <th className="text-left px-4 py-3 font-normal">Employee</th>
                  <th className="text-left px-4 py-3 font-normal">Week</th>
                  <th className="text-right px-4 py-3 font-normal">Hours</th>
                  <th className="text-right px-4 py-3 font-normal">Overtime</th>
                  <th className="text-left px-4 py-3 font-normal">Approved</th>
                  <th className="text-left px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/employees/${r.user_id}/week/${r.week_start}`}
                        className="hover:underline"
                      >
                        <div className="font-medium">{r.full_name}</div>
                        <div className="text-xs text-[var(--color-text-muted)] font-mono">{r.employee_code}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.week_start}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{r.total_hrs.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {r.overtime_earned > 0 ? (
                        <span className="text-[var(--color-status-declined-fg)] font-medium">{r.overtime_earned.toFixed(2)}</span>
                      ) : (
                        '0.00'
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {r.decided_at ? formatDistanceToNow(new Date(r.decided_at), { addSuffix: true }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone="success">
                        <Lock className="h-2.5 w-2.5 mr-1 inline" />
                        Locked
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UnlockDialog timesheetId={r.id} variant="inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
        <LockOpen className="h-3 w-3" />
        Unlocking cascades — all approved weeks AFTER the unlocked one get their ledgers marked
        stale, and they recompute on re-approval. Use sparingly.
      </p>
    </div>
  );
}
