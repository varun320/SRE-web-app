import type { SupabaseClient } from '@supabase/supabase-js';

export interface DirectoryCard {
  id: string;
  name: string;
  location: string | null;
  sharepoint_url: string | null;
  sites_count: number;
  contacts_count: number;
  jobs_count: number;
  contacts: Array<{ id: string; name: string; role: string | null; email: string | null; phone: string | null }>;
  sites: Array<{ id: string; name: string; short_code: string | null }>;
  active_jobs: Array<{ project_number: number; scope: string; phase: 'pre' | 'during' | 'post' }>;
  previous_work: Array<{ project_number: number; scope: string; deadline: string | null }>;
}

/** One row per client with the summary lists the reference-style directory
 * cards need (contacts, sites, active + past jobs). Six top-level rows
 * fetched in parallel; joined in JS so we don't blow out PostgREST embed
 * limits. */
export async function fetchDirectoryCards(sb: SupabaseClient): Promise<DirectoryCard[]> {
  const [clientsRes, sitesRes, contactsRes, projectsRes] = await Promise.all([
    sb.from('clients').select('id, name, location, sharepoint_url').order('name'),
    sb.from('sites').select('id, client_id, name').order('name'),
    sb.from('contacts').select('id, client_id, name, role, email, phone').order('name'),
    sb
      .from('projects')
      .select('project_number, name, scope_title, client_id, phase, status, deadline, template_id')
      .not('client_id', 'is', null)
      .order('project_number', { ascending: false }),
  ]);

  const clients = clientsRes.data ?? [];

  const sitesBy = new Map<string, DirectoryCard['sites']>();
  for (const s of sitesRes.data ?? []) {
    const arr = sitesBy.get(s.client_id) ?? [];
    // Short code = ST-<last 4 of uuid> so the reference's "ST-1102" style
    // has a live analog until we grow a real code column.
    arr.push({ id: s.id, name: s.name, short_code: `ST-${s.id.slice(-4).toUpperCase()}` });
    sitesBy.set(s.client_id, arr);
  }

  const contactsBy = new Map<string, DirectoryCard['contacts']>();
  for (const c of contactsRes.data ?? []) {
    const arr = contactsBy.get(c.client_id) ?? [];
    arr.push({ id: c.id, name: c.name, role: c.role, email: c.email, phone: c.phone });
    contactsBy.set(c.client_id, arr);
  }

  const activeBy = new Map<string, DirectoryCard['active_jobs']>();
  const previousBy = new Map<string, DirectoryCard['previous_work']>();
  for (const p of projectsRes.data ?? []) {
    // Only adopted (template_id set) jobs feed the cards — legacy timesheet-
    // only rows would just be noise here.
    if (!p.template_id) continue;
    if (p.status === 'active') {
      const arr = activeBy.get(p.client_id) ?? [];
      arr.push({
        project_number: p.project_number,
        scope: p.scope_title ?? p.name,
        phase: p.phase as 'pre' | 'during' | 'post',
      });
      activeBy.set(p.client_id, arr);
    } else {
      const arr = previousBy.get(p.client_id) ?? [];
      arr.push({
        project_number: p.project_number,
        scope: p.scope_title ?? p.name,
        deadline: p.deadline,
      });
      previousBy.set(p.client_id, arr);
    }
  }

  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    location: c.location,
    sharepoint_url: c.sharepoint_url,
    sites: sitesBy.get(c.id) ?? [],
    contacts: contactsBy.get(c.id) ?? [],
    active_jobs: activeBy.get(c.id) ?? [],
    previous_work: previousBy.get(c.id) ?? [],
    sites_count: (sitesBy.get(c.id) ?? []).length,
    contacts_count: (contactsBy.get(c.id) ?? []).length,
    jobs_count: (activeBy.get(c.id) ?? []).length + (previousBy.get(c.id) ?? []).length,
  }));
}
