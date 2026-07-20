'use server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { revalidatePath } from 'next/cache';
import { friendlyError } from '@/lib/errors';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(url, key);
}

export async function updateEmployee(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { error: 'missing id' };

  const fullName = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const employeeCode = String(formData.get('employee_code') ?? '').trim();
  const department = String(formData.get('department') ?? '').trim() || null;
  const positionId = String(formData.get('position_id') ?? '').trim() || null;
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';
  const role = (formData.get('role') as string) || 'employee';

  if (!fullName || !email || !employeeCode) return { error: 'name, email, and code are required' };

  const admin = getServiceClient();
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY not configured on the server' };

  const { data: existing, error: readErr } = await admin
    .from('users')
    .select('email')
    .eq('id', id)
    .maybeSingle();
  if (readErr) return { error: friendlyError(readErr) };

  const { error: updErr } = await admin.from('users').update({
    full_name: fullName,
    email,
    employee_code: employeeCode,
    department,
    position_id: positionId,
    is_active: isActive,
  }).eq('id', id);
  if (updErr) return { error: friendlyError(updErr) };

  if (existing?.email && existing.email.toLowerCase() !== email.toLowerCase()) {
    const { error: authErr } = await admin.auth.admin.updateUserById(id, { email });
    if (authErr) return { error: `Profile saved, but the sign-in email couldn't be updated: ${friendlyError(authErr)}` };
  }

  const { error: roleWipeErr } = await admin.from('user_roles').delete().eq('user_id', id);
  if (roleWipeErr) return { error: friendlyError(roleWipeErr) };
  const rolesToInsert = role === 'admin'
    ? [{ user_id: id, role: 'admin' }, { user_id: id, role: 'employee' }]
    : [{ user_id: id, role: 'employee' }];
  const { error: roleErr } = await admin.from('user_roles').insert(rolesToInsert);
  if (roleErr) return { error: friendlyError(roleErr) };

  revalidatePath(`/admin/employees/${id}`);
  revalidatePath('/admin/employees');
  return { ok: true };
}

export async function updateOpeningBalances(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { error: 'missing id' };
  const openingTil = Number(formData.get('opening_til') ?? 0);
  const openingVacation = Number(formData.get('opening_vacation') ?? 0);
  if (!Number.isFinite(openingTil) || openingTil < 0) return { error: 'opening TIL must be ≥ 0' };
  if (!Number.isFinite(openingVacation) || openingVacation < 0) return { error: 'opening vacation must be ≥ 0' };

  const admin = getServiceClient();
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY not configured on the server' };

  const { data: tilSeed } = await admin
    .from('til_ledger')
    .select('id, week_start')
    .eq('user_id', id)
    .eq('frozen', true)
    .order('week_start', { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: vacSeed } = await admin
    .from('vacation_ledger')
    .select('id, week_start')
    .eq('user_id', id)
    .eq('frozen', true)
    .order('week_start', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!tilSeed || !vacSeed) return { error: 'no seed ledger rows found — recreate the employee' };

  const { error: tilErr } = await admin.from('til_ledger').update({ opening_balance: openingTil }).eq('id', tilSeed.id);
  if (tilErr) return { error: friendlyError(tilErr) };
  const { error: vacErr } = await admin.from('vacation_ledger').update({ opening_balance: openingVacation }).eq('id', vacSeed.id);
  if (vacErr) return { error: friendlyError(vacErr) };

  // ponytail: mark downstream rows stale so the existing cascade recomputes carry-forward on next touch
  await admin.from('til_ledger').update({ stale: true }).eq('user_id', id).gt('week_start', tilSeed.week_start);
  await admin.from('vacation_ledger').update({ stale: true }).eq('user_id', id).gt('week_start', vacSeed.week_start);

  revalidatePath(`/admin/employees/${id}`);
  return { ok: true };
}

export async function deleteEmployee(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { error: 'missing id' };

  const { data: { user: me } } = await sb.auth.getUser();
  if (me?.id === id) return { error: "you can't delete your own account" };

  const admin = getServiceClient();
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY not configured on the server' };

  // auth.users delete cascades public.users → timesheets, expenses, ledgers, etc via FK ON DELETE CASCADE
  const { error: authErr } = await admin.auth.admin.deleteUser(id);
  if (authErr) return { error: friendlyError(authErr) };

  // Belt-and-suspenders: if the public.users row didn't cascade, drop it directly
  await admin.from('users').delete().eq('id', id);

  revalidatePath('/admin/employees');
  return { ok: true };
}

export async function resetEmployeePassword(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };

  const id = String(formData.get('id') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();
  if (!id || !password) return { error: 'id and new password required' };
  if (password.length < 8) return { error: 'password must be at least 8 characters' };

  const admin = getServiceClient();
  if (!admin) return { error: 'SUPABASE_SERVICE_ROLE_KEY not configured on the server' };

  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { error: friendlyError(error) };
  return { ok: true };
}
