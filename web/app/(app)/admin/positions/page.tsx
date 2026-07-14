import { getSupabaseServer } from '@/lib/supabase/server';
import { PositionsTable } from '@/components/admin/PositionsTable';

export default async function PositionsPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('positions').select('id, name, annual_vacation_hours').order('name');
  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-3">
      <p className="text-body-sm text-[var(--color-text-muted)] max-w-2xl">
        Default annual vacation hours per role. New employees inherit at creation; edits here don&apos;t retroactively change existing balances.
      </p>
      <PositionsTable rows={(data ?? []) as ({ id: string; name: string; annual_vacation_hours: number })[]} />
    </div>
  );
}
