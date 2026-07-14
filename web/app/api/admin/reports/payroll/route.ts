import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { fetchPeriodSummary } from '@/lib/admin/reports/period';
import { aggregatePayroll, type PayrollRow } from '@/lib/admin/reports/payroll';
import { csvResponse } from '@/lib/admin/reports/csv';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_EPOCH = '2026-01-05';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const COLUMNS: (keyof PayrollRow)[] = [
  'employee_code',
  'full_name',
  'period_start',
  'period_end',
  'regular_hrs',
  'overtime_hrs',
  'til_payout_hrs',
  'til_earned_delta',
  'til_used_delta',
  'til_closing',
  'vacation_used_delta',
  'vacation_closing',
];

export async function GET(req: Request) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !ISO_DATE.test(from) || !to || !ISO_DATE.test(to)) {
    return NextResponse.json({ error: 'from and to must be YYYY-MM-DD' }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: 'from must be ≤ to' }, { status: 400 });
  }

  const rows = await fetchPeriodSummary(sb, { from, to });
  const payroll = aggregatePayroll(rows, { epoch: new Date(`${DEFAULT_EPOCH}T00:00:00Z`) });

  const csvRows = payroll.map((r) =>
    Object.fromEntries(
      COLUMNS.map((c) => {
        const v = r[c];
        return [c, typeof v === 'number' ? v.toFixed(2) : v];
      }),
    ),
  );

  return csvResponse(`payroll-${from}-${to}.csv`, csvRows, { columns: COLUMNS as string[] });
}
