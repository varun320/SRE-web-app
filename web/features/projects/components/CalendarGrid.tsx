'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { TaskDrawer, type Assignable } from './TaskDrawer';
import type { MyTaskRow, OnsiteBlock } from '@/features/projects/queries';

interface Props {
  year: number;
  month: number;  // 1..12
  tasks: MyTaskRow[];
  blocks: OnsiteBlock[];
  assignableUsers: Assignable[];
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function pad(n: number): string { return String(n).padStart(2, '0'); }

// Chip tone by task state.
function chipTone(t: MyTaskRow, isPast: boolean): string {
  if (t.status === 'done') return 'bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-fg)]';
  if (isPast) return 'bg-[var(--color-status-declined-bg)] text-[var(--color-status-declined-fg)]';
  return 'bg-[var(--color-status-submitted-bg)] text-[var(--color-status-submitted-fg)]';
}

// Rotate through a small palette when the project has no accent_color.
const FALLBACK_COLORS = ['#2A5D8A', '#B5651D', '#2E7D52', '#9A7012', '#B23A2E', '#3D3B37'];
function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

export function CalendarGrid({ year, month, tasks, blocks, assignableUsers }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const today = todayISO();

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

  // For each ISO date, list on-site windows that include it. Same block
  // recurs across every day of its span. Colour comes from accent or a
  // stable fallback keyed off project id.
  const blocksByDate = useMemo(() => {
    const m = new Map<string, OnsiteBlock[]>();
    for (const b of blocks) {
      const start = new Date(b.onsite_start);
      const end = new Date(b.onsite_end);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const arr = m.get(iso) ?? [];
        arr.push(b);
        m.set(iso, arr);
      }
    }
    return m;
  }, [blocks]);

  function colorFor(b: OnsiteBlock): string {
    if (b.accent_color) return b.accent_color;
    // stable hash → palette index
    let h = 0;
    for (let i = 0; i < b.project_id.length; i++) h = (h * 31 + b.project_id.charCodeAt(i)) | 0;
    return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
  }

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const dow = (first.getDay() + 6) % 7;
    const start = new Date(year, month - 1, 1 - dow);
    const out: Array<{ iso: string; day: number; inMonth: boolean; weekday: number }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      out.push({ iso, day: d.getDate(), inMonth: d.getMonth() + 1 === month, weekday: (d.getDay() + 6) % 7 });
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
            const dayBlocks = blocksByDate.get(c.iso) ?? [];
            const isToday = c.iso === today;
            const isPast = c.iso < today;
            return (
              <div
                key={i}
                className={[
                  'min-h-[110px] border-r border-b border-[var(--color-border-soft)] p-1.5',
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

                {/* On-site blocks — colored bars. Label only on the block's
                    first day OR the first day of the week (Monday) to keep
                    the block continuous visually when it wraps rows. */}
                <ul className="mt-1 space-y-0.5">
                  {dayBlocks.slice(0, 3).map((b) => {
                    const isFirstDay = c.iso === b.onsite_start;
                    const isFirstOfWeek = c.weekday === 0;
                    const showLabel = isFirstDay || isFirstOfWeek;
                    return (
                      <li key={`${b.project_id}-${c.iso}`}>
                        <Link
                          href={`/projects/${b.project_number}`}
                          title={`${b.project_number} · ${b.scope} — on-site ${b.onsite_start} → ${b.onsite_end}\nTeam: ${b.team.map((m) => m.full_name).join(', ') || '—'}`}
                          className="block rounded px-1.5 py-0.5 text-[10px] leading-tight truncate text-white hover:opacity-80"
                          style={{ background: colorFor(b) }}
                        >
                          {showLabel ? (
                            <span>
                              <span className="font-mono">{b.project_number}</span>
                              {' · '}
                              {b.team.length > 0 ? b.team.slice(0, 3).map((m) => initials(m.full_name)).join(' ') : (b.client_name ?? b.scope)}
                            </span>
                          ) : (
                            <span aria-hidden>&nbsp;</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                  {dayBlocks.length > 3 ? (
                    <li className="text-[10px] text-[var(--color-text-muted)] px-1.5">+{dayBlocks.length - 3} on-site</li>
                  ) : null}
                </ul>

                {/* Task chips */}
                <ul className="mt-1 space-y-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
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
                  {dayTasks.length > 3 ? (
                    <li className="text-[10px] text-[var(--color-text-muted)] px-1.5">+{dayTasks.length - 3} tasks</li>
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
