import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { Receipt } from 'lucide-react';
import { AdminExpensesTableBody } from '@/components/admin/AdminExpensesTableBody';

type SortKey = 'submission_date' | 'invoice_no' | 'total_cad' | 'status' | 'employee';
const SORT_KEYS: readonly SortKey[] = ['submission_date', 'invoice_no', 'total_cad', 'status', 'employee'];

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

  const [{ data: rows, error }, projectsRes] = await Promise.all([q, projectsPromise]);
  if (error) throw new Error(error.message);

  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
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
