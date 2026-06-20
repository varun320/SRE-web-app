import { getSupabaseServer } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmployeeTable } from '@/components/admin/EmployeeTable';

export default async function EmployeesPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('users').select('id, full_name, email, employee_code, department, is_active').order('full_name');
  return (
    <div className="px-4 md:px-6 py-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Employees</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Active staff and inactive records. Click a name to manage roles, balances, and timesheet history.</p>
        </div>
        <Link href="/admin/employees/new"><Button>Add employee</Button></Link>
      </div>
      <EmployeeTable rows={(data ?? []) as ({ id: string; full_name: string; email: string; employee_code: string; department: string | null; is_active: boolean })[]} />
    </div>
  );
}
