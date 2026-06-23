import { getSupabaseServer } from '@/lib/supabase/server';
import { ApprovalLogTable } from '@/components/admin/ApprovalLogTable';

export default async function ApprovalLogPage() {
  const sb = await getSupabaseServer();

  // Step 1: pull the raw log
  const { data: logRows, error: logErr } = await sb
    .from('approval_log')
    .select('id, action, at, comment, timesheet_id, actor_id')
    .order('at', { ascending: false })
    .limit(200);
  if (logErr) throw new Error(logErr.message);

  // Step 2: resolve timesheet → user, and actor names, with separate lookups (more
  // robust than a deep PostgREST embed across FKs).
  const tsIds = Array.from(new Set((logRows ?? []).map((r) => r.timesheet_id))).filter(Boolean);
  const { data: tsRows } = tsIds.length
    ? await sb.from('timesheets').select('id, week_start, user_id').in('id', tsIds)
    : { data: [] };
  const tsById = new Map((tsRows ?? []).map((t) => [t.id as string, t]));

  const userIds = new Set<string>();
  for (const t of tsRows ?? []) userIds.add(t.user_id as string);
  for (const r of logRows ?? []) if (r.actor_id) userIds.add(r.actor_id as string);

  const { data: userRows } = userIds.size
    ? await sb.from('users').select('id, full_name, employee_code').in('id', Array.from(userIds))
    : { data: [] };
  const userById = new Map((userRows ?? []).map((u) => [u.id as string, u]));

  const rows = (logRows ?? []).map((r) => {
    const ts = tsById.get(r.timesheet_id as string);
    const emp = ts ? userById.get(ts.user_id as string) : null;
    const actor = r.actor_id ? userById.get(r.actor_id as string) : null;
    return {
      id: Number(r.id),
      action: String(r.action),
      at: String(r.at),
      comment: (r.comment as string | null) ?? null,
      employee: emp?.full_name ?? '—',
      employee_code: emp?.employee_code ?? '',
      week_start: (ts?.week_start as string) ?? '',
      actor: actor?.full_name ?? '—',
      user_id: (ts?.user_id as string) ?? '',
    };
  });

  return (
    <div className="px-6 py-6 space-y-4">
      <h2 className="text-lg font-semibold">Audit log</h2>
      <p className="text-sm text-[var(--color-text-muted)]">
        Every submit, approve, decline, unlock, import, and ledger-recompute is recorded here. The latest 200 events are shown.
      </p>
      <ApprovalLogTable rows={rows} />
    </div>
  );
}
