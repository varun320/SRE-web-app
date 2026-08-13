import Link from 'next/link';
import { Briefcase, AlertTriangle, CalendarDays, PlayCircle, CheckCircle2, Columns, ListChecks, Package, Calendar as CalendarIcon, Users, ClipboardList } from 'lucide-react';
import { getSupabaseServer } from '@/shared/supabase/server';
import { EmptyState } from '@/shared/ui/empty-state';
import { StatusBadge } from '@/shared/ui/status-badge';
import { formatDate } from '@/shared/lib/dates';
import {
  fetchActiveProjects,
  fetchDashboardKpis,
  fetchMyPriorities,
  fetchNextProjectNumber,
  fetchClientsWithDirectory,
  fetchTemplates,
  fetchTeamRoster,
  fetchTeamWorkload,
  fetchTasksInRange,
} from '@/features/projects/queries';
import { PHASE_LABEL, type ProjectPhase, type TaskPriority } from '@/features/projects/types';
import { NewJobModal } from '@/features/projects/components/NewJobModal';

function phaseTone(p: ProjectPhase): 'neutral' | 'info' | 'success' {
  return p === 'pre' ? 'neutral' : p === 'during' ? 'info' : 'success';
}

function priorityTone(p: TaskPriority): 'neutral' | 'info' | 'warning' | 'danger' {
  return p === 'high' ? 'danger' : p === 'med' ? 'warning' : 'neutral';
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

function workloadTone(n: number): { label: string; tone: 'muted' | 'success' | 'warning' | 'danger' } {
  if (n === 0) return { label: 'Available',  tone: 'muted' };
  if (n <= 3) return { label: 'Steady',      tone: 'success' };
  if (n <= 7) return { label: 'Busy',        tone: 'warning' };
  return       { label: 'Overloaded', tone: 'danger' };
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

  // Mon-anchored ISO week window for the "This week's deadlines" strip.
  const now = new Date();
  const dow = now.getDay(); // 0=Sun … 6=Sat
  const daysToMon = (dow + 6) % 7;
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - daysToMon);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const weekDays: { date: Date; iso: string; short: string; num: number; isToday: boolean }[] = [];
  const todayIso = fmt(now);
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
    weekDays.push({
      date: d,
      iso: fmt(d),
      short: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
      num: d.getDate(),
      isToday: fmt(d) === todayIso,
    });
  }

  const [kpis, projects, priorities, clients, templates, users, nextNumber, legacyRes, workload, weekTasks] = await Promise.all([
    fetchDashboardKpis(sb),
    fetchActiveProjects(sb),
    fetchMyPriorities(sb, userId),
    fetchClientsWithDirectory(sb),
    fetchTemplates(sb),
    fetchTeamRoster(sb),
    fetchNextProjectNumber(sb),
    sb.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active').is('template_id', null),
    fetchTeamWorkload(sb),
    fetchTasksInRange(sb, fmt(weekStart), fmt(weekEnd)),
  ]);
  const legacyCount = legacyRes.count ?? 0;
  const workloadTop = workload.filter((w) => w.open_count > 0).slice(0, 6);
  const maxWorkload = Math.max(1, ...workloadTop.map((w) => w.open_count));

  const me = users.find((u) => u.id === userId);
  const firstName = me?.full_name?.trim().split(/\s+/)[0] ?? 'there';
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const deadlinesThisWeek = weekTasks.filter((t) => !!t.due_date && t.status !== 'done').length;

  // Bucket week tasks by ISO due date. Skip completed — dashboard is about
  // what's *outstanding* this week, not history.
  const weekByDay = new Map<string, typeof weekTasks>();
  for (const t of weekTasks) {
    if (!t.due_date || t.status === 'done') continue;
    const arr = weekByDay.get(t.due_date) ?? [];
    arr.push(t);
    weekByDay.set(t.due_date, arr);
  }

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 md:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full opacity-70"
          style={{ background: 'radial-gradient(circle, var(--color-accent-tint) 0%, transparent 70%)' }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
              <Briefcase className="h-3.5 w-3.5" /> Projects
            </div>
            <h1 className="text-h1 mt-1">{greeting}, {firstName}</h1>
            <p className="mt-2 text-body-sm text-[var(--color-text-muted)] max-w-xl">
              {todayLabel} · {kpis.activeJobs} active {kpis.activeJobs === 1 ? 'job' : 'jobs'} · {deadlinesThisWeek} {deadlinesThisWeek === 1 ? 'deadline' : 'deadlines'} this week
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/projects/mine"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              <ListChecks className="h-3.5 w-3.5" /> My tasks
            </Link>
            <Link
              href="/projects/tasks"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              <ListChecks className="h-3.5 w-3.5" /> Task list
            </Link>
            <Link
              href="/projects/board"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              <Columns className="h-3.5 w-3.5" /> Board
            </Link>
            <Link
              href="/projects/calendar"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              <CalendarIcon className="h-3.5 w-3.5" /> Calendar
            </Link>
            <Link
              href="/projects/workload"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              <Users className="h-3.5 w-3.5" /> Workload
            </Link>
            <Link
              href="/projects/templates"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              <ClipboardList className="h-3.5 w-3.5" /> Templates
            </Link>
            {clients.length > 0 && templates.length > 0 && users.length > 0 ? (
              <NewJobModal clients={clients} templates={templates} users={users} suggestedNumber={nextNumber} />
            ) : null}
          </div>
        </div>
      </section>

      {legacyCount > 0 ? (
        <Link
          href="/projects/legacy"
          className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-status-submitted-fg)]/40 bg-[var(--color-status-submitted-bg)]/40 px-4 py-2.5 hover:bg-[var(--color-status-submitted-bg)]/70 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-[var(--color-status-submitted-fg)]" />
            <span className="font-medium">{legacyCount} unadopted projects</span>
            <span className="text-[var(--color-text-muted)]">— click through to pick a template and enable task tracking</span>
          </div>
          <span className="text-xs text-[var(--color-accent)]">Review →</span>
        </Link>
      ) : null}

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

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> This week&apos;s deadlines
          </h2>
          <Link href="/projects/calendar" className="text-xs text-[var(--color-accent)] hover:underline">Open calendar →</Link>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-2">
          {weekDays.map((d) => {
            const tasks = weekByDay.get(d.iso) ?? [];
            return (
              <div key={d.iso} className={`min-h-[9rem] rounded-md border ${d.isToday ? 'border-[var(--color-accent)] bg-[var(--color-accent-tint)]/30' : 'border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/40'} p-1.5`}>
                <div className={`mb-1 px-1 text-[10px] uppercase tracking-wider ${d.isToday ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>
                  {d.short} {d.num}
                </div>
                <div className="space-y-1">
                  {tasks.length === 0 ? (
                    <div className="text-[10px] text-[var(--color-text-muted)] px-1">—</div>
                  ) : (
                    tasks.slice(0, 4).map((t) => (
                      <Link
                        key={t.id}
                        href={`/projects/${t.project_number}`}
                        title={`${t.title} · ${t.project_number} ${t.project_name}`}
                        className={`block rounded px-1.5 py-1 text-[11px] leading-tight border-l-2 hover:bg-[var(--color-surface)] transition-colors ${
                          t.priority === 'high'
                            ? 'border-l-[var(--color-status-declined-fg)] bg-[var(--color-status-declined-bg)]/60'
                            : t.priority === 'med'
                            ? 'border-l-[var(--color-accent)] bg-[var(--color-surface)]'
                            : 'border-l-[var(--color-border)] bg-[var(--color-surface)]'
                        }`}
                      >
                        <div className="line-clamp-2">{t.title}</div>
                        <div className="mt-0.5 text-[9px] text-[var(--color-text-muted)] font-mono">{t.project_number}</div>
                      </Link>
                    ))
                  )}
                  {tasks.length > 4 ? (
                    <div className="px-1 text-[10px] text-[var(--color-text-muted)]">+{tasks.length - 4} more</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

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
                      <th>Lead</th>
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
                          <td className="text-xs">{p.lead_name ?? <span className="col-muted">—</span>}</td>
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

      {workloadTop.length > 0 ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-h3 flex items-center gap-2"><Users className="h-4 w-4" /> Team workload</h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Most-loaded members right now. Full view →</p>
            </div>
            <Link href="/projects/workload" className="text-xs text-[var(--color-accent)] hover:underline">All members →</Link>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {workloadTop.map((w) => {
              const t = workloadTone(w.open_count);
              const barPct = Math.max(6, Math.round((w.open_count / maxWorkload) * 100));
              const barColor =
                t.tone === 'danger'  ? 'var(--color-status-declined-fg)' :
                t.tone === 'warning' ? 'var(--color-status-declined-fg)' :
                t.tone === 'success' ? 'var(--color-status-approved-fg)' :
                                       'var(--color-text-muted)';
              return (
                <Link
                  key={w.user_id}
                  href="/projects/workload"
                  className="block rounded-[var(--radius-md)] border border-[var(--color-border-soft)] p-3 hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[11px] font-medium"
                      title={w.full_name}
                    >
                      {initials(w.full_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{w.full_name}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{w.open_count} open · {w.due_this_week_count} this wk</div>
                    </div>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: barColor }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <StatusBadge tone={t.tone}>{t.label}</StatusBadge>
                    {w.overdue_count > 0 ? (
                      <span className="text-[10px] text-[var(--color-status-declined-fg)] font-medium">{w.overdue_count} overdue</span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
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
