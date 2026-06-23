'use server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { revalidatePath } from 'next/cache';

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
