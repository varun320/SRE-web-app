import { getSupabaseServer } from '@/lib/supabase/server';
import { aggregateByCategory, fetchCategoryHours } from '@/lib/admin/reports/categories';
import { DateRangePicker } from '@/components/admin/reports/DateRangePicker';
import { CategoriesBreakdown } from '@/components/admin/reports/CategoriesBreakdown';

interface SearchParams {
  from?: string;
  to?: string;
}

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const monday = (() => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const dow = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    return d;
  })();
  const from = new Date(monday);
  from.setUTCDate(monday.getUTCDate() - 84); // ~12 weeks back
  const to = new Date(monday);
  to.setUTCDate(monday.getUTCDate() + 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default async function CategoriesReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const fallback = defaultRange();
  const from = sp.from ?? fallback.from;
  const to = sp.to ?? fallback.to;

  const sb = await getSupabaseServer();
  const hoursRows = await fetchCategoryHours(sb, { from, to });
  const breakdown = aggregateByCategory(hoursRows);

  const params = new URLSearchParams({ from, to });
  const downloadHref = `/api/admin/reports/categories?${params.toString()}`;

  return (
    <div className="space-y-3">
      <DateRangePicker defaultFrom={from} defaultTo={to} />
      <CategoriesBreakdown rows={breakdown} downloadHref={downloadHref} />
    </div>
  );
}
