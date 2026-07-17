import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { csvResponse } from '@/lib/admin/reports/csv';

export const runtime = 'nodejs';
export const maxDuration = 60;

const COLUMNS = [
  'line_date',
  'employee_code',
  'employee_name',
  'invoice_no',
  'report_status',
  'category',
  'project_number',
  'description',
  'amount_cad',
  'gst_cad',
  'total_cad',
] as const;

interface JoinedLine {
  id: string;
  line_date: string;
  category: string;
  description: string;
  amount_cad: number | string;
  gst_cad: number | string;
  project_id: string | null;
  expense_reports:
    | { user_id: string; invoice_no: string; status: string }
    | { user_id: string; invoice_no: string; status: string }[];
}

export async function GET(req: Request) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const employee = searchParams.get('employee');
  const project = searchParams.get('project');
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let q = sb
    .from('expense_line_items')
    .select(
      'id, line_date, category, description, amount_cad, gst_cad, project_id, expense_reports!inner(user_id, invoice_no, status)',
    )
    .eq('is_personal', false)
    .order('line_date', { ascending: false })
    .limit(10000);
  if (project && project !== 'all') q = q.eq('project_id', project);
  if (category && category !== 'all') q = q.eq('category', category);
  if (employee && employee !== 'all') q = q.eq('expense_reports.user_id', employee);
  if (status && status !== 'all') q = q.eq('expense_reports.status', status);
  if (from) q = q.gte('line_date', from);
  if (to) q = q.lte('line_date', to);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lines = (rows ?? []) as unknown as JoinedLine[];
  const userIds = Array.from(new Set(lines.map((l) => {
    const r = Array.isArray(l.expense_reports) ? l.expense_reports[0] : l.expense_reports;
    return r.user_id;
  })));
  const projectIds = Array.from(new Set(lines.map((l) => l.project_id).filter((x): x is string => !!x)));

  const [usersRes, projectsRes] = await Promise.all([
    userIds.length
      ? sb.from('users').select('id, full_name, employee_code').in('id', userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; employee_code: string }> }),
    projectIds.length
      ? sb.from('projects').select('id, project_number').in('id', projectIds)
      : Promise.resolve({ data: [] as Array<{ id: string; project_number: number }> }),
  ]);
  const userMap = new Map((usersRes.data ?? []).map((u) => [u.id, u]));
  const projectMap = new Map((projectsRes.data ?? []).map((p) => [p.id, p]));

  const csvRows = lines.map((l) => {
    const r = Array.isArray(l.expense_reports) ? l.expense_reports[0] : l.expense_reports;
    const u = userMap.get(r.user_id);
    const p = l.project_id ? projectMap.get(l.project_id) : null;
    const amt = Number(l.amount_cad);
    const gst = Number(l.gst_cad);
    return {
      line_date: l.line_date,
      employee_code: u?.employee_code ?? '',
      employee_name: u?.full_name ?? '',
      invoice_no: r.invoice_no,
      report_status: r.status,
      category: l.category,
      project_number: p?.project_number ?? '',
      description: l.description,
      amount_cad: amt.toFixed(2),
      gst_cad: gst.toFixed(2),
      total_cad: (amt + gst).toFixed(2),
    };
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`expense-lines-${stamp}.csv`, csvRows, { columns: COLUMNS as unknown as string[] });
}
