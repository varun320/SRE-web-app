import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchSubmittedQueue } from '@/lib/admin/queries';
import { ApprovalQueue } from '@/components/admin/ApprovalQueue';
import { AdminHero } from '@/components/admin/AdminHero';
import {
  AllWeeksTable,
  type WeekRow,
  type WeekStatus,
  type EmployeeOption,
} from '@/components/admin/AllWeeksTable';

const PAGE_SIZE = 50;
const VALID_STATUSES: WeekStatus[] = ['draft', 'submitted', 'approved', 'declined'];

interface SearchParams {
  page?: string;
  status?: string;
  user_id?: string;
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const status = (VALID_STATUSES as string[]).includes(sp.status ?? '')
    ? (sp.status as WeekStatus)
    : 'all';
  const userId = sp.user_id && sp.user_id.length > 0 ? sp.user_id : 'all';

  const sb = await getSupabaseServer();

  const queue = await fetchSubmittedQueue(sb);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: approvedThisWeek }, { count: declinedThisWeek }, { count: importedThisWeek }] =
    await Promise.all([
      sb.from('approval_log').select('id', { count: 'exact', head: true }).eq('action', 'approve').gte('at', since),
      sb.from('approval_log').select('id', { count: 'exact', head: true }).eq('action', 'decline').gte('at', since),
      sb.from('approval_log').select('id', { count: 'exact', head: true }).eq('action', 'imported').gte('at', since),
    ]);

  // --- Server-paged, server-filtered history ---
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  let tsQ = sb
    .from('timesheets')
    .select('id, user_id, week_start, status, locked, submitted_at, decided_at, decline_reason', { count: 'exact' })
    .order('week_start', { ascending: false })
    .range(from, to);
  if (status !== 'all') tsQ = tsQ.eq('status', status);
  if (userId !== 'all') tsQ = tsQ.eq('user_id', userId);
  const { data: tsRows, count: totalCount } = await tsQ;
  const ts = tsRows ?? [];

  // Join users + totals for the current page only.
  const userIds = Array.from(new Set(ts.map((r) => r.user_id as string)));
  const tsIds = ts.map((r) => r.id as string);

  const [pageUsersRes, totalsRes, employeesRes] = await Promise.all([
    userIds.length
      ? sb.from('users').select('id, full_name, employee_code').in('id', userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; employee_code: string }> }),
    tsIds.length
      ? sb.from('v_timesheet_totals').select('timesheet_id, total_hrs, overtime_earned').in('timesheet_id', tsIds)
      : Promise.resolve({ data: [] as Array<{ timesheet_id: string; total_hrs: number; overtime_earned: number }> }),
    sb.from('users').select('id, employee_code, full_name').eq('is_active', true).order('employee_code'),
  ]);
  const userById = new Map((pageUsersRes.data ?? []).map((u) => [u.id, u]));
  const totalsById = new Map((totalsRes.data ?? []).map((t) => [t.timesheet_id, t]));

  const allWeeks: WeekRow[] = ts.map((t) => {
    const u = userById.get(t.user_id as string);
    const tot = totalsById.get(t.id as string);
    return {
      id: t.id as string,
      user_id: t.user_id as string,
      full_name: u?.full_name ?? '—',
      employee_code: u?.employee_code ?? '',
      week_start: t.week_start as string,
      status: (t.status as WeekStatus) ?? 'draft',
      locked: Boolean(t.locked),
      submitted_at: (t.submitted_at as string | null) ?? null,
      decided_at: (t.decided_at as string | null) ?? null,
      decline_reason: (t.decline_reason as string | null) ?? null,
      total_hrs: Number(tot?.total_hrs ?? 0),
      overtime_earned: Number(tot?.overtime_earned ?? 0),
    };
  });

  const employees: EmployeeOption[] = (employeesRes.data ?? []) as EmployeeOption[];

  const oldestSubmitted = queue.length
    ? [...queue].sort(
        (a, b) =>
          new Date(a.submitted_at ?? 0).getTime() -
          new Date(b.submitted_at ?? 0).getTime(),
      )[0]?.submitted_at ?? null
    : null;

  return (
    <div className="px-4 md:px-6 py-6 space-y-6">
      <AdminHero
        pending={queue.length}
        approved7d={approvedThisWeek ?? 0}
        declined7d={declinedThisWeek ?? 0}
        imported7d={importedThisWeek ?? 0}
        oldestSubmittedISO={oldestSubmitted}
      />

      <ApprovalQueue rows={queue} />

      <section className="space-y-3 pt-4 border-t border-[var(--color-border-soft)]">
        <header>
          <h3 className="text-base font-medium tracking-tight">All weeks</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            Every timesheet across the org. Filter by status + employee; paginated {PAGE_SIZE} per page.
          </p>
        </header>
        <AllWeeksTable
          rows={allWeeks}
          employees={employees}
          filters={{
            status,
            userId,
            page,
            pageSize: PAGE_SIZE,
            total: totalCount ?? 0,
          }}
        />
      </section>
    </div>
  );
}

