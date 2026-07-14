import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchPeriodSummary } from '@/lib/admin/reports/period';
import { aggregatePayroll } from '@/lib/admin/reports/payroll';
import { DateRangePicker } from '@/components/admin/reports/DateRangePicker';
import { PayrollPreview } from '@/components/admin/reports/PayrollPreview';

const DEFAULT_EPOCH = '2026-01-05'; // Monday — TODO: read from organizations.payroll_epoch

interface SearchParams {
  from?: string;
  to?: string;
}

function defaultRange(): { from: string; to: string } {
  // Last 4 weeks ending today.
  const today = new Date();
  const monday = (() => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const dow = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    return d;
  })();
  const from = new Date(monday);
  from.setUTCDate(monday.getUTCDate() - 21);
  const to = new Date(monday);
  to.setUTCDate(monday.getUTCDate() + 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default async function PayrollReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const fallback = defaultRange();
  const from = sp.from ?? fallback.from;
  const to = sp.to ?? fallback.to;

  const sb = await getSupabaseServer();
  const rows = await fetchPeriodSummary(sb, { from, to });
  const payroll = aggregatePayroll(rows, { epoch: new Date(`${DEFAULT_EPOCH}T00:00:00Z`) });

  const downloadHref = `/api/admin/reports/payroll?${new URLSearchParams({ from, to }).toString()}`;

  return (
    <div className="space-y-3">
      <DateRangePicker defaultFrom={from} defaultTo={to} />
      <PayrollPreview rows={payroll} downloadHref={downloadHref} />
    </div>
  );
}
