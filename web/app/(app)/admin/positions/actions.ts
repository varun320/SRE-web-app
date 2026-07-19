'use server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { revalidatePath } from 'next/cache';

export async function createPosition(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const name = String(formData.get('name') ?? '').trim();
  const hrs = Number(formData.get('annual_vacation_hours'));
  if (!name) return { error: 'name required' };
  if (!Number.isFinite(hrs) || hrs < 0) return { error: 'hours must be ≥ 0' };
  const { error } = await sb.from('positions').insert({
    org_id: '00000000-0000-0000-0000-000000000001',
    name,
    annual_vacation_hours: hrs,
  });
  if (error) return { error: error.message };
  revalidatePath('/admin/positions');
}

export async function updatePosition(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const hrs = Number(formData.get('annual_vacation_hours'));
  if (!id) return { error: 'missing id' };
  if (!name) return { error: 'name required' };
  if (!Number.isFinite(hrs) || hrs < 0) return { error: 'hours must be ≥ 0' };
  const { error } = await sb.from('positions').update({ name, annual_vacation_hours: hrs }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/positions');
}

export async function updatePositionVacation(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const id = String(formData.get('id'));
  const hrs = Number(formData.get('annual_vacation_hours'));
  if (!Number.isFinite(hrs) || hrs < 0) return { error: 'hours must be ≥ 0' };
  const { error } = await sb.from('positions').update({ annual_vacation_hours: hrs }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/positions');
}
