import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchPeriodSummary } from '@/lib/admin/reports/period';
import { aggregatePayroll } from '@/lib/admin/reports/payroll';
import { DateRangePicker } from '@/components/admin/reports/DateRangePicker';
import { EmployeePicker } from '@/components/admin/reports/EmployeePicker';
import { PayrollPreview } from '@/components/admin/reports/PayrollPreview';
import { PageHeader } from '@/components/ui/page-header';

const DEFAULT_EPOCH = '2026-01-05'; // Monday — TODO: read from organizations.payroll_epoch

interface SearchParams {
  from?: string;
  to?: string;
  user_id?: string;
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
  const userId = sp.user_id;

  const sb = await getSupabaseServer();
  const { data: employees } = await sb
    .from('users')
    .select('id, employee_code, full_name')
    .eq('is_active', true)
    .order('full_name');

  const rows = await fetchPeriodSummary(sb, { from, to, userId });
  const payroll = aggregatePayroll(rows, { epoch: new Date(`${DEFAULT_EPOCH}T00:00:00Z`) });

  const downloadParams = new URLSearchParams({ from, to });
  if (userId) downloadParams.set('user_id', userId);
  const downloadHref = `/api/admin/reports/payroll?${downloadParams.toString()}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payroll report"
        description="Aggregated hours, TIL, and vacation per employee across a date range. Download the CSV to hand to payroll."
        tip={
          <>
            <p className="mb-1">Rows only include <strong>approved</strong> weeks — draft or submitted sheets don&apos;t count.</p>
            <p>Filter by employee to spot-check one person; leave blank for the full team.</p>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker defaultFrom={from} defaultTo={to} />
        <EmployeePicker employees={employees ?? []} selected={userId} />
      </div>
      <PayrollPreview rows={payroll} downloadHref={downloadHref} />
    </div>
  );
}
