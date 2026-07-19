import { getSupabaseServer } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmployeeTable } from '@/components/admin/EmployeeTable';
import { PageHeader } from '@/components/ui/page-header';

export default async function EmployeesPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb
    .from('users')
    .select('id, full_name, email, employee_code, department, is_active')
    .order('full_name');
  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-4">
      <PageHeader
        title="Employees"
        description="Click a name to edit contact details, position, opening balances, or reset the sign-in password."
        tip={
          <>
            <p className="mb-1"><strong>Add</strong> creates the auth user + profile + role in one step.</p>
            <p className="mb-1"><strong>Deactivate</strong> (from the detail page) blocks sign-in without deleting history.</p>
            <p>Employee code shows on timesheets and payouts — keep it short and stable.</p>
          </>
        }
        action={<Link href="/admin/employees/new"><Button>Add employee</Button></Link>}
      />
      <EmployeeTable rows={(data ?? []) as ({ id: string; full_name: string; email: string; employee_code: string; department: string | null; is_active: boolean })[]} />
    </div>
  );
}
