import { getSupabaseServer } from '@/lib/supabase/server';
import { ApprovalLogClient, type ApprovalLogRow } from '@/components/admin/ApprovalLogClient';

export default async function ApprovalLogPage() {
  const sb = await getSupabaseServer();

  const { data: logRows, error: logErr } = await sb
    .from('approval_log')
    .select('id, action, at, comment, timesheet_id, actor_id')
    .order('at', { ascending: false })
    .limit(500);
  if (logErr) throw new Error(logErr.message);

  const tsIds = Array.from(new Set((logRows ?? []).map((r) => r.timesheet_id))).filter(Boolean) as string[];

  const [tsRes, totalsRes] = await Promise.all([
    tsIds.length
      ? sb.from('timesheets').select('id, week_start, user_id, status, locked').in('id', tsIds)
      : Promise.resolve({ data: [] as Array<{ id: string; week_start: string; user_id: string; status: string; locked: boolean }> }),
    tsIds.length
      ? sb.from('v_timesheet_totals')
          .select('timesheet_id, total_hrs, overtime_earned, til_used, vacation_used')
          .in('timesheet_id', tsIds)
      : Promise.resolve({ data: [] as Array<{ timesheet_id: string; total_hrs: number; overtime_earned: number; til_used: number; vacation_used: number }> }),
  ]);

  const tsById = new Map((tsRes.data ?? []).map((t) => [t.id as string, t]));
  const totalsById = new Map((totalsRes.data ?? []).map((t) => [t.timesheet_id as string, t]));

  const userIds = new Set<string>();
  for (const t of tsRes.data ?? []) userIds.add(t.user_id as string);
  for (const r of logRows ?? []) if (r.actor_id) userIds.add(r.actor_id as string);

  const { data: userRows } = userIds.size
    ? await sb.from('users').select('id, full_name, employee_code').in('id', Array.from(userIds))
    : { data: [] };
  const userById = new Map((userRows ?? []).map((u) => [u.id as string, u]));

  const rows: ApprovalLogRow[] = (logRows ?? []).map((r) => {
    const ts = tsById.get(r.timesheet_id as string);
    const emp = ts ? userById.get(ts.user_id as string) : null;
    const actor = r.actor_id ? userById.get(r.actor_id as string) : null;
    const totals = totalsById.get(r.timesheet_id as string);
    return {
      id: Number(r.id),
      action: String(r.action),
      at: String(r.at),
      comment: (r.comment as string | null) ?? null,
      employee: emp?.full_name ?? '—',
      employee_code: emp?.employee_code ?? '',
      week_start: (ts?.week_start as string) ?? '',
      status: (ts?.status as string) ?? '',
      locked: Boolean(ts?.locked),
      actor: actor?.full_name ?? '—',
      user_id: (ts?.user_id as string) ?? '',
      total_hrs: totals?.total_hrs ?? null,
      overtime_earned: totals?.overtime_earned ?? null,
      til_used: totals?.til_used ?? null,
      vacation_used: totals?.vacation_used ?? null,
    };
  });

  return (
    <div className="px-3 md:px-4 py-5 space-y-5">
      <header>
        <h2 className="text-lg font-medium tracking-tight">Audit log</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Every submit, approve, decline, unlock, import, and ledger recompute is recorded here. Latest 500 events.
        </p>
      </header>
      <ApprovalLogClient rows={rows} />
    </div>
  );
}
