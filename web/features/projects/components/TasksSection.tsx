'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { Users } from 'lucide-react';
import { updateTask } from '@/features/projects/actions/tasks';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/dates';
import { PHASE_LABEL, type TaskRow, type TaskStatus, type ProjectPhase, type TaskPriority } from '@/features/projects/types';
import { TaskDrawer, type Assignable } from './TaskDrawer';

interface Props {
  tasks: TaskRow[];
  assignableUsers: Assignable[];
}

function priorityTone(p: TaskPriority): 'neutral' | 'warning' | 'danger' {
  return p === 'high' ? 'danger' : p === 'med' ? 'warning' : 'neutral';
}
function statusTone(s: TaskStatus): 'neutral' | 'info' | 'success' {
  return s === 'done' ? 'success' : s === 'doing' ? 'info' : 'neutral';
}
function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
}
function taskDueLabel(due: string | null): string {
  if (!due) return '—';
  const d = daysUntil(due);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d <= 14) return `in ${d}d`;
  return formatDate(due);
}

export function TasksSection({ tasks: initialTasks, assignableUsers }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [openId, setOpenId] = useState<string | null>(null);
  const [, start] = useTransition();

  const openTasks = tasks.filter((t) => t.status !== 'done').length;
  const tasksByPhase = new Map<ProjectPhase, TaskRow[]>([['pre', []], ['during', []], ['post', []]]);
  for (const t of tasks) tasksByPhase.get(t.phase)?.push(t);

  function toggleDone(id: string, done: boolean) {
    const nextStatus: TaskStatus = done ? 'done' : 'todo';
    // optimistic
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
    start(async () => {
      const res = await updateTask({ id, status: nextStatus });
      if (res?.error) {
        toast.error(friendlyError(res.error));
        setTasks(initialTasks);
      } else {
        router.refresh();
      }
    });
  }

  const openTask = tasks.find((t) => t.id === openId) ?? null;

  return (
    <>
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-h3">Tasks</h2>
          <span className="text-xs text-[var(--color-text-muted)]">{openTasks} open · {tasks.length} total</span>
        </div>

        {tasks.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={Users}
              title="No tasks yet"
              description="Tasks will populate when a project template is applied to this job."
            />
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {(['pre', 'during', 'post'] as ProjectPhase[]).map((phase) => {
              const rows = tasksByPhase.get(phase) ?? [];
              if (rows.length === 0) return null;
              return (
                <div key={phase}>
                  <div className="flex items-center gap-2 pb-1.5 border-b-2 border-[var(--color-accent)]">
                    <span className="text-[11px] uppercase tracking-wider font-semibold">{PHASE_LABEL[phase]}</span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">{rows.length}</span>
                  </div>
                  <ul className="divide-y divide-[var(--color-border-soft)]">
                    {rows.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 py-2 hover:bg-[var(--color-surface-2)]/40 -mx-2 px-2 rounded-md">
                        <input
                          type="checkbox"
                          checked={t.status === 'done'}
                          onChange={(e) => toggleDone(t.id, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-[var(--color-border)] cursor-pointer"
                          aria-label={`Mark ${t.title} ${t.status === 'done' ? 'not done' : 'done'}`}
                        />
                        <button
                          type="button"
                          onClick={() => setOpenId(t.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className={`text-sm ${t.status === 'done' ? 'line-through text-[var(--color-text-muted)]' : ''}`}>
                            {t.title}
                          </div>
                          {t.section_name ? (
                            <div className="text-[11px] text-[var(--color-text-muted)]">{t.section_name}</div>
                          ) : null}
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusBadge tone={priorityTone(t.priority)}>{t.priority}</StatusBadge>
                          <StatusBadge tone={statusTone(t.status)}>{t.status}</StatusBadge>
                          <span className="text-[11px] text-[var(--color-text-muted)] w-20 text-right">{taskDueLabel(t.due_date)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <TaskDrawer task={openTask} assignableUsers={assignableUsers} onClose={() => setOpenId(null)} />
    </>
  );
}
