import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Mail, User, Users } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/dates';
import { fetchProjectByNumber, fetchTeamRoster, fetchClientsWithDirectory, fetchTemplates } from '@/features/projects/queries';
import { EditJobPanel } from '@/features/projects/components/EditJobPanel';
import { PHASE_LABEL, type ProjectPhase } from '@/features/projects/types';
import { TasksSection } from '@/features/projects/components/TasksSection';

function phaseTone(p: ProjectPhase): 'neutral' | 'info' | 'success' {
  return p === 'pre' ? 'neutral' : p === 'during' ? 'info' : 'success';
}

function daysUntil(iso: string): number {
  const d = new Date(iso).getTime();
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.round((d - now) / (24 * 60 * 60 * 1000));
}

function dueLabel(due: string | null): string | null {
  if (!due) return null;
  const days = daysUntil(due);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 14) return `in ${days}d`;
  return null;  // far out — the absolute date already tells the story
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

export default async function ProjectDetail({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const n = Number(number);
  if (!Number.isFinite(n)) notFound();

  const sb = await getSupabaseServer();
  const [project, users, clients, templates] = await Promise.all([
    fetchProjectByNumber(sb, n),
    fetchTeamRoster(sb),
    fetchClientsWithDirectory(sb),
    fetchTemplates(sb),
  ]);
  if (!project) notFound();

  const accent = project.accent_color ?? 'var(--color-accent)';
  const progressColor = project.progress_pct >= 90 ? 'var(--color-status-approved-fg)' : 'var(--color-accent)';

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ArrowLeft className="h-3.5 w-3.5" /> All jobs
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
        <div className="p-5 md:p-6 flex items-start gap-6">
          <div
            className="relative h-20 w-20 shrink-0 rounded-full grid place-items-center font-mono tabular-nums font-semibold"
            style={{
              background: `conic-gradient(${progressColor} ${project.progress_pct * 3.6}deg, var(--color-surface-2) 0)`,
            }}
          >
            <div className="h-16 w-16 rounded-full bg-[var(--color-surface)] grid place-items-center">
              <span className="text-lg">{project.progress_pct}%</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
                <span className="font-mono">{project.project_number}</span>
                <StatusBadge tone={phaseTone(project.phase)}>{PHASE_LABEL[project.phase]}</StatusBadge>
                {project.status === 'closed' ? <StatusBadge tone="muted">closed</StatusBadge> : null}
                {!project.template_id ? <StatusBadge tone="warning">unadopted</StatusBadge> : null}
              </div>
              <EditJobPanel
                projectId={project.id}
                isLegacy={!project.template_id}
                initial={{
                  scope_title: project.scope_title,
                  client_id: project.client_id,
                  site_id: project.site_id ?? null,
                  contact_id: project.contact_id ?? null,
                  template_id: project.template_id ?? null,
                  lead_id: project.lead_id,
                  deadline: project.deadline,
                  phase: project.phase,
                  team_ids: project.team.map((m) => m.id),
                }}
                clients={clients}
                templates={templates}
                users={users}
              />
            </div>
            <h1 className="mt-1 text-h1">{project.scope_title ?? project.name}</h1>
            <p className="mt-1 text-body-sm text-[var(--color-text-muted)]">{project.client_name ?? 'Unassigned client'}</p>
          </div>
        </div>

        <div className="border-t border-[var(--color-border-soft)] grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-[var(--color-border-soft)]">
          <Meta icon={MapPin} label={project.site_name ? 'Client · Site' : 'Client'}>
            <div>{project.client_name ?? '—'}</div>
            {project.site_name ? <div className="text-[11px] text-[var(--color-text-muted)]">{project.site_name}</div> : null}
          </Meta>
          <Meta icon={Mail} label="Contact">
            {project.contact ? (
              <div>
                {project.contact.email ? (
                  <a href={`mailto:${project.contact.email}`} className="hover:underline">{project.contact.name}</a>
                ) : project.contact.name}
                {project.contact.role ? <div className="text-[11px] text-[var(--color-text-muted)]">{project.contact.role}</div> : null}
              </div>
            ) : '—'}
          </Meta>
          <Meta icon={User} label="Lead">{project.lead?.full_name ?? '—'}</Meta>
          <Meta icon={Users} label={`Team · ${project.team.length}`}>
            <div className="flex -space-x-1.5">
              {project.team.slice(0, 5).map((m) => (
                <span
                  key={m.id}
                  title={m.full_name}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-[var(--color-surface)] bg-[var(--color-surface-2)] text-[10px] font-medium"
                >
                  {initials(m.full_name)}
                </span>
              ))}
              {project.team.length > 5 ? (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full ring-2 ring-[var(--color-surface)] bg-[var(--color-surface-2)] text-[10px] px-1">
                  +{project.team.length - 5}
                </span>
              ) : null}
            </div>
          </Meta>
          <Meta icon={MapPin} label="Deadline">
            {project.deadline ? (
              <span>
                {formatDate(project.deadline)}
                {dueLabel(project.deadline) ? (
                  <span className="text-[var(--color-text-muted)]"> · {dueLabel(project.deadline)}</span>
                ) : null}
              </span>
            ) : '—'}
          </Meta>
        </div>
      </section>

      <TasksSection tasks={project.tasks} assignableUsers={users} />
    </main>
  );
}

function Meta({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}
