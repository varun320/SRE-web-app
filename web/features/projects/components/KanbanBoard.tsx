'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { StatusBadge } from '@/shared/ui/status-badge';
import { updateTask } from '@/features/projects/actions/tasks';
import { friendlyError } from '@/shared/lib/errors';
import { formatDate } from '@/shared/lib/dates';
import { TaskDrawer, type Assignable } from './TaskDrawer';
import type { TaskRow, TaskStatus, TaskPriority } from '@/features/projects/types';

export interface BoardTask extends TaskRow {
  project_number: number;
  project_name: string;
}

interface Props {
  tasks: BoardTask[];
  assignableUsers: Assignable[];
}

const COLUMNS: { status: TaskStatus; label: string; tone: 'neutral' | 'info' | 'success' }[] = [
  { status: 'todo',  label: 'To do',       tone: 'neutral' },
  { status: 'doing', label: 'In progress', tone: 'info' },
  { status: 'done',  label: 'Done',        tone: 'success' },
];

function priorityTone(p: TaskPriority): 'neutral' | 'warning' | 'danger' {
  return p === 'high' ? 'danger' : p === 'med' ? 'warning' : 'neutral';
}
function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
}
function due(t: BoardTask): { label: string; tone: 'muted' | 'danger' | 'warning' | 'neutral' } {
  if (!t.due_date) return { label: '—', tone: 'muted' };
  const d = daysUntil(t.due_date);
  if (d < 0) return { label: `${Math.abs(d)}d overdue`, tone: 'danger' };
  if (d === 0) return { label: 'Today', tone: 'warning' };
  if (d === 1) return { label: 'Tomorrow', tone: 'warning' };
  if (d <= 7) return { label: `${d}d`, tone: 'warning' };
  return { label: formatDate(t.due_date), tone: 'neutral' };
}

export function KanbanBoard({ tasks: initialTasks, assignableUsers }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<TaskStatus | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [, start] = useTransition();

  const byStatus = useMemo(() => {
    const m = new Map<TaskStatus, BoardTask[]>();
    for (const c of COLUMNS) m.set(c.status, []);
    for (const t of tasks) m.get(t.status)?.push(t);
    return m;
  }, [tasks]);

  function onDrop(status: TaskStatus) {
    if (!dragId) return;
    setHoverCol(null);
    const task = tasks.find((t) => t.id === dragId);
    setDragId(null);
    if (!task || task.status === status) return;

    // optimistic
    setTasks((prev) => prev.map((t) => (t.id === dragId ? { ...t, status } : t)));
    start(async () => {
      const res = await updateTask({ id: dragId, status });
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {COLUMNS.map((col) => {
          const items = byStatus.get(col.status) ?? [];
          const isHover = hoverCol === col.status;
          return (
            <div
              key={col.status}
              onDragOver={(e) => { e.preventDefault(); setHoverCol(col.status); }}
              onDragLeave={() => setHoverCol((h) => (h === col.status ? null : h))}
              onDrop={() => onDrop(col.status)}
              className={[
                'rounded-[var(--radius-lg)] border bg-[var(--color-surface)] flex flex-col',
                isHover ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent-tint)]' : 'border-[var(--color-border-soft)]',
              ].join(' ')}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border-soft)]">
                <div className="flex items-center gap-2">
                  <StatusBadge tone={col.tone}>{col.label}</StatusBadge>
                  <span className="text-[11px] text-[var(--color-text-muted)]">{items.length}</span>
                </div>
              </div>
              <ul className="p-2 space-y-2 min-h-[120px]">
                {items.length === 0 ? (
                  <li className="text-[11px] text-[var(--color-text-muted)] text-center py-6">Drop tasks here</li>
                ) : (
                  items.map((t) => {
                    const d = due(t);
                    const isDragging = dragId === t.id;
                    return (
                      <li
                        key={t.id}
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => { setDragId(null); setHoverCol(null); }}
                        onClick={() => setOpenId(t.id)}
                        className={[
                          'rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/40 p-2.5 cursor-grab select-none',
                          'hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)]/70 transition-colors',
                          isDragging ? 'opacity-40' : '',
                        ].join(' ')}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--color-text-muted)]">
                          <Link
                            href={`/projects/${t.project_number}`}
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t.project_number}
                          </Link>
                          <span>·</span>
                          <span className="truncate">{t.project_name}</span>
                        </div>
                        <div className={`mt-1 text-sm ${t.status === 'done' ? 'line-through text-[var(--color-text-muted)]' : ''}`}>{t.title}</div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <StatusBadge tone={priorityTone(t.priority)}>{t.priority}</StatusBadge>
                          <StatusBadge tone={d.tone}>{d.label}</StatusBadge>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          );
        })}
      </div>

      <TaskDrawer task={openTask} assignableUsers={assignableUsers} onClose={() => setOpenId(null)} />
    </>
  );
}
