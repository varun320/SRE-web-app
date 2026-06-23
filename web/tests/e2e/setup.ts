import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SERVICE_ROLE) {
  throw new Error('Set SUPABASE_SERVICE_ROLE_KEY (from `supabase status`) before running e2e');
}

export async function provisionEmployee(email: string, password: string, employeeCode: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: existing } = await admin.auth.admin.listUsers();
  const existingUser = existing?.users.find((u) => u.email === email);
  if (existingUser) await admin.auth.admin.deleteUser(existingUser.id);

  const {
    data: { user },
    error,
  } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !user) throw new Error(error?.message ?? 'createUser failed');

  const { data: pos, error: posErr } = await admin
    .from('positions')
    .select('id')
    .eq('name', 'Senior Engineer')
    .single();
  if (posErr || !pos) throw new Error(posErr?.message ?? 'Senior Engineer position not found');

  const { error: insErr } = await admin.from('users').insert({
    id: user.id,
    org_id: '00000000-0000-0000-0000-000000000001',
    full_name: 'E2E User',
    email,
    employee_code: employeeCode,
    position_id: pos.id,
  });
  if (insErr) throw new Error(insErr.message);

  const { error: roleErr } = await admin.from('user_roles').insert({ user_id: user.id, role: 'employee' });
  if (roleErr) throw new Error(roleErr.message);

  return user.id;
}
