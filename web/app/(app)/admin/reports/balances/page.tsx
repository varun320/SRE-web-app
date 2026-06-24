import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchCurrentBalances } from '@/lib/admin/reports/balances';
import { BalancesTable } from '@/components/admin/reports/BalancesTable';

export default async function BalancesReportPage() {
  const sb = await getSupabaseServer();
  const rows = await fetchCurrentBalances(sb);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium tracking-tight">Balances snapshot</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Current TIL and vacation balances per active employee. Pulled from the latest live ledger row.
        </p>
      </div>
      <BalancesTable rows={rows} downloadHref="/api/admin/reports/balances" />
    </div>
  );
}
