import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { fetchCurrentBalances } from '@/lib/admin/reports/balances';
import { csvResponse } from '@/lib/admin/reports/csv';

export const runtime = 'nodejs';

const COLUMNS = [
  'employee_code',
  'full_name',
  'position',
  'department',
  'til_closing',
  'til_week',
  'vacation_closing',
  'vacation_week',
];

export async function GET() {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const rows = await fetchCurrentBalances(sb);
  const csvRows = rows.map((r) => ({
    employee_code: r.employee_code,
    full_name: r.full_name,
    position: r.position ?? '',
    department: r.department ?? '',
    til_closing: r.til_closing.toFixed(2),
    til_week: r.til_week ?? '',
    vacation_closing: r.vacation_closing.toFixed(2),
    vacation_week: r.vacation_week ?? '',
  }));

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(`balances-${today}.csv`, csvRows, { columns: COLUMNS });
}
