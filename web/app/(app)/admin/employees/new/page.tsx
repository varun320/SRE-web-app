import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { EmployeeForm } from '@/components/admin/EmployeeForm';

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
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Add employee</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)] max-w-2xl">
          Creates the auth user, employee profile, opening balances, and role assignment in one step.
        </p>
      </div>
      <EmployeeForm positions={positions ?? []} />
    </div>
  );
}
