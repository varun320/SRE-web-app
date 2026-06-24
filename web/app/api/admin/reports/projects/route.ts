import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { aggregateByProject, fetchProjectHours } from '@/lib/admin/reports/projects';
import { csvResponse } from '@/lib/admin/reports/csv';

export const runtime = 'nodejs';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const COLUMNS = [
  'project_number',
  'project_name',
  'employee_code',
  'full_name',
  'hrs',
  'project_total_hrs',
];

export async function GET(req: Request) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const projectId = searchParams.get('project_id') ?? undefined;
  if (!from || !ISO_DATE.test(from) || !to || !ISO_DATE.test(to)) {
    return NextResponse.json({ error: 'from and to must be YYYY-MM-DD' }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: 'from must be ≤ to' }, { status: 400 });
  }

  const rows = await fetchProjectHours(sb, { from, to, projectId });
  const breakdown = aggregateByProject(rows);

  // Flatten to one row per (project × employee), repeating project totals for grouping in Excel.
  const csvRows = breakdown.flatMap((p) =>
    p.by_employee.map((e) => ({
      project_number: p.project_number,
      project_name: p.project_name,
      employee_code: e.employee_code,
      full_name: e.full_name,
      hrs: e.hrs.toFixed(2),
      project_total_hrs: p.total_hrs.toFixed(2),
    })),
  );

  return csvResponse(`projects-${from}-${to}.csv`, csvRows, { columns: COLUMNS });
}
