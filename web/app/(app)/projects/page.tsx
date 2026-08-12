import Link from 'next/link';
import { Briefcase, AlertTriangle, CalendarDays, PlayCircle, CheckCircle2 } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/dates';
import {
  fetchActiveProjects,
  fetchDashboardKpis,
  fetchMyPriorities,
} from '@/lib/projects/queries';
import { PHASE_LABEL, type ProjectPhase, type TaskPriority } from '@/lib/projects/types';

function phaseTone(p: ProjectPhase): 'neutral' | 'info' | 'success' {
  return p === 'pre' ? 'neutral' : p === 'during' ? 'info' : 'success';
}

function priorityTone(p: TaskPriority): 'neutral' | 'info' | 'warning' | 'danger' {
  return p === 'high' ? 'danger' : p === 'med' ? 'warning' : 'neutral';
}

function daysUntil(iso: string): number {
  const d = new Date(iso).getTime();
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.round((d - now) / (24 * 60 * 60 * 1000));
}

function duePill(due: string | null): { label: string; tone: 'muted' | 'danger' | 'warning' | 'neutral' } {
  if (!due) return { label: '—', tone: 'muted' };
  const days = daysUntil(due);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: 'danger' };
  if (days === 0) return { label: 'Today', tone: 'warning' };
  if (days === 1) return { label: 'Tomorrow', tone: 'warning' };
  if (days <= 7) return { label: `${days}d`, tone: 'warning' };
  return { label: formatDate(due), tone: 'neutral' };
}

export default async function ProjectsDashboard() {
  const sb = await getSupabaseServer();
  const { data: userRow } = await sb.auth.getUser();
  const userId = userRow.user?.id;
  if (!userId) throw new Error('unauthenticated');

  const [kpis, projects, priorities] = await Promise.all([
    fetchDashboardKpis(sb),
    fetchActiveProjects(sb),
    fetchMyPriorities(sb, userId),
  ]);

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 md:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full opacity-70"
          style={{ background: 'radial-gradient(circle, var(--color-accent-tint) 0%, transparent 70%)' }}
        />
        <div className="relative flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
          <Briefcase className="h-3.5 w-3.5" /> Projects
        </div>
        <h1 className="relative text-h1 mt-1">On top of every job</h1>
        <p className="relative mt-2 text-body-sm text-[var(--color-text-muted)] max-w-xl">
          Overdue, due-this-week, active jobs, and your priorities — at a glance.
        </p>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Overdue"
          value={kpis.overdue}
          icon={AlertTriangle}
          tone={kpis.overdue > 0 ? 'danger' : 'neutral'}
        />
        <Kpi label="Due this week" value={kpis.dueThisWeek} icon={CalendarDays} tone="warning" />
        <Kpi label="Active jobs"   value={kpis.activeJobs}   icon={PlayCircle}  tone="info" />
        <Kpi label="Done"          value={kpis.done}         icon={CheckCircle2} tone="success" />
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-h3">Active jobs</h2>
            <span className="text-xs text-[var(--color-text-muted)]">{projects.length} active</span>
          </div>
          <div className="mt-3 -mx-2">
            {projects.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No active jobs yet"
                description="Create a job from a project template to see it here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job #</th>
                      <th>Client / Scope</th>
                      <th>Phase</th>
                      <th className="num">Team</th>
                      <th className="num">Progress</th>
                      <th>Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => {
                      const due = duePill(p.deadline);
                      return (
                        <tr key={p.id}>
                          <td>
                            <Link href={`/projects/${p.project_number}`} className="font-medium hover:underline">
                              {p.project_number}
                            </Link>
                          </td>
                          <td>
                            <div className="text-sm">{p.client_name ?? '—'}</div>
                            <div className="col-muted text-xs">{p.scope_title ?? p.name}</div>
                          </td>
                          <td><StatusBadge tone={phaseTone(p.phase)}>{PHASE_LABEL[p.phase]}</StatusBadge></td>
                          <td className="num text-xs col-muted">{p.team_ids.length}</td>
                          <td className="num w-32">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[var(--color-accent)]"
                                  style={{ width: `${Math.min(100, p.progress_pct)}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono tabular-nums w-8 text-right">{p.progress_pct}%</span>
                            </div>
                          </td>
                          <td><StatusBadge tone={due.tone}>{due.label}</StatusBadge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
          <h2 className="text-h3">My priorities</h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Top {priorities.length || 5} open tasks assigned to you.</p>
          <ul className="mt-3 space-y-2">
            {priorities.length === 0 ? (
              <li className="text-sm text-[var(--color-text-muted)]">Nothing assigned to you right now.</li>
            ) : (
              priorities.map((t) => {
                const due = duePill(t.due_date);
                return (
                  <li key={t.id} className="flex items-start gap-2 rounded-md border border-[var(--color-border-soft)] p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">{t.title}</div>
                      <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                        <Link href={`/projects/${t.project_number}`} className="hover:underline">
                          {t.project_number} · {t.project_name}
                        </Link>
                        {t.section_name ? ` · ${t.section_name}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge tone={priorityTone(t.priority)}>{t.priority}</StatusBadge>
                      <StatusBadge tone={due.tone}>{due.label}</StatusBadge>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </section>
    </main>
  );
}

interface KpiProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'neutral' | 'danger' | 'warning' | 'info' | 'success';
}

const KPI_TONE: Record<KpiProps['tone'], string> = {
  neutral: 'text-[var(--color-text)]',
  danger:  'text-[var(--color-status-declined-fg)]',
  warning: 'text-[var(--color-status-declined-fg)]',
  info:    'text-[var(--color-status-submitted-fg)]',
  success: 'text-[var(--color-status-approved-fg)]',
};

function Kpi({ label, value, icon: Icon, tone }: KpiProps) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`mt-0.5 font-mono tabular-nums text-2xl font-semibold ${KPI_TONE[tone]}`}>{value}</div>
    </div>
  );
}
