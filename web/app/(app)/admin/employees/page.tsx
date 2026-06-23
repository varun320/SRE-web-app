import { getSupabaseServer } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmployeeTable } from '@/components/admin/EmployeeTable';

export default async function EmployeesPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('users').select('id, full_name, email, employee_code, department, is_active').order('full_name');
  return (
    <div className="px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Employees</h2>
        <Link href="/admin/employees/new"><Button>Add employee</Button></Link>
      </div>
      <EmployeeTable rows={(data ?? []) as ({ id: string; full_name: string; email: string; employee_code: string; department: string | null; is_active: boolean })[]} />
    </div>
  );
}
