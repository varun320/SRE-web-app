import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchPeriodSummary } from '@/lib/admin/reports/period';
import { DateRangePicker } from '@/components/admin/reports/DateRangePicker';
import { EmployeePicker } from '@/components/admin/reports/EmployeePicker';
import { PeriodSummary } from '@/components/admin/reports/PeriodSummary';
import { PrintButton } from '@/components/admin/reports/PrintButton';
import { EmptyState } from '@/components/ui/empty-state';
import { FileText } from 'lucide-react';

interface SearchParams {
  from?: string;
  to?: string;
  user_id?: string;
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
  from.setUTCDate(monday.getUTCDate() - 84);
  const to = new Date(monday);
  to.setUTCDate(monday.getUTCDate() + 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default async function PeriodReportPage({
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
    .select('id, employee_code, full_name, department')
    .eq('is_active', true)
    .order('full_name');

  const employee = userId ? employees?.find((e) => e.id === userId) : undefined;
  const rows = employee
    ? await fetchPeriodSummary(sb, { from, to, userId: employee.id })
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 print:hidden">
        <div>
          <h3 className="text-base font-medium tracking-tight">Per-employee period summary</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            Pick an employee + range, then <strong>Print or Save as PDF</strong>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <EmployeePicker employees={employees ?? []} selected={userId} />
          {employee ? <PrintButton /> : null}
        </div>
      </div>

      <div className="print:hidden">
        <DateRangePicker defaultFrom={from} defaultTo={to} />
      </div>

      {employee ? (
        <PeriodSummary
          employee={employee}
          from={from}
          to={to}
          rows={rows}
        />
      ) : (
        <EmptyState
          icon={FileText}
          title="Pick an employee to begin"
          description="The period summary will render here. Use the dropdown above."
        />
      )}
    </div>
  );
}
