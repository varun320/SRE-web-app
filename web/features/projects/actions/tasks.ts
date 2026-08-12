'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/errors';

const updateTaskSchema = z.object({
  id: z.string().uuid(),
  assignee_id: z.string().uuid().nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  priority: z.enum(['low', 'med', 'high']).optional(),
  status: z.enum(['todo', 'doing', 'done']).optional(),
});

export async function updateTask(input: z.infer<typeof updateTaskSchema>) {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'invalid input' };
  const { id, ...patch } = parsed.data;
  if (Object.keys(patch).length === 0) return { ok: true };

  const sb = await getSupabaseServer();
  const { data: row, error } = await sb
    .from('tasks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('project_id, projects(project_number)')
    .maybeSingle();
  if (error) return { error: friendlyError(error) };
  const projectNumber = (row as unknown as { projects: { project_number: number } | null } | null)?.projects?.project_number;
  revalidatePath('/projects');
  if (projectNumber) revalidatePath(`/projects/${projectNumber}`);
  return { ok: true };
}
