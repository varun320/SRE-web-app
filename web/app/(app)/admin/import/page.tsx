import { getSupabaseServer } from '@/lib/supabase/server';
import { ImportClient } from './ImportClient';

export default async function AdminImportPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb
    .from('users')
    .select('id, employee_code, full_name')
    .eq('is_active', true)
    .order('employee_code');

  return (
    <div className="px-4 md:px-6 py-6 space-y-4">
      <header>
        <h2 className="text-lg font-medium tracking-tight">Historical import</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Bring legacy balances and weekly timesheets into the system. Dry-run first; conflicts
          block commit.
        </p>
      </header>
      <ImportClient employees={data ?? []} />
    </div>
  );
}
