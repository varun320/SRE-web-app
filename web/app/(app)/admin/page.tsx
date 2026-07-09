import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchSubmittedQueue } from '@/lib/admin/queries';
import { ApprovalsInbox, type PanelPayload, type PanelLine } from '@/components/admin/ApprovalsInbox';
import {
  AllWeeksTable,
  type WeekRow,
  type WeekStatus,
  type EmployeeOption,
} from '@/components/admin/AllWeeksTable';
import { Clock4, CheckCircle2, XCircle, FileDown } from 'lucide-react';

const PAGE_SIZE = 50;
const VALID_STATUSES: WeekStatus[] = ['draft', 'submitted', 'approved', 'declined'];

interface SearchParams {
  page?: string;
  status?: string;
  user_id?: string;
  panel?: string;   // ?panel=<timesheet_id> — selected week in the inbox side panel
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

  // Pre-fetch the side-panel payload for the currently selected week, if any.
  const panelId = sp.panel;
  let panel: PanelPayload | null = null;
  if (panelId && queue.some((q) => q.timesheet_id === panelId)) {
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

  return (
    <div className="px-3 md:px-4 py-5 space-y-6">
      <header>
        <h2 className="text-lg font-medium tracking-tight">Approval queue</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Submitted timesheets waiting for review, oldest first. Full history below.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Clock4}        label="Pending review" value={queue.length}             tone="info" />
        <StatCard icon={CheckCircle2}  label="Approved (7d)"  value={approvedThisWeek ?? 0}    tone="success" />
        <StatCard icon={XCircle}       label="Declined (7d)"  value={declinedThisWeek ?? 0}    tone="danger" />
        <StatCard icon={FileDown}      label="Imported (7d)"  value={importedThisWeek ?? 0}    tone="muted" />
      </div>

      <ApprovalsInbox queue={queue} panel={panel} />

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

const TONE_STYLES = {
  info:    { icon: 'text-[var(--color-status-submitted-fg)]' },
  success: { icon: 'text-[var(--color-status-approved-fg)]' },
  danger:  { icon: 'text-[var(--color-status-declined-fg)]' },
  muted:   { icon: 'text-[var(--color-text-muted)]' },
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: keyof typeof TONE_STYLES;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-caption text-[var(--color-text-muted)]">{label}</span>
        <Icon className={`h-4 w-4 ${styles.icon}`} />
      </div>
      <div className="mt-1 font-mono tabular text-[28px] font-medium leading-none">{value}</div>
    </div>
  );
}
