'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';

export type WeekStatus = 'draft' | 'submitted' | 'approved' | 'declined';

export interface WeekRow {
  id: string;
  user_id: string;
  full_name: string;
  employee_code: string;
  week_start: string;
  status: WeekStatus;
  locked: boolean;
  submitted_at: string | null;
  decided_at: string | null;
  decline_reason: string | null;
  total_hrs: number;
  overtime_earned: number;
}

const ORDER: WeekStatus[] = ['draft', 'submitted', 'approved', 'declined'];

const STATUS_TONE: Record<WeekStatus, 'muted' | 'info' | 'success' | 'danger'> = {
  draft: 'muted',
  submitted: 'info',
  approved: 'success',
  declined: 'danger',
};

const STATUS_LABEL: Record<WeekStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  declined: 'Declined',
};

export function AllWeeksTable({ rows }: { rows: WeekRow[] }) {
  const [enabled, setEnabled] = useState<Set<WeekStatus>>(new Set(ORDER));
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const c: Record<WeekStatus, number> = { draft: 0, submitted: 0, approved: 0, declined: 0 };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!enabled.has(r.status)) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.employee_code.toLowerCase().includes(q) ||
        r.week_start.includes(q) ||
        (r.decline_reason ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, enabled, query]);

  const toggle = (s: WeekStatus) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {ORDER.map((s) => {
            const tone = STATUS_TONE[s];
            const dim = !enabled.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                aria-pressed={!dim}
                className="transition-opacity"
                style={{ opacity: dim ? 0.45 : 1 }}
              >
                <StatusBadge tone={tone}>
                  {STATUS_LABEL[s]} <span className="ml-1 opacity-70">({counts[s]})</span>
                </StatusBadge>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <input
            type="search"
            placeholder="Search employee, week, reason…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full md:w-72 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-3 py-1.5 text-sm placeholder:text-[var(--color-text-muted)]"
          />
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Showing <span className="font-medium text-[var(--color-text)]">{filtered.length}</span> of {rows.length} weeks
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 text-sm text-center text-[var(--color-text-muted)]">
          No weeks match the current filters.
        </div>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
                <tr>
                  <th className="text-left px-4 py-2.5 font-normal">Employee</th>
                  <th className="text-left px-4 py-2.5 font-normal">Week</th>
                  <th className="text-left px-4 py-2.5 font-normal">Status</th>
                  <th className="text-right px-4 py-2.5 font-normal">Hours</th>
                  <th className="text-right px-4 py-2.5 font-normal">Overtime</th>
                  <th className="text-left px-4 py-2.5 font-normal">Last action</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/employees/${r.user_id}/week/${r.week_start}`} className="hover:underline">
                        <div className="font-medium">{r.full_name}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)] font-mono">{r.employee_code}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.week_start}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusBadge>
                      {r.locked ? <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">· locked</span> : null}
                      {r.status === 'declined' && r.decline_reason ? (
                        <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)] truncate max-w-[180px]" title={r.decline_reason}>
                          {r.decline_reason}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{r.total_hrs.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {r.overtime_earned > 0 ? (
                        <span className="text-amber-700 dark:text-amber-300 font-medium">{r.overtime_earned.toFixed(2)}</span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">0.00</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)] font-mono whitespace-nowrap">
                      {relTime(r.decided_at ?? r.submitted_at)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/employees/${r.user_id}/week/${r.week_start}`}
                        className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const m = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}
