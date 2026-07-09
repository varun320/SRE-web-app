import { getSupabaseServer } from '@/lib/supabase/server';
import { PositionsTable } from '@/components/admin/PositionsTable';

export default async function PositionsPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('positions').select('id, name, annual_vacation_hours').order('name');
  return (
    <div className="px-3 md:px-4 py-5 space-y-4">
      <header>
        <h2 className="text-lg font-medium tracking-tight">Positions</h2>
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Default annual vacation hours per role. New employees inherit this at creation; editing here does <strong>not</strong> retroactively change any existing balance.
        </p>
      </header>
      <PositionsTable rows={(data ?? []) as ({ id: string; name: string; annual_vacation_hours: number })[]} />
    </div>
  );
}
