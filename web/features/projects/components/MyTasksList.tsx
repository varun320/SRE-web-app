'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/ui/status-badge';
import { updateTask } from '@/features/projects/actions/tasks';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/dates';
import { TaskDrawer, type Assignable } from './TaskDrawer';
import type { MyTaskRow } from '@/features/projects/queries';
import type { TaskPriority } from '@/features/projects/types';

interface Buckets {
  overdue: MyTaskRow[];
  today: MyTaskRow[];
  thisWeek: MyTaskRow[];
  later: MyTaskRow[];
  noDate: MyTaskRow[];
  completed: MyTaskRow[];
}

interface Props {
  buckets: Buckets;
  assignableUsers: Assignable[];
}

function priorityTone(p: TaskPriority): 'neutral' | 'warning' | 'danger' {
  return p === 'high' ? 'danger' : p === 'med' ? 'warning' : 'neutral';
}

const BUCKET_META: Array<{ key: keyof Buckets; label: string; tone: 'danger' | 'warning' | 'info' | 'neutral' | 'muted' | 'success' }> = [
  { key: 'overdue',   label: 'Overdue',       tone: 'danger' },
  { key: 'today',     label: 'Due today',     tone: 'warning' },
  { key: 'thisWeek',  label: 'This week',     tone: 'info' },
  { key: 'later',     label: 'Later',         tone: 'neutral' },
  { key: 'noDate',    label: 'No due date',   tone: 'muted' },
  { key: 'completed', label: 'Completed',     tone: 'success' },
];

export function MyTasksList({ buckets: initial, assignableUsers }: Props) {
  const router = useRouter();
  const [buckets, setBuckets] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [, start] = useTransition();

  function toggleDone(id: string, done: boolean) {
    // Optimistic move between buckets
    setBuckets((prev) => {
      const next: Buckets = { overdue: [], today: [], thisWeek: [], later: [], noDate: [], completed: [] };
      let moved: MyTaskRow | null = null;
      for (const k of Object.keys(prev) as (keyof Buckets)[]) {
        for (const t of prev[k]) {
          if (t.id === id) { moved = { ...t, status: done ? 'done' : 'todo' }; continue; }
          next[k].push(t);
        }
      }
      if (moved) {
        if (done) next.completed.unshift(moved);
        else next.noDate.unshift(moved);  // land in "no due date" since we don't know its original bucket; will refresh from server
      }
      return next;
    });
    start(async () => {
      const res = await updateTask({ id, status: done ? 'done' : 'todo' });
      if (res?.error) { toast.error(friendlyError(res.error)); setBuckets(initial); }
      else router.refresh();
    });
  }

  const allTasks = Object.values(buckets).flat();
  const openTask = allTasks.find((t) => t.id === openId) ?? null;

  return (
    <>
      <div className="space-y-4">
        {BUCKET_META.map(({ key, label, tone }) => {
          const rows = buckets[key];
          if (rows.length === 0) return null;
          return (
            <section key={key} className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border-soft)]">
                <StatusBadge tone={tone}>{label}</StatusBadge>
                <span className="text-[11px] text-[var(--color-text-muted)]">{rows.length}</span>
              </div>
              <ul className="divide-y divide-[var(--color-border-soft)]">
                {rows.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2 -mx-2 px-2 rounded-md hover:bg-[var(--color-surface-2)]/40">
                    <input
                      type="checkbox"
                      checked={t.status === 'done'}
                      onChange={(e) => toggleDone(t.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-[var(--color-border)] cursor-pointer"
                      aria-label={`Mark ${t.title} ${t.status === 'done' ? 'not done' : 'done'}`}
                    />
                    <button type="button" onClick={() => setOpenId(t.id)} className="flex-1 min-w-0 text-left">
                      <div className={`text-sm ${t.status === 'done' ? 'line-through text-[var(--color-text-muted)]' : ''}`}>
                        {t.title}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        <Link href={`/projects/${t.project_number}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                          {t.project_number} · {t.project_name}
                        </Link>
                        {t.section_name ? ` · ${t.section_name}` : ''}
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge tone={priorityTone(t.priority)}>{t.priority}</StatusBadge>
                      <span className="text-[11px] text-[var(--color-text-muted)] w-20 text-right">
                        {t.due_date ? formatDate(t.due_date) : '—'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <TaskDrawer task={openTask} assignableUsers={assignableUsers} onClose={() => setOpenId(null)} />
    </>
  );
}
