'use server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { redirect } from 'next/navigation';
import { friendlyError } from '@/lib/errors';

export async function createEmployee(formData: FormData) {
  const sbServer = await getSupabaseServer();
  if (!(await fetchIsAdmin(sbServer))) return { error: 'admin only' };

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_ROLE) return { error: 'SUPABASE_SERVICE_ROLE_KEY not configured on the server' };

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const email = String(formData.get('email') ?? '').trim();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const employeeCode = String(formData.get('employee_code') ?? '').trim();
  const department = String(formData.get('department') ?? '').trim() || null;
  const positionId = String(formData.get('position_id') ?? '');
  const role = (formData.get('role') as string) || 'employee';
  const password = String(formData.get('password') ?? '').trim();
  const openingTil = Number(formData.get('opening_til') ?? 0);
  const openingVacation = Number(formData.get('opening_vacation') ?? 0);

  if (!email || !fullName || !employeeCode || !positionId) return { error: 'missing required fields' };

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password: password || undefined, email_confirm: true,
  });
  if (createErr || !created?.user) return { error: friendlyError(createErr, 'Could not create the sign-in user') };
  const userId = created.user.id;

  const { error: insertErr } = await admin.from('users').insert({
    id: userId,
    org_id: '00000000-0000-0000-0000-000000000001',
    full_name: fullName,
    email,
    employee_code: employeeCode,
    department,
    position_id: positionId,
  });
  if (insertErr) return { error: friendlyError(insertErr) };

  await admin.from('user_roles').insert({ user_id: userId, role });
  if (role === 'admin') {
    await admin.from('user_roles').insert({ user_id: userId, role: 'employee' });
  }

  // Seed opening balances dated one Monday before current to enable prior_*_balance lookups
  const today = new Date();
  const dow = today.getDay();
  const daysToMon = (dow + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMon);
  const priorMonday = new Date(monday);
  priorMonday.setDate(monday.getDate() - 7);
  const iso = priorMonday.toISOString().slice(0, 10);

  await admin.from('til_ledger').insert({
    user_id: userId, week_start: iso, opening_balance: openingTil, overtime_earned: 0, til_used: 0, frozen: true, stale: false,
  });
  await admin.from('vacation_ledger').insert({
    user_id: userId, week_start: iso, opening_balance: openingVacation, vacation_used: 0, frozen: true, stale: false,
  });

  redirect('/admin/employees');
}
