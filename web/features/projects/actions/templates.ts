'use server';
import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/shared/supabase/server';
import { fetchIsAdmin } from '@/shared/lib/role';
import { friendlyError } from '@/shared/lib/errors';

const ORG_ID = '00000000-0000-0000-0000-000000000001';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50) || `tpl_${Date.now()}`;
}

export async function createTemplate(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  if (!name) return { error: 'name required' };
  const { error } = await sb.from('project_templates').insert({
    org_id: ORG_ID, slug: slugify(name), name, description,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects/templates');
}

export async function deleteTemplate(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const id = String(formData.get('id') ?? '');
  // Guard: refuse if any project already uses this template.
  const { count } = await sb.from('projects').select('id', { count: 'exact', head: true }).eq('template_id', id);
  if ((count ?? 0) > 0) return { error: `in use by ${count} project(s)` };
  const { error } = await sb.from('project_templates').delete().eq('id', id);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects/templates');
}

export async function createTemplateSection(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const template_id = String(formData.get('template_id') ?? '');
  const phase = String(formData.get('phase') ?? 'pre') as 'pre' | 'during' | 'post';
  const name = String(formData.get('name') ?? '').trim();
  if (!template_id || !name) return { error: 'template + name required' };
  const { data: max } = await sb.from('template_sections').select('sort_order').eq('template_id', template_id).eq('phase', phase).order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const sort_order = ((max?.sort_order as number | undefined) ?? 0) + 1;
  const { error } = await sb.from('template_sections').insert({ template_id, phase, name, sort_order });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects/templates');
}

export async function deleteTemplateSection(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const id = String(formData.get('id') ?? '');
  const { error } = await sb.from('template_sections').delete().eq('id', id);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects/templates');
}

export async function createTemplateTask(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const section_id = String(formData.get('section_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const priorityRaw = String(formData.get('priority') ?? 'med');
  const priority = (['low', 'med', 'high'] as const).includes(priorityRaw as 'low' | 'med' | 'high') ? (priorityRaw as 'low' | 'med' | 'high') : 'med';
  if (!section_id || !title) return { error: 'section + title required' };
  const { data: max } = await sb.from('template_tasks').select('sort_order').eq('section_id', section_id).order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const sort_order = ((max?.sort_order as number | undefined) ?? 0) + 1;
  const { error } = await sb.from('template_tasks').insert({ section_id, title, default_priority: priority, sort_order });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects/templates');
}

export async function deleteTemplateTask(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const id = String(formData.get('id') ?? '');
  const { error } = await sb.from('template_tasks').delete().eq('id', id);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects/templates');
}
