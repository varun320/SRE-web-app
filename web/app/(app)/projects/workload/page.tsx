import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { fetchTeamWorkload } from '@/lib/projects/queries';

function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

// Thresholds — same shape as the prototype: 0=available, 1–3=steady, 4–7=busy, 8+=overloaded.
function loadTone(n: number): { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'muted' } {
  if (n === 0) return { label: 'Available',  tone: 'muted' };
  if (n <= 3) return { label: 'Steady',      tone: 'success' };
  if (n <= 7) return { label: 'Busy',        tone: 'warning' };
  return       { label: 'Overloaded', tone: 'danger' };
}

export default async function WorkloadPage() {
  const sb = await getSupabaseServer();
  const rows = await fetchTeamWorkload(sb);
  const maxLoad = Math.max(1, ...rows.map((r) => r.open_count));

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
          <Users className="h-3.5 w-3.5" /> Workload
        </div>
        <h1 className="mt-1 text-h1">Team workload</h1>
        <p className="mt-2 text-body-sm text-[var(--color-text-muted)]">
          Open tasks assigned to each team member across every adopted project. Sorted by load.
        </p>
      </section>

      {rows.every((r) => r.open_count === 0) ? (
        <EmptyState
          icon={Users}
          title="Nothing assigned yet"
          description="Once tasks are assigned on adopted jobs, workload will appear here."
        />
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => {
            const tone = loadTone(r.open_count);
            const barPct = r.open_count === 0 ? 0 : Math.max(6, Math.round((r.open_count / maxLoad) * 100));
            const barColor =
              tone.tone === 'danger'  ? 'var(--color-status-declined-fg)' :
              tone.tone === 'warning' ? 'var(--color-status-declined-fg)' :
              tone.tone === 'success' ? 'var(--color-status-approved-fg)' :
                                        'var(--color-text-muted)';
            return (
              <div key={r.user_id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-xs font-medium"
                    title={r.full_name}
                  >
                    {initials(r.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{r.full_name}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      {r.open_count} open · {r.due_this_week_count} due this week
                    </div>
                  </div>
                  <StatusBadge tone={tone.tone}>{tone.label}</StatusBadge>
                </div>

                <div className="mt-3 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: barColor }} />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-[var(--color-text-muted)]">
                    {r.overdue_count > 0 ? (
                      <StatusBadge tone="danger">{r.overdue_count} overdue</StatusBadge>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">no overdue</span>
                    )}
                  </span>
                  <span className="font-mono tabular-nums text-[var(--color-text-muted)]">{r.open_count} tasks</span>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
