import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { Receipt, AlertTriangle } from 'lucide-react';
import { AdminExpensesTableBody } from '@/components/admin/AdminExpensesTableBody';

type SortKey = 'submission_date' | 'invoice_no' | 'total_cad' | 'status' | 'employee';
const SORT_KEYS: readonly SortKey[] = ['submission_date', 'invoice_no', 'total_cad', 'status', 'employee'];

function money(n: number): string {
  return Number(n).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

function isSortKey(v: string | undefined): v is SortKey {
  return !!v && (SORT_KEYS as readonly string[]).includes(v);
}

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string;
    employee?: string;
    project?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const status = sp.status && sp.status !== 'all' ? sp.status : undefined;
  const employee = sp.employee ?? '';
  const projectId = sp.project && sp.project !== 'all' ? sp.project : undefined;
  const sort: SortKey = isSortKey(sp.sort) ? sp.sort : 'submission_date';
  const dir: 'asc' | 'desc' = sp.dir === 'asc' ? 'asc' : 'desc';
  const ascending = dir === 'asc';

  const sb = await getSupabaseServer();

  const projectsPromise = sb
    .from('projects')
    .select('id, project_number, name')
    .order('project_number', { ascending: false });

  const overduePromise = sb
    .from('v_expense_balance_full')
    .select('id, user_id, invoice_no, submission_date, days_overdue, outstanding, interest_owing, total_owing, balance_status')
    .in('balance_status', ['overdue', 'interest_owing'])
    .order('days_overdue', { ascending: false })
    .limit(5);

  let q = sb
    .from('expense_reports')
    .select('id, user_id, invoice_no, period_from, period_to, submission_date, total_cad, status, locked, decline_reason')
    .limit(200);
  if (status) q = q.eq('status', status);
  if (projectId) {
    // Reports whose line items reference the chosen project.
    const { data: linked } = await sb
      .from('expense_line_items')
      .select('expense_id')
      .eq('project_id', projectId);
    const ids = Array.from(new Set((linked ?? []).map((l) => l.expense_id)));
    if (ids.length === 0) {
      return renderEmpty();
    }
    q = q.in('id', ids);
  }

  // DB-side ordering for the columns that map cleanly to columns.
  if (sort !== 'employee') {
    q = q.order(sort, { ascending });
  }
  q = q.order('submission_date', { ascending: false }); // secondary key

  const [{ data: rows, error }, projectsRes, overdueRes] = await Promise.all([
    q,
    projectsPromise,
    overduePromise,
  ]);
  if (error) throw new Error(error.message);
  const overdueRows = overdueRes.data ?? [];

  const userIds = Array.from(new Set([
    ...(rows ?? []).map((r) => r.user_id as string),
    ...overdueRows.map((o) => o.user_id as string),
  ]));
  const usersRes = userIds.length
    ? await sb.from('users').select('id, full_name, employee_code').in('id', userIds)
    : { data: [] as Array<{ id: string; full_name: string; employee_code: string }> };
  const userMap = new Map((usersRes.data ?? []).map((u) => [u.id, u]));

  let filtered = (rows ?? []).filter((r) => {
    if (!employee) return true;
    const u = userMap.get(r.user_id);
    const needle = employee.toLowerCase();
    return (
      u?.full_name?.toLowerCase().includes(needle) ||
      u?.employee_code?.toLowerCase().includes(needle) ||
      r.invoice_no.toLowerCase().includes(needle)
    );
  });

  if (sort === 'employee') {
    filtered = [...filtered].sort((a, b) => {
      const na = userMap.get(a.user_id)?.full_name ?? '';
      const nb = userMap.get(b.user_id)?.full_name ?? '';
      const cmp = na.localeCompare(nb);
      return ascending ? cmp : -cmp;
    });
  }

  const statuses = ['all', 'draft', 'submitted', 'approved', 'declined', 'paid'];
  const projects = projectsRes.data ?? [];

  const sortHref = (key: SortKey): string => {
    const nextDir = sort === key && dir === 'desc' ? 'asc' : 'desc';
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (employee) p.set('employee', employee);
    if (projectId) p.set('project', projectId);
    p.set('sort', key);
    p.set('dir', nextDir);
    return `?${p.toString()}`;
  };
  const sortHrefs = Object.fromEntries(SORT_KEYS.map((k) => [k, sortHref(k)])) as Record<SortKey, string>;

  function renderEmpty() {
    return (
      <main className="w-full px-3 md:px-4 py-5 md:py-6 space-y-4">
        <EmptyState icon={Receipt} title="No expense reports match" description="Try clearing the filters." />
      </main>
    );
  }

  const overdueTotal = overdueRows.reduce((s, r) => s + Number(r.total_owing ?? 0), 0);

  return (
    <main className="w-full px-3 md:px-4 py-5 md:py-6 space-y-4">
      <div className="flex items-center justify-end">
        <Link
          href="/admin/expenses/payouts"
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
        >
          Payout log →
        </Link>
      </div>

      {overdueRows.length > 0 ? (
        <section className="rounded-[var(--radius-lg)] border border-[color-mix(in_oklab,var(--color-destructive)_30%,transparent)] bg-[color-mix(in_oklab,var(--color-destructive)_5%,var(--color-surface))] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--color-status-declined-fg)]" />
              <span className="text-sm font-medium">Overdue payouts</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {overdueRows.length} report{overdueRows.length === 1 ? '' : 's'} · total owing {money(overdueTotal)}
              </span>
            </div>
          </div>
          <ul className="mt-2 divide-y divide-[var(--color-border-soft)]">
            {overdueRows.map((o) => {
              const u = userMap.get(o.user_id);
              return (
                <li key={o.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link href={`/admin/expenses/${o.id}`} className="font-medium hover:underline">
                      {o.invoice_no}
                    </Link>
                    <span className="text-[var(--color-text-muted)] truncate">{u?.full_name ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs whitespace-nowrap">
                    <span className="text-[var(--color-status-declined-fg)] font-medium">{o.days_overdue}d overdue</span>
                    <span className="font-mono tabular-nums">{money(Number(o.total_owing))}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <form className="flex flex-wrap gap-2 items-end">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] block">Status</span>
          <select
            name="status"
            defaultValue={status ?? 'all'}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] block">Project</span>
          <select
            name="project"
            defaultValue={projectId ?? 'all'}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] block">Employee / invoice</span>
          <input
            type="text"
            name="employee"
            defaultValue={employee}
            placeholder="Search name, code, or invoice #"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm min-w-[240px]"
          />
        </label>
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <button
          type="submit"
          className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white"
        >
          Apply
        </button>
      </form>

      {filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="No expense reports match" description="Try clearing the filters." />
      ) : (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <AdminExpensesTableBody
              rows={filtered as Parameters<typeof AdminExpensesTableBody>[0]['rows']}
              users={(usersRes.data ?? []) as Parameters<typeof AdminExpensesTableBody>[0]['users']}
              sort={sort}
              dir={dir}
              sortHrefs={sortHrefs}
            />
          </div>
        </section>
      )}
    </main>
  );
}
