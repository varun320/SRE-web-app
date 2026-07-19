import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { EmployeeForm } from '@/components/admin/EmployeeForm';
import { PageHeader } from '@/components/ui/page-header';

export default async function NewEmployeePage() {
  const sb = await getSupabaseServer();
  const { data: positions } = await sb.from('positions').select('id, name, annual_vacation_hours').order('name');
  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-5">
      <div>
        <Link
          href="/admin/employees"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <ChevronLeftIcon className="size-3.5" />
          All employees
        </Link>
        <div className="mt-2">
          <PageHeader
            title="Add employee"
            description="Creates the auth user, employee profile, opening balances, and role assignment in one step."
            tip={
              <>
                <p className="mb-1"><strong>Email</strong> is the sign-in username. If you leave <em>password</em> blank, the user can sign in via magic link.</p>
                <p className="mb-1"><strong>Position</strong> sets the default vacation bank in hours.</p>
                <p><strong>Opening balances</strong> seed the TIL / vacation ledger — enter 0 for new hires, or the carry-over balance for a mid-year switch.</p>
              </>
            }
          />
        </div>
      </div>
      <EmployeeForm positions={positions ?? []} />
    </div>
  );
}
