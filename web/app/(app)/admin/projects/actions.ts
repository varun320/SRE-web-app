'use server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { revalidatePath } from 'next/cache';

export async function createProject(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const number = Number(formData.get('project_number'));
  const name = String(formData.get('name') ?? '').trim();
  if (!Number.isInteger(number) || number < 2020000 || number > 2099999 || number % 1000 < 1 || number % 1000 > 999) {
    return { error: 'project_number must be YYYY + 3-digit sequence (e.g. 2026101)' };
  }
  if (!name) return { error: 'name required' };
  const { error } = await sb.from('projects').insert({
    org_id: '00000000-0000-0000-0000-000000000001',
    project_number: number, name,
  });
  if (error) return { error: error.message };
  revalidatePath('/admin/projects');
}

export async function renameProject(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!id) return { error: 'missing id' };
  if (!name) return { error: 'name required' };
  const { error } = await sb.from('projects').update({ name }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/projects');
}

export async function setProjectStatus(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const id = String(formData.get('id'));
  const status = String(formData.get('status'));
  if (status !== 'active' && status !== 'closed') return { error: 'bad status' };
  const { error } = await sb.from('projects').update({ status }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/projects');
}
