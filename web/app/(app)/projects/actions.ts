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

const updateProjectSchema = z.object({
  id: z.string().uuid(),
  scope_title: z.string().trim().min(1).max(200).optional(),
  client_id: z.string().uuid().nullable().optional(),
  site_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  lead_id: z.string().uuid().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  phase: z.enum(['pre', 'during', 'post']).optional(),
  team_ids: z.array(z.string().uuid()).optional(),
  // New site/contact created inline
  new_site_name: z.string().trim().max(120).optional(),
  new_contact_name: z.string().trim().max(120).optional(),
  new_contact_email: z.string().email().max(200).optional().or(z.literal('')),
  new_contact_role: z.string().trim().max(120).optional(),
  new_contact_phone: z.string().trim().max(60).optional(),
});

export async function updateProject(input: z.infer<typeof updateProjectSchema>) {
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'invalid input' };
  const {
    id, team_ids,
    new_site_name, new_contact_name, new_contact_email, new_contact_role, new_contact_phone,
    ...patch
  } = parsed.data;

  const sb = await getSupabaseServer();

  // Read the current row so we can detect a template_id transition null → set
  // (adoption of a legacy project) and know whether to run task generation.
  const { data: before, error: readErr } = await sb
    .from('projects').select('template_id, client_id, project_number').eq('id', id).maybeSingle();
  if (readErr) return { error: friendlyError(readErr) };
  if (!before) return { error: 'project not found' };

  const clientId = patch.client_id ?? (before as { client_id: string | null }).client_id;

  // Inline site create
  if (new_site_name && !patch.site_id) {
    if (!clientId) return { error: 'pick a client before adding a new site' };
    const { data: s, error: sErr } = await sb
      .from('sites')
      .insert({ org_id: ORG_ID, client_id: clientId, name: new_site_name })
      .select('id').single();
    if (sErr) return { error: friendlyError(sErr) };
    patch.site_id = s.id;
  }

  // Inline contact create
  if (new_contact_name && !patch.contact_id) {
    if (!clientId) return { error: 'pick a client before adding a new contact' };
    const { data: c, error: cErr } = await sb
      .from('contacts')
      .insert({
        org_id: ORG_ID, client_id: clientId, name: new_contact_name,
        email: new_contact_email || null, role: new_contact_role || null,
        phone: new_contact_phone || null,
      })
      .select('id').single();
    if (cErr) return { error: friendlyError(cErr) };
    patch.contact_id = c.id;
  }

  if (Object.keys(patch).length > 0) {
    const { error: uErr } = await sb.from('projects').update(patch).eq('id', id);
    if (uErr) return { error: friendlyError(uErr) };
  }

  // Replace team membership if provided. Lead is always on the team.
  if (team_ids) {
    const leadId = patch.lead_id ?? (await sb.from('projects').select('lead_id').eq('id', id).single()).data?.lead_id as string | undefined;
    const finalTeam = leadId ? Array.from(new Set([...team_ids, leadId])) : team_ids;
    const { error: delErr } = await sb.from('project_team_members').delete().eq('project_id', id);
    if (delErr) return { error: friendlyError(delErr) };
    if (finalTeam.length > 0) {
      const rows = finalTeam.map((uid) => ({ project_id: id, user_id: uid }));
      const { error: insErr } = await sb.from('project_team_members').insert(rows);
      if (insErr) return { error: friendlyError(insErr) };
    }
  }

  // Adoption: template_id going from null → set means "apply template to
  // this legacy project" — call the RPC to generate tasks. The RPC is idempotent
  // (no-op if tasks already exist), so it's safe on repeat edits too.
  const wasEmpty = (before as { template_id: string | null }).template_id == null;
  const nowSet   = patch.template_id != null;
  if (wasEmpty && nowSet) {
    const { error: rpcErr } = await sb.rpc('apply_template_to_project', {
      p_project_id: id,
      p_template_id: patch.template_id!,
    });
    if (rpcErr) return { error: friendlyError(rpcErr) };
  }

  revalidatePath('/projects');
  const projectNumber = (before as { project_number: number }).project_number;
  revalidatePath(`/projects/${projectNumber}`);
  return { ok: true, project_number: projectNumber };
}

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

const ORG_ID = '00000000-0000-0000-0000-000000000001';

const createProjectSchema = z.object({
  project_number: z.coerce.number().int().min(2020000).max(2099999),
  scope_title: z.string().trim().min(1).max(200),
  template_id: z.string().uuid(),
  lead_id: z.string().uuid(),
  team_ids: z.array(z.string().uuid()).default([]),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accent_color: z.string().trim().max(30).nullable().optional(),

  // Client must exist — add via /clients admin first (needs map coordinates).
  client_id: z.string().uuid(),

  // Site — either pick, create, or leave blank
  site_choice: z.union([z.string().uuid(), z.literal('__new__'), z.literal('__none__')]).default('__none__'),
  new_site_name: z.string().trim().max(120).optional(),

  // Contact — either pick, create, or leave blank
  contact_choice: z.union([z.string().uuid(), z.literal('__new__'), z.literal('__none__')]).default('__none__'),
  new_contact_name: z.string().trim().max(120).optional(),
  new_contact_email: z.string().email().max(200).optional().or(z.literal('')),
  new_contact_role: z.string().trim().max(120).optional(),
  new_contact_phone: z.string().trim().max(60).optional(),
});

export async function createProject(formData: FormData) {
  const sb = await getSupabaseServer();
  const { data: userRow } = await sb.auth.getUser();
  if (!userRow.user) return { error: 'unauthenticated' };

  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k === 'team_ids') {
      raw.team_ids = formData.getAll('team_ids').map(String);
    } else {
      raw[k] = v;
    }
  }
  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'invalid input' };
  const input = parsed.data;

  const clientId = input.client_id;

  // Resolve or create site
  let siteId: string | null = null;
  if (input.site_choice === '__new__') {
    if (!input.new_site_name) return { error: 'new site name required' };
    const { data, error } = await sb
      .from('sites')
      .insert({ org_id: ORG_ID, client_id: clientId, name: input.new_site_name })
      .select('id')
      .single();
    if (error) return { error: friendlyError(error) };
    siteId = data.id;
  } else if (input.site_choice !== '__none__') {
    siteId = input.site_choice;
  }

  // Resolve or create contact
  let contactId: string | null = null;
  if (input.contact_choice === '__new__') {
    if (!input.new_contact_name) return { error: 'new contact name required' };
    const { data, error } = await sb
      .from('contacts')
      .insert({
        org_id: ORG_ID,
        client_id: clientId,
        name: input.new_contact_name,
        email: input.new_contact_email || null,
        role: input.new_contact_role || null,
        phone: input.new_contact_phone || null,
      })
      .select('id')
      .single();
    if (error) return { error: friendlyError(error) };
    contactId = data.id;
  } else if (input.contact_choice !== '__none__') {
    contactId = input.contact_choice;
  }

  // Get template name for project.name (existing lookup table)
  const { data: tpl } = await sb.from('project_templates').select('name').eq('id', input.template_id).maybeSingle();

  const { data: created, error } = await sb.rpc('create_project_from_template', {
    p_project_number: input.project_number,
    p_name: tpl?.name ?? 'Project',
    p_scope_title: input.scope_title,
    p_client_id: clientId,
    p_site_id: siteId,
    p_contact_id: contactId,
    p_template_id: input.template_id,
    p_lead_id: input.lead_id,
    p_deadline: input.deadline,
    p_team_ids: input.team_ids,
    p_accent_color: input.accent_color || null,
  });
  if (error) return { error: friendlyError(error) };

  revalidatePath('/projects');
  return { project_number: input.project_number, project_id: created as string };
}
