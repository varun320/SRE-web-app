'use client';

import { useMemo, useState } from 'react';
import { TaskDrawer, type Assignable } from './TaskDrawer';
import type { MyTaskRow } from '@/features/projects/queries';

interface Props {
  year: number;
  month: number;  // 1..12
  tasks: MyTaskRow[];
  assignableUsers: Assignable[];
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function pad(n: number): string { return String(n).padStart(2, '0'); }

// Chip tone by task state: overdue/red, done/green, else gold.
function chipTone(t: MyTaskRow, isPast: boolean): string {
  if (t.status === 'done') return 'bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-fg)]';
  if (isPast) return 'bg-[var(--color-status-declined-bg)] text-[var(--color-status-declined-fg)]';
  return 'bg-[var(--color-status-submitted-bg)] text-[var(--color-status-submitted-fg)]';
}

export function CalendarGrid({ year, month, tasks, assignableUsers }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const today = todayISO();

  // Group tasks by ISO date once. Skip tasks with null due_date defensively.
  const byDate = useMemo(() => {
    const m = new Map<string, MyTaskRow[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const arr = m.get(t.due_date) ?? [];
      arr.push(t);
      m.set(t.due_date, arr);
    }
    return m;
  }, [tasks]);

  // Build the 6-week grid: Monday of week containing day 1 through the end.
  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    // JS getDay(): Sun=0..Sat=6. Convert to Mon=0..Sun=6.
    const dow = (first.getDay() + 6) % 7;
    const start = new Date(year, month - 1, 1 - dow);
    const out: Array<{ iso: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      out.push({ iso, day: d.getDate(), inMonth: d.getMonth() + 1 === month });
    }
    return out;
  }, [year, month]);

  const openTask = tasks.find((t) => t.id === openId) ?? null;

  return (
    <>
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/60">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            const dayTasks = byDate.get(c.iso) ?? [];
            const isToday = c.iso === today;
            const isPast = c.iso < today;
            return (
              <div
                key={i}
                className={[
                  'min-h-[92px] border-r border-b border-[var(--color-border-soft)] p-1.5',
                  c.inMonth ? '' : 'bg-[var(--color-surface-2)]/30 text-[var(--color-text-muted)]',
                  (i % 7) === 6 ? 'border-r-0' : '',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={[
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-mono',
                      isToday ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] font-semibold' : '',
                    ].join(' ')}
                  >
                    {c.day}
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {dayTasks.slice(0, 4).map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(t.id)}
                        title={`${t.project_number} · ${t.project_name} — ${t.title}`}
                        className={[
                          'w-full text-left rounded px-1.5 py-0.5 text-[10px] leading-tight truncate hover:opacity-80',
                          chipTone(t, isPast),
                        ].join(' ')}
                      >
                        <span className="font-mono">{t.project_number}</span> · {t.title}
                      </button>
                    </li>
                  ))}
                  {dayTasks.length > 4 ? (
                    <li className="text-[10px] text-[var(--color-text-muted)] px-1.5">+{dayTasks.length - 4} more</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <TaskDrawer task={openTask} assignableUsers={assignableUsers} onClose={() => setOpenId(null)} />
    </>
  );
}
