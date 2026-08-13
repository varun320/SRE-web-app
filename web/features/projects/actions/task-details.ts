'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/shared/supabase/server';
import { friendlyError } from '@/shared/lib/errors';

const ORG_ID = '00000000-0000-0000-0000-000000000001';

/** Read the caller's user id + confirm the task exists. RLS handles the
 * team-membership guard on writes — this just gets us a stable revalidate
 * target and the org id. */
async function requireCaller() {
  const sb = await getSupabaseServer();
  const { data: userRow } = await sb.auth.getUser();
  const uid = userRow.user?.id;
  if (!uid) return { error: 'unauthenticated' as const };
  return { sb, uid };
}

// ── Subitems ─────────────────────────────────────────────────────────────

const createSubitemSchema = z.object({
  task_id: z.string().uuid(),
  title: z.string().min(1).max(500),
});

export async function createSubitem(input: z.infer<typeof createSubitemSchema>) {
  const parsed = createSubitemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'invalid input' };
  const ctx = await requireCaller();
  if ('error' in ctx) return { error: ctx.error };

  const { data: existing } = await ctx.sb
    .from('task_subitems')
    .select('sort_order')
    .eq('task_id', parsed.data.task_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (existing?.sort_order ?? -1) + 1;

  const { error } = await ctx.sb.from('task_subitems').insert({
    org_id: ORG_ID,
    task_id: parsed.data.task_id,
    title: parsed.data.title.trim(),
    sort_order: nextOrder,
    created_by: ctx.uid,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects', 'layout');
}

const toggleSubitemSchema = z.object({
  id: z.string().uuid(),
  done: z.boolean(),
});

export async function toggleSubitem(input: z.infer<typeof toggleSubitemSchema>) {
  const parsed = toggleSubitemSchema.safeParse(input);
  if (!parsed.success) return { error: 'invalid input' };
  const ctx = await requireCaller();
  if ('error' in ctx) return { error: ctx.error };
  const { error } = await ctx.sb.from('task_subitems').update({ done: parsed.data.done }).eq('id', parsed.data.id);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects', 'layout');
}

const deleteSubitemSchema = z.object({ id: z.string().uuid() });
export async function deleteSubitem(input: z.infer<typeof deleteSubitemSchema>) {
  const parsed = deleteSubitemSchema.safeParse(input);
  if (!parsed.success) return { error: 'invalid input' };
  const ctx = await requireCaller();
  if ('error' in ctx) return { error: ctx.error };
  const { error } = await ctx.sb.from('task_subitems').delete().eq('id', parsed.data.id);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects', 'layout');
}

// ── Comments ─────────────────────────────────────────────────────────────

const createCommentSchema = z.object({
  task_id: z.string().uuid(),
  body: z.string().min(1).max(4000),
});

export async function createComment(input: z.infer<typeof createCommentSchema>) {
  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'invalid input' };
  const ctx = await requireCaller();
  if ('error' in ctx) return { error: ctx.error };
  const { error } = await ctx.sb.from('task_comments').insert({
    org_id: ORG_ID,
    task_id: parsed.data.task_id,
    body: parsed.data.body.trim(),
    created_by: ctx.uid,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects', 'layout');
}

const deleteCommentSchema = z.object({ id: z.string().uuid() });
export async function deleteComment(input: z.infer<typeof deleteCommentSchema>) {
  const parsed = deleteCommentSchema.safeParse(input);
  if (!parsed.success) return { error: 'invalid input' };
  const ctx = await requireCaller();
  if ('error' in ctx) return { error: ctx.error };
  const { error } = await ctx.sb.from('task_comments').delete().eq('id', parsed.data.id);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects', 'layout');
}

// ── Attachments ──────────────────────────────────────────────────────────
// Upload flow: client uploads to storage bucket 'task-attachments' via the
// browser Supabase client (RLS on storage.objects handles auth). Then this
// action records the metadata row so the drawer can list attachments without
// having to list-storage each open.

const registerAttachmentSchema = z.object({
  task_id: z.string().uuid(),
  storage_path: z.string().min(1),
  filename: z.string().min(1),
  mime_type: z.string().optional(),
  size_bytes: z.number().int().nonnegative().optional(),
});

export async function registerAttachment(input: z.infer<typeof registerAttachmentSchema>) {
  const parsed = registerAttachmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'invalid input' };
  const ctx = await requireCaller();
  if ('error' in ctx) return { error: ctx.error };
  const { error } = await ctx.sb.from('task_attachments').insert({
    org_id: ORG_ID,
    task_id: parsed.data.task_id,
    storage_path: parsed.data.storage_path,
    filename: parsed.data.filename,
    mime_type: parsed.data.mime_type ?? null,
    size_bytes: parsed.data.size_bytes ?? null,
    uploaded_by: ctx.uid,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects', 'layout');
}

const deleteAttachmentSchema = z.object({ id: z.string().uuid() });
export async function deleteAttachment(input: z.infer<typeof deleteAttachmentSchema>) {
  const parsed = deleteAttachmentSchema.safeParse(input);
  if (!parsed.success) return { error: 'invalid input' };
  const ctx = await requireCaller();
  if ('error' in ctx) return { error: ctx.error };
  const { data: row } = await ctx.sb.from('task_attachments').select('storage_path').eq('id', parsed.data.id).maybeSingle();
  if (!row) return { error: 'not found' };
  await ctx.sb.storage.from('task-attachments').remove([row.storage_path]);
  const { error } = await ctx.sb.from('task_attachments').delete().eq('id', parsed.data.id);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/projects', 'layout');
}

/** Signed URL for opening an attachment. Storage bucket is private. */
export async function getAttachmentUrl(storagePath: string) {
  const ctx = await requireCaller();
  if ('error' in ctx) return { error: ctx.error };
  const { data, error } = await ctx.sb.storage.from('task-attachments').createSignedUrl(storagePath, 60 * 15);
  if (error) return { error: friendlyError(error) };
  return { url: data.signedUrl };
}

// ── Reader ───────────────────────────────────────────────────────────────

export interface TaskDetails {
  subitems: Array<{ id: string; title: string; done: boolean; sort_order: number }>;
  comments: Array<{ id: string; body: string; created_at: string; author_name: string | null; author_id: string }>;
  attachments: Array<{ id: string; storage_path: string; filename: string; mime_type: string | null; size_bytes: number | null; uploaded_at: string }>;
}

export async function fetchTaskDetails(taskId: string): Promise<TaskDetails> {
  const sb = await getSupabaseServer();
  const [sub, com, att] = await Promise.all([
    sb.from('task_subitems').select('id, title, done, sort_order').eq('task_id', taskId).order('sort_order'),
    sb.from('task_comments').select('id, body, created_at, created_by, users:created_by(full_name)').eq('task_id', taskId).order('created_at'),
    sb.from('task_attachments').select('id, storage_path, filename, mime_type, size_bytes, uploaded_at').eq('task_id', taskId).order('uploaded_at'),
  ]);
  type CommentRow = { id: string; body: string; created_at: string; created_by: string; users: { full_name: string } | { full_name: string }[] | null };
  const comments = ((com.data ?? []) as unknown as CommentRow[]).map((c) => {
    const u = Array.isArray(c.users) ? c.users[0] : c.users;
    return { id: c.id, body: c.body, created_at: c.created_at, author_id: c.created_by, author_name: u?.full_name ?? null };
  });
  return {
    subitems: (sub.data ?? []) as TaskDetails['subitems'],
    comments,
    attachments: (att.data ?? []) as TaskDetails['attachments'],
  };
}
