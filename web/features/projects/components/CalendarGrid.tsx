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
function colorFor(b: OnsiteBlock): string {
  if (b.accent_color) return b.accent_color;
  let h = 0;
  for (let i = 0; i < b.project_id.length; i++) h = (h * 31 + b.project_id.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
}

interface Cell { iso: string; day: number; inMonth: boolean; date: Date }
interface BlockSegment {
  block: OnsiteBlock;
  startCol: number;   // 0..6
  span: number;       // 1..7
  isBlockStart: boolean;  // true if this segment starts on the block's actual start (not just Monday wrap)
  isBlockEnd: boolean;    // true if this segment ends on the block's actual end (not just Sunday wrap)
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

  // 6 weeks × 7 days, Monday-anchored.
  const weeks = useMemo<Cell[][]>(() => {
    const first = new Date(year, month - 1, 1);
    const dow = (first.getDay() + 6) % 7;
    const start = new Date(year, month - 1, 1 - dow);
    const out: Cell[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        row.push({ iso, day: date.getDate(), inMonth: date.getMonth() + 1 === month, date });
      }
      out.push(row);
    }
    return out;
  }, [year, month]);

  // For each week row, compute continuous block segments (clipped to that
  // week). A block that spans multiple weeks appears as multiple segments,
  // one per week, each with its own grid-column start/span.
  const segmentsByWeek = useMemo<BlockSegment[][]>(() => {
    return weeks.map((week) => {
      const weekStart = week[0].date;
      const weekEnd = week[6].date;
      const segs: BlockSegment[] = [];
      for (const b of blocks) {
        const bStart = new Date(b.onsite_start);
        const bEnd = new Date(b.onsite_end);
        // Skip blocks that don't overlap this week
        if (bEnd < weekStart || bStart > weekEnd) continue;
        const clipStart = bStart < weekStart ? weekStart : bStart;
        const clipEnd = bEnd > weekEnd ? weekEnd : bEnd;
        const startCol = Math.round((clipStart.getTime() - weekStart.getTime()) / 86_400_000);
        const span = Math.round((clipEnd.getTime() - clipStart.getTime()) / 86_400_000) + 1;
        segs.push({
          block: b,
          startCol,
          span,
          isBlockStart: clipStart.getTime() === bStart.getTime(),
          isBlockEnd: clipEnd.getTime() === bEnd.getTime(),
        });
      }
      // Sort by start column, then by project id for stable stacking.
      return segs.sort((a, b) => a.startCol - b.startCol || a.block.project_id.localeCompare(b.block.project_id));
    });
  }, [weeks, blocks]);

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

        {weeks.map((week, wi) => {
          const segs = segmentsByWeek[wi];
          return (
            <div key={wi} className="relative">
              {/* Day cells */}
              <div className="grid grid-cols-7">
                {week.map((c, ci) => {
                  const dayTasks = byDate.get(c.iso) ?? [];
                  const isToday = c.iso === today;
                  const isPast = c.iso < today;
                  return (
                    <div
                      key={ci}
                      className={[
                        'min-h-[120px] border-r border-b border-[var(--color-border-soft)] p-1.5',
                        c.inMonth ? '' : 'bg-[var(--color-surface-2)]/30 text-[var(--color-text-muted)]',
                        ci === 6 ? 'border-r-0' : '',
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

                      {/* Reserve vertical space for the block-bar overlay so
                          task chips don't sit under it. Height matches
                          rowGap + (rowHeight * maxStack). Simpler: leave a
                          fixed gap regardless. */}
                      <div style={{ height: `${segs.length * 22}px` }} aria-hidden />

                      {/* Task chips */}
                      <ul className="space-y-0.5">
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

              {/* On-site block overlay for this week. Absolutely positioned
                  atop the cell row; uses grid-column-span so a 7-day block
                  renders as a single continuous bar Mon→Sun. */}
              {segs.length > 0 ? (
                <div
                  className="pointer-events-none absolute inset-x-0 grid grid-cols-7"
                  style={{ top: 'calc(1.25rem + 0.375rem + 0.375rem)' /* p-1.5 top + day-pill height + p-1.5 */ }}
                >
                  {segs.map((seg, si) => {
                    const b = seg.block;
                    const teamStr = b.team.length > 0
                      ? b.team.slice(0, 4).map((m) => initials(m.full_name)).join(' ')
                      : (b.client_name ?? '');
                    return (
                      <Link
                        key={`${b.project_id}-${wi}-${si}`}
                        href={`/projects/${b.project_number}`}
                        title={`${b.project_number} · ${b.scope} — on-site ${b.onsite_start} → ${b.onsite_end}\nTeam: ${b.team.map((m) => m.full_name).join(', ') || '—'}`}
                        className={[
                          'pointer-events-auto text-[10px] leading-tight text-white truncate px-1.5 py-0.5 shadow-sm hover:opacity-85',
                          seg.isBlockStart ? 'rounded-l' : '',
                          seg.isBlockEnd ? 'rounded-r' : '',
                        ].join(' ')}
                        style={{
                          gridColumn: `${seg.startCol + 1} / span ${seg.span}`,
                          gridRow: si + 1,
                          background: colorFor(b),
                          marginTop: `${si * 22}px`,
                          marginLeft: seg.isBlockStart ? '2px' : '0',
                          marginRight: seg.isBlockEnd ? '2px' : '0',
                        }}
                      >
                        <span className="font-mono font-medium">{b.project_number}</span>
                        {teamStr ? <span className="ml-1.5 opacity-90">{teamStr}</span> : null}
                        {seg.isBlockStart ? <span className="ml-1.5 opacity-80">· {b.scope}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <TaskDrawer task={openTask} assignableUsers={assignableUsers} onClose={() => setOpenId(null)} />
    </>
  );
}
