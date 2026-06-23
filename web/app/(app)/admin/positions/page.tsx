import { getSupabaseServer } from '@/lib/supabase/server';
import { PositionsTable } from '@/components/admin/PositionsTable';

export default async function PositionsPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('positions').select('id, name, annual_vacation_hours').order('name');
  return (
    <div className="px-6 py-6 space-y-4">
      <h2 className="text-lg font-semibold">Positions</h2>
      <p className="text-sm text-[var(--color-text-muted)]">
        Changes here set the default annual vacation hours per position. New employees inherit the value at creation time via the opening-balance field — editing here does NOT retroactively change any current employee&apos;s balance.
      </p>
      <PositionsTable rows={(data ?? []) as ({ id: string; name: string; annual_vacation_hours: number })[]} />
    </div>
  );
}
