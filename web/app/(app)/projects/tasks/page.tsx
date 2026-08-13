import Link from 'next/link';
import { ArrowLeft, ListChecks } from 'lucide-react';
import { getSupabaseServer } from '@/shared/supabase/server';
import { EmptyState } from '@/shared/ui/empty-state';
import { StatusBadge } from '@/shared/ui/status-badge';
import { formatDate } from '@/shared/lib/dates';
import { fetchAllTasks } from '@/features/projects/queries';
import { PHASE_LABEL, type ProjectPhase, type TaskPriority } from '@/features/projects/types';

function daysUntil(iso: string): number {
  const d = new Date(iso).getTime();
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.round((d - now) / (24 * 60 * 60 * 1000));
}

function duePill(due: string | null): { label: string; tone: 'muted' | 'danger' | 'warning' | 'neutral' } {
  if (!due) return { label: '—', tone: 'muted' };
  const days = daysUntil(due);
  if (days < 0) return { label: `Overdue · ${formatDate(due)}`, tone: 'danger' };
  if (days === 0) return { label: 'Today', tone: 'warning' };
  if (days === 1) return { label: 'Tomorrow', tone: 'warning' };
  if (days <= 7) return { label: `${days}d · ${formatDate(due)}`, tone: 'warning' };
  return { label: formatDate(due), tone: 'neutral' };
}

function priorityTone(p: TaskPriority): 'danger' | 'warning' | 'neutral' {
  return p === 'high' ? 'danger' : p === 'med' ? 'warning' : 'neutral';
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

const PHASES: ProjectPhase[] = ['pre', 'during', 'post'];

export default async function TaskListPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const sp = await searchParams;
  const clientId = sp.client && sp.client !== 'all' ? sp.client : null;

  const sb = await getSupabaseServer();
  const [tasks, clientsRes] = await Promise.all([
    fetchAllTasks(sb, { clientId }),
    sb.from('clients').select('id, name').order('name'),
  ]);
  const clients = clientsRes.data ?? [];

  // Client set for the filter pills — only clients that actually have open
  // tasks right now, so we don't offer dead pills.
  const clientsWithTasks = new Set(tasks.map((t) => t.client_id).filter(Boolean));
  const pills = clients.filter((c) => clientsWithTasks.has(c.id));

  const byPhase: Record<ProjectPhase, typeof tasks> = { pre: [], during: [], post: [] };
  for (const t of tasks) byPhase[t.phase].push(t);

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-5">
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
          <ListChecks className="h-3.5 w-3.5" /> Task List
        </div>
        <h1 className="mt-1 text-h1">All jobs · grouped by phase</h1>
        <p className="mt-2 text-body-sm text-[var(--color-text-muted)]">
          {tasks.length} open task{tasks.length === 1 ? '' : 's'} across every adopted project. Filter by client to focus.
        </p>
      </section>

      {pills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterPill href="/projects/tasks" active={!clientId} label="All jobs" />
          {pills.map((c) => (
            <FilterPill
              key={c.id}
              href={`/projects/tasks?client=${c.id}`}
              active={c.id === clientId}
              label={c.name}
            />
          ))}
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No open tasks"
          description={clientId ? 'No open tasks for this client right now.' : 'Nothing outstanding across any adopted project.'}
        />
      ) : (
        <div className="space-y-6">
          {PHASES.map((phase) => {
            const rows = byPhase[phase];
            if (rows.length === 0) return null;
            return (
              <section key={phase} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-h3">{PHASE_LABEL[phase]}</h2>
                  <span className="text-xs text-[var(--color-text-muted)]">{rows.length} task{rows.length === 1 ? '' : 's'}</span>
                </div>
                <div className="border-t border-[var(--color-accent)]/40" />
                <ul className="space-y-1.5">
                  {rows.map((t) => {
                    const due = duePill(t.due_date);
                    return (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3"
                      >
                        <span
                          aria-hidden
                          className={`inline-block h-4 w-4 shrink-0 rounded border ${
                            t.status === 'in_progress' ? 'border-[var(--color-accent)] bg-[var(--color-accent-tint)]' : 'border-[var(--color-border)]'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/projects/${t.project_number}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {t.title}
                          </Link>
                          <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                            {t.client_name ?? t.project_name}
                            {t.section_name ? ` · ${t.section_name}` : ''}
                            {' · '}
                            <span className="font-mono">{t.project_number}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {t.assignee_name ? (
                            <span
                              title={t.assignee_name}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[10px] font-medium"
                            >
                              {initials(t.assignee_name)}
                            </span>
                          ) : null}
                          <StatusBadge tone={priorityTone(t.priority)}>{t.priority}</StatusBadge>
                          <StatusBadge tone={due.tone}>{due.label}</StatusBadge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

function FilterPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'inline-flex items-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] px-3 py-1 text-xs font-medium'
          : 'inline-flex items-center rounded-full border border-[var(--color-border)] px-3 py-1 text-xs hover:bg-[var(--color-surface-2)]'
      }
    >
      {label}
    </Link>
  );
}
