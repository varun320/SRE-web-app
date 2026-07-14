import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchSubmittedQueue } from '@/lib/admin/queries';
import { ApprovalsInbox, type PanelPayload, type PanelLine } from '@/components/admin/ApprovalsInbox';
import {
  AllWeeksTable,
  type WeekRow,
  type WeekStatus,
  type EmployeeOption,
} from '@/components/admin/AllWeeksTable';

const PAGE_SIZE = 50;
const VALID_STATUSES: WeekStatus[] = ['draft', 'submitted', 'approved', 'declined'];
type View = 'inbox' | 'history';

interface SearchParams {
  view?: string;
  page?: string;
  status?: string;
  user_id?: string;
  panel?: string;
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const view: View = sp.view === 'history' ? 'history' : 'inbox';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const status = (VALID_STATUSES as string[]).includes(sp.status ?? '')
    ? (sp.status as WeekStatus)
    : 'all';
  const userId = sp.user_id && sp.user_id.length > 0 ? sp.user_id : 'all';

  const sb = await getSupabaseServer();
  const queue = await fetchSubmittedQueue(sb);

  // Side-panel payload for a selected inbox row.
  const panelId = sp.panel;
  let panel: PanelPayload | null = null;
  if (view === 'inbox' && panelId && queue.some((q) => q.timesheet_id === panelId)) {
    const queueEntry = queue.find((q) => q.timesheet_id === panelId)!;
    const [tsRes, totalsRes, linesRes, userRes] = await Promise.all([
      sb.from('timesheets').select('id, user_id, week_start, submitted_at, decline_reason').eq('id', panelId).single(),
      sb.from('v_timesheet_totals').select('total_hrs, overtime_earned, til_used, vacation_used').eq('timesheet_id', panelId).maybeSingle(),
      sb.from('v_weekly_report').select('main_category, sub_category, project_number, description, mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, sat_hrs, sun_hrs, row_total').eq('timesheet_id', panelId),
      sb.from('users').select('id, full_name, employee_code').eq('id', queueEntry.user_id).single(),
    ]);
    if (tsRes.data && userRes.data) {
      panel = {
        timesheet_id: tsRes.data.id as string,
        user_id: tsRes.data.user_id as string,
        full_name: userRes.data.full_name as string,
        employee_code: userRes.data.employee_code as string,
        week_start: tsRes.data.week_start as string,
        submitted_at: (tsRes.data.submitted_at as string | null) ?? null,
        decline_reason: (tsRes.data.decline_reason as string | null) ?? null,
        total_hrs: Number(totalsRes.data?.total_hrs ?? 0),
        overtime_earned: Number(totalsRes.data?.overtime_earned ?? 0),
        til_used: Number(totalsRes.data?.til_used ?? 0),
        vacation_used: Number(totalsRes.data?.vacation_used ?? 0),
        lines: (linesRes.data ?? []) as PanelLine[],
      };
    }
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: approvedThisWeek }, { count: declinedThisWeek }] = await Promise.all([
    sb.from('approval_log').select('id', { count: 'exact', head: true }).eq('action', 'approve').gte('at', since),
    sb.from('approval_log').select('id', { count: 'exact', head: true }).eq('action', 'decline').gte('at', since),
  ]);

  // Only fetch the history slice when the history tab is active.
  let allWeeks: WeekRow[] = [];
  let employees: EmployeeOption[] = [];
  let totalCount = 0;

  if (view === 'history') {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let tsQ = sb
      .from('timesheets')
      .select('id, user_id, week_start, status, locked, submitted_at, decided_at, decline_reason', { count: 'exact' })
      .order('week_start', { ascending: false })
      .range(from, to);
    if (status !== 'all') tsQ = tsQ.eq('status', status);
    if (userId !== 'all') tsQ = tsQ.eq('user_id', userId);
    const { data: tsRows, count } = await tsQ;
    totalCount = count ?? 0;
    const ts = tsRows ?? [];

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

    allWeeks = ts.map((t) => {
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
    employees = (employeesRes.data ?? []) as EmployeeOption[];
  }

  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-5">
      <TabBar
        view={view}
        pending={queue.length}
        approved={approvedThisWeek ?? 0}
        declined={declinedThisWeek ?? 0}
      />

      {view === 'inbox' ? (
        <ApprovalsInbox queue={queue} panel={panel} />
      ) : (
        <AllWeeksTable
          rows={allWeeks}
          employees={employees}
          filters={{
            status,
            userId,
            page,
            pageSize: PAGE_SIZE,
            total: totalCount,
          }}
        />
      )}
    </div>
  );
}

function TabBar({
  view,
  pending,
  approved,
  declined,
}: {
  view: View;
  pending: number;
  approved: number;
  declined: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-[var(--color-border-soft)] pb-3">
      <div role="tablist" aria-label="Approvals view" className="flex items-center gap-1">
        <Tab href="/admin?view=inbox" active={view === 'inbox'}>
          Inbox
          {pending > 0 ? <Count>{pending}</Count> : null}
        </Tab>
        <Tab href="/admin?view=history" active={view === 'history'}>
          History
        </Tab>
      </div>
      <div className="text-body-sm text-[var(--color-text-muted)] font-mono tabular">
        <span className="text-[var(--color-text-subtle)]">7d</span>
        <span className="mx-2 text-[var(--color-text-subtle)]">·</span>
        {approved} approved
        <span className="mx-2 text-[var(--color-text-subtle)]">·</span>
        {declined} declined
      </div>
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={[
        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-[var(--color-surface-2)] text-[var(--color-text)] font-medium'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/60',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-accent-tint)] px-1.5 py-0.5 text-[10px] font-mono tabular text-[var(--color-accent)] leading-none">
      {children}
    </span>
  );
}
