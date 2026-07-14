import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchCurrentBalances } from '@/lib/admin/reports/balances';
import { BalancesTable } from '@/components/admin/reports/BalancesTable';

export default async function BalancesReportPage() {
  const sb = await getSupabaseServer();
  const rows = await fetchCurrentBalances(sb);
  return (
    <div className="space-y-3">
      <BalancesTable rows={rows} downloadHref="/api/admin/reports/balances" />
    </div>
  );
}
