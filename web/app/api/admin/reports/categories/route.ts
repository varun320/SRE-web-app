import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { aggregateByCategory, fetchCategoryHours } from '@/lib/admin/reports/categories';
import { csvResponse } from '@/lib/admin/reports/csv';

export const runtime = 'nodejs';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const COLUMNS = ['main_category', 'sub_category', 'hrs', 'main_total_hrs'];

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

  const rows = await fetchCategoryHours(sb, { from, to });
  const breakdown = aggregateByCategory(rows);

  const csvRows = breakdown.flatMap((m) =>
    m.by_sub.map((s) => ({
      main_category: m.main_category,
      sub_category: s.sub_category,
      hrs: s.hrs.toFixed(2),
      main_total_hrs: m.total_hrs.toFixed(2),
    })),
  );

  return csvResponse(`categories-${from}-${to}.csv`, csvRows, { columns: COLUMNS });
}
