import { getSupabaseServer } from '@/lib/supabase/server';
import { PositionsTable } from '@/components/admin/PositionsTable';
import { PositionForm } from '@/components/admin/PositionForm';
import { PageHeader } from '@/components/ui/page-header';

export default async function PositionsPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('positions').select('id, name, annual_vacation_hours').order('name');
  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-5">
      <PageHeader
        title="Positions"
        description="Default annual vacation hours per role. New employees inherit at creation; edits here don't retroactively change existing balances."
        tip={
          <>
            <p className="mb-1">Positions drive the <strong>vacation bank</strong> assigned to a new hire.</p>
            <p className="mb-1">Editing hours here only affects <em>future</em> employees; existing balances live in the vacation ledger and stay put.</p>
            <p>To rewrite an existing employee&apos;s opening balance, open their detail page instead.</p>
          </>
        }
      />
      <PositionForm />
      <PositionsTable rows={(data ?? []) as ({ id: string; name: string; annual_vacation_hours: number })[]} />
    </div>
  );
}
