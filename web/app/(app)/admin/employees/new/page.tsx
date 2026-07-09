import { getSupabaseServer } from '@/lib/supabase/server';
import { EmployeeForm } from '@/components/admin/EmployeeForm';

export default async function NewEmployeePage() {
  const sb = await getSupabaseServer();
  const { data: positions } = await sb.from('positions').select('id, name, annual_vacation_hours').order('name');
  return (
    <div className="px-3 md:px-4 py-5 space-y-4">
      <h2 className="text-lg font-semibold">Add employee</h2>
      <EmployeeForm positions={positions ?? []} />
    </div>
  );
}
