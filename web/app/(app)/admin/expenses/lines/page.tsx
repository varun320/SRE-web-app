import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { Receipt, Download, ArrowDown, ArrowUp } from 'lucide-react';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/expenses/types';

function money(n: number): string {
  return Number(n).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

type SortKey = 'line_date' | 'employee' | 'invoice_no' | 'category' | 'amount';
const SORT_KEYS: readonly SortKey[] = ['line_date', 'employee', 'invoice_no', 'category', 'amount'];
function isSortKey(v: string | undefined): v is SortKey {
  return !!v && (SORT_KEYS as readonly string[]).includes(v);
}

interface JoinedLine {
  id: string;
  expense_id: string;
  line_date: string;
  category: string;
  description: string;
  amount_cad: number;
  gst_cad: number;
  project_id: string | null;
  expense_reports: {
    user_id: string;
    invoice_no: string;
    status: string;
  } | { user_id: string; invoice_no: string; status: string }[];
}

interface SearchParams {
  employee?: string;
  project?: string;
  category?: string;
  status?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
}

export default async function AdminExpenseLinesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const employee = sp.employee && sp.employee !== 'all' ? sp.employee : undefined;
  const project = sp.project && sp.project !== 'all' ? sp.project : undefined;
  const category = sp.category && sp.category !== 'all' ? sp.category : undefined;
  const status = sp.status && sp.status !== 'all' ? sp.status : undefined;
  const from = sp.from;
  const to = sp.to;
  const sort: SortKey = isSortKey(sp.sort) ? sp.sort : 'line_date';
  const dir: 'asc' | 'desc' = sp.dir === 'asc' ? 'asc' : 'desc';
  const ascending = dir === 'asc';

  const sb = await getSupabaseServer();

  // Line items joined with report metadata for filtering / display.
  // Personal lines are excluded from admin view (matches detail page).
  let q = sb
    .from('expense_line_items')
    .select(
'id, expense_id, line_date, category, description, amount_cad, gst_cad, project_id, expense_reports!inner(user_id, invoice_no, status)',
    )
    .eq('is_personal', false)
    .limit(1000);
  if (project) q = q.eq('project_id', project);
  if (category) q = q.eq('category', category);
  if (employee) q = q.eq('expense_reports.user_id', employee);
  if (status) q = q.eq('expense_reports.status', status);
  if (from) q = q.gte('line_date', from);
  if (to) q = q.lte('line_date', to);

  // DB sort where cheap; employee/invoice/category via post-fetch since they
  // come off the joined table.
  if (sort === 'line_date') q = q.order('line_date', { ascending });
  else if (sort === 'amount') q = q.order('amount_cad', { ascending });
  else q = q.order('line_date', { ascending: false });

  const [{ data: rows, error }, employeesRes, projectsRes] = await Promise.all([
    q,
    sb.from('users').select('id, full_name, employee_code').eq('is_active', true).order('full_name'),
    sb.from('projects').select('id, project_number, name').order('project_number', { ascending: false }),
  ]);
  if (error) throw new Error(error.message);

  const lines = (rows ?? []) as unknown as JoinedLine[];
  const userMap = new Map((employeesRes.data ?? []).map((u) => [u.id, u]));
  const projectMap = new Map((projectsRes.data ?? []).map((p) => [p.id, p]));

  // Client-side sort for employee/invoice/category since they live on the join.
  const enriched = lines.map((l) => {
    const report = Array.isArray(l.expense_reports) ? l.expense_reports[0] : l.expense_reports;
    const u = userMap.get(report.user_id);
    return {
      id: l.id,
      expense_id: l.expense_id,
      line_date: l.line_date,
      category: l.category,
      description: l.description,
      amount_cad: Number(l.amount_cad),
      gst_cad: Number(l.gst_cad),
      total_cad: Number(l.amount_cad) + Number(l.gst_cad),
      project_id: l.project_id,
      project_number: l.project_id ? projectMap.get(l.project_id)?.project_number : null,
      user_id: report.user_id,
      employee_name: u?.full_name ?? '—',
      employee_code: u?.employee_code ?? '',
      invoice_no: report.invoice_no,
      status: report.status,
    };
  });
  const sorted = [...enriched].sort((a, b) => {
    const mul = ascending ? 1 : -1;
    if (sort === 'employee') return a.employee_name.localeCompare(b.employee_name) * mul;
    if (sort === 'invoice_no') return a.invoice_no.localeCompare(b.invoice_no) * mul;
    if (sort === 'category') return a.category.localeCompare(b.category) * mul;
    return 0;
  });
  const list = sort === 'employee' || sort === 'invoice_no' || sort === 'category' ? sorted : enriched;

  const totals = list.reduce(
    (acc, r) => {
      acc.amount += r.amount_cad;
      acc.gst += r.gst_cad;
      acc.total += r.total_cad;
      return acc;
    },
    { amount: 0, gst: 0, total: 0 },
  );

  const sortHref = (k: SortKey): string => {
    const nextDir = sort === k && dir === 'desc' ? 'asc' : 'desc';
    const p = new URLSearchParams();
    if (employee) p.set('employee', employee);
    if (project) p.set('project', project);
    if (category) p.set('category', category);
    if (status) p.set('status', status);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    p.set('sort', k);
    p.set('dir', nextDir);
    return `?${p.toString()}`;
  };
  const arrow = (k: SortKey) =>
    sort === k ? (dir === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />) : null;

  const csvParams = new URLSearchParams();
  if (employee) csvParams.set('employee', employee);
  if (project) csvParams.set('project', project);
  if (category) csvParams.set('category', category);
  if (status) csvParams.set('status', status);
  if (from) csvParams.set('from', from);
  if (to) csvParams.set('to', to);
  const csvHref = `/api/admin/reports/expense-lines${csvParams.toString() ? `?${csvParams}` : ''}`;

  return (
    <main className="w-full px-3 md:px-4 py-5 md:py-6 space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">Expense lines</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Every line item across all employees. Stack filters — employee, project, category — to drill down.
          </p>
        </div>
        <a
          href={csvHref}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm hover:bg-[var(--color-surface-2)]"
        >
          <Download className="h-4 w-4" /> Download CSV
        </a>
      </header>

      <form className="flex flex-wrap gap-2 items-end rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-3">
        <Field label="Employee">
          <select name="employee" defaultValue={employee ?? 'all'} className={selectCls}>
            <option value="all">All</option>
            {(employeesRes.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.employee_code} — {u.full_name}</option>
            ))}
          </select>
        </Field>
        <Field label="Project">
          <select name="project" defaultValue={project ?? 'all'} className={selectCls}>
            <option value="all">All</option>
            {(projectsRes.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select name="category" defaultValue={category ?? 'all'} className={selectCls}>
            <option value="all">All</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Report status">
          <select name="status" defaultValue={status ?? 'all'} className={selectCls}>
            <option value="all">All</option>
            <option value="draft">draft</option>
            <option value="submitted">submitted</option>
            <option value="approved">approved</option>
            <option value="declined">declined</option>
            <option value="paid">paid</option>
          </select>
        </Field>
        <Field label="From">
          <input type="date" name="from" defaultValue={from ?? ''} className={selectCls} />
        </Field>
        <Field label="To">
          <input type="date" name="to" defaultValue={to ?? ''} className={selectCls} />
        </Field>
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <button type="submit" className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white">
          Apply
        </button>
        <Link
          href="/admin/expenses/lines"
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Reset
        </Link>
      </form>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span><strong>{list.length}</strong> line{list.length === 1 ? '' : 's'}</span>
        <span>Amount <span className="font-mono tabular-nums">{money(totals.amount)}</span></span>
        <span>GST <span className="font-mono tabular-nums">{money(totals.gst)}</span></span>
        <span className="font-medium">Total <span className="font-mono tabular-nums">{money(totals.total)}</span></span>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Receipt} title="No lines match" description="Widen or clear the filters." />
      ) : (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
                <tr>
                  <th className="text-left px-3 py-2 font-normal">
                    <Link href={sortHref('line_date')} className="hover:text-[var(--color-text)] inline-flex items-center gap-1">Date {arrow('line_date')}</Link>
                  </th>
                  <th className="text-left px-3 py-2 font-normal">
                    <Link href={sortHref('employee')} className="hover:text-[var(--color-text)] inline-flex items-center gap-1">Employee {arrow('employee')}</Link>
                  </th>
                  <th className="text-left px-3 py-2 font-normal">
                    <Link href={sortHref('invoice_no')} className="hover:text-[var(--color-text)] inline-flex items-center gap-1">Invoice # {arrow('invoice_no')}</Link>
                  </th>
                  <th className="text-left px-3 py-2 font-normal">
                    <Link href={sortHref('category')} className="hover:text-[var(--color-text)] inline-flex items-center gap-1">Category {arrow('category')}</Link>
                  </th>
                  <th className="text-left px-3 py-2 font-normal">Project</th>
                  <th className="text-left px-3 py-2 font-normal">Description</th>
                  <th className="text-right px-3 py-2 font-normal">
                    <Link href={sortHref('amount')} className="hover:text-[var(--color-text)] inline-flex items-center gap-1 justify-end">Amount {arrow('amount')}</Link>
                  </th>
                  <th className="text-right px-3 py-2 font-normal">GST</th>
                  <th className="text-right px-3 py-2 font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--color-border-soft)]">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{r.line_date}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.employee_name}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{r.employee_code}</div>
                    </td>
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/admin/expenses/${r.expense_id}`} className="hover:underline">
                        {r.invoice_no}
                      </Link>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.category}</td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {r.project_number ?? <span className="text-[var(--color-text-muted)]">—</span>}
                    </td>
                    <td className="px-3 py-2">{r.description}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{money(r.amount_cad)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{money(r.gst_cad)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">{money(r.total_cad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

const selectCls =
  'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] block">{label}</span>
      {children}
    </label>
  );
}
