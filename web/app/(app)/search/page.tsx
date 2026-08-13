import Link from 'next/link';
import { Search, Briefcase, ListChecks, Users, MapPin } from 'lucide-react';
import { getSupabaseServer } from '@/shared/supabase/server';
import { StatusBadge } from '@/shared/ui/status-badge';
import { formatDate } from '@/shared/lib/dates';

interface SP { q?: string }

type PhaseVal = 'pre' | 'during' | 'post';
const PHASE_LABEL: Record<PhaseVal, string> = { pre: 'Pre-Job', during: 'During Job', post: 'Post-Job' };
function phaseTone(p: PhaseVal): 'neutral' | 'info' | 'success' {
  return p === 'pre' ? 'neutral' : p === 'during' ? 'info' : 'success';
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { q = '' } = await searchParams;
  const query = q.trim();

  if (!query) {
    return (
      <main className="w-full px-3 md:px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-8 text-center">
          <Search className="mx-auto h-6 w-6 text-[var(--color-text-muted)]" />
          <h1 className="mt-3 text-h2">Search</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Type a query in the header to find jobs, tasks, clients, and people.</p>
        </div>
      </main>
    );
  }

  const sb = await getSupabaseServer();
  const like = `%${query}%`;

  // Six queries in parallel — each capped at a handful of rows since this is a
  // search preview, not a full listing. PostgREST 'or' handles the multi-column
  // ILIKE fan-out per table.
  const [jobsRes, tasksRes, clientsRes, sitesRes, contactsRes, usersRes] = await Promise.all([
    sb.from('projects')
      .select('id, project_number, name, scope_title, phase, status, deadline, clients(name)')
      .or(`name.ilike.${like},scope_title.ilike.${like},project_number.eq.${/^\d+$/.test(query) ? Number(query) : 0}`)
      .limit(15),
    sb.from('tasks')
      .select('id, title, phase, priority, due_date, status, projects!inner(project_number, name, template_id)')
      .ilike('title', like)
      .neq('status', 'done')
      .limit(15),
    sb.from('clients')
      .select('id, name, location')
      .or(`name.ilike.${like},location.ilike.${like}`)
      .limit(10),
    sb.from('sites')
      .select('id, name, address, client_id, clients(name)')
      .or(`name.ilike.${like},address.ilike.${like}`)
      .limit(10),
    sb.from('contacts')
      .select('id, name, role, email, phone, client_id, clients(name)')
      .or(`name.ilike.${like},email.ilike.${like},role.ilike.${like}`)
      .limit(10),
    sb.from('users')
      .select('id, full_name, email')
      .or(`full_name.ilike.${like},email.ilike.${like}`)
      .limit(10),
  ]);

  const jobs = (jobsRes.data ?? []) as unknown as Array<{
    id: string; project_number: number; name: string; scope_title: string | null;
    phase: PhaseVal; status: string; deadline: string | null;
    clients: { name: string } | null;
  }>;
  const tasks = ((tasksRes.data ?? []) as unknown as Array<{
    id: string; title: string; phase: PhaseVal; priority: 'high'|'med'|'low';
    due_date: string | null; status: string;
    projects: { project_number: number; name: string; template_id: string | null };
  }>).filter((t) => t.projects.template_id != null);
  const clients = clientsRes.data ?? [];
  const sites = (sitesRes.data ?? []) as unknown as Array<{ id: string; name: string; address: string | null; client_id: string; clients: { name: string } | null }>;
  const contacts = (contactsRes.data ?? []) as unknown as Array<{ id: string; name: string; role: string | null; email: string | null; phone: string | null; client_id: string; clients: { name: string } | null }>;
  const users = usersRes.data ?? [];

  const totalHits = jobs.length + tasks.length + clients.length + sites.length + contacts.length + users.length;

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-5">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
          <Search className="h-3.5 w-3.5" /> Search
        </div>
        <h1 className="mt-1 text-h1">Results for <span className="font-normal italic">&ldquo;{query}&rdquo;</span></h1>
        <p className="mt-2 text-body-sm text-[var(--color-text-muted)]">
          {totalHits} match{totalHits === 1 ? '' : 'es'} across jobs, tasks, clients, sites, contacts, and people.
        </p>
      </section>

      {totalHits === 0 ? (
        <section className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">Nothing matched. Try a shorter query or a project number.</p>
        </section>
      ) : (
        <div className="space-y-5">
          {jobs.length > 0 ? (
            <ResultGroup icon={Briefcase} title="Jobs" count={jobs.length}>
              <ul className="space-y-1.5">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <Link href={`/projects/${j.project_number}`} className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border-soft)] p-3 hover:bg-[var(--color-surface-2)]">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">
                          <span className="font-mono">{j.project_number}</span> · {j.scope_title ?? j.name}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">{j.clients?.name ?? '—'}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge tone={phaseTone(j.phase)}>{PHASE_LABEL[j.phase]}</StatusBadge>
                        {j.deadline ? <StatusBadge tone="neutral">{formatDate(j.deadline)}</StatusBadge> : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultGroup>
          ) : null}

          {tasks.length > 0 ? (
            <ResultGroup icon={ListChecks} title="Tasks" count={tasks.length}>
              <ul className="space-y-1.5">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <Link href={`/projects/${t.projects.project_number}`} className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border-soft)] p-3 hover:bg-[var(--color-surface-2)]">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{t.title}</div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">
                          <span className="font-mono">{t.projects.project_number}</span> · {t.projects.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge tone={t.priority === 'high' ? 'danger' : t.priority === 'med' ? 'warning' : 'neutral'}>{t.priority}</StatusBadge>
                        {t.due_date ? <StatusBadge tone="neutral">{formatDate(t.due_date)}</StatusBadge> : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultGroup>
          ) : null}

          {clients.length > 0 ? (
            <ResultGroup icon={Briefcase} title="Clients" count={clients.length}>
              <ul className="space-y-1.5">
                {clients.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`} className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border-soft)] p-3 hover:bg-[var(--color-surface-2)]">
                      <div className="text-sm">{c.name}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{c.location ?? ''}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultGroup>
          ) : null}

          {sites.length > 0 ? (
            <ResultGroup icon={MapPin} title="Sites" count={sites.length}>
              <ul className="space-y-1.5">
                {sites.map((s) => (
                  <li key={s.id}>
                    <Link href={`/clients/${s.client_id}`} className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border-soft)] p-3 hover:bg-[var(--color-surface-2)]">
                      <div>
                        <div className="text-sm">{s.name}</div>
                        {s.address ? <div className="text-[11px] text-[var(--color-text-muted)]">{s.address}</div> : null}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{s.clients?.name ?? ''}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultGroup>
          ) : null}

          {contacts.length > 0 ? (
            <ResultGroup icon={Users} title="Contacts" count={contacts.length}>
              <ul className="space-y-1.5">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clients/${c.client_id}`} className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border-soft)] p-3 hover:bg-[var(--color-surface-2)]">
                      <div>
                        <div className="text-sm">{c.name}{c.role ? <span className="text-[var(--color-text-muted)]"> · {c.role}</span> : null}</div>
                        {c.email ? <div className="text-[11px] text-[var(--color-text-muted)]">{c.email}</div> : null}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{c.clients?.name ?? ''}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultGroup>
          ) : null}

          {users.length > 0 ? (
            <ResultGroup icon={Users} title="People" count={users.length}>
              <ul className="space-y-1.5">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border-soft)] p-3">
                    <div className="text-sm">{u.full_name}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">{u.email}</div>
                  </li>
                ))}
              </ul>
            </ResultGroup>
          ) : null}
        </div>
      )}
    </main>
  );
}

function ResultGroup({ icon: Icon, title, count, children }: { icon: React.ComponentType<{ className?: string }>; title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-h3 flex items-center gap-2"><Icon className="h-4 w-4" /> {title}</h2>
        <span className="text-xs text-[var(--color-text-muted)]">{count}</span>
      </div>
      {children}
    </section>
  );
}
