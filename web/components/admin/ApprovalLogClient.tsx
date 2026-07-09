'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

export interface ApprovalLogRow {
  id: number;
  action: string;
  at: string;
  comment: string | null;
  employee: string;
  employee_code: string;
  week_start: string;
  status: string;
  locked: boolean;
  actor: string;
  user_id: string;
  total_hrs: number | null;
  overtime_earned: number | null;
  til_used: number | null;
  vacation_used: number | null;
}

const ACTION_LABEL: Record<string, string> = {
  submit: 'Submitted',
  approve: 'Approved',
  decline: 'Declined',
  unlock: 'Unlocked',
  imported: 'Imported',
  ledger_recompute: 'Ledger recomputed',
};

const ACTION_STYLE: Record<string, string> = {
  submit:
    'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/30',
  approve:
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  decline:
    'bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/30',
  unlock:
    'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  imported:
    'bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/30',
  ledger_recompute:
    'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] ring-[var(--color-border)]',
};

const ACTIONS = ['submit', 'approve', 'decline', 'unlock', 'imported', 'ledger_recompute'] as const;

export function ApprovalLogClient({ rows }: { rows: ApprovalLogRow[] }) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(ACTIONS));
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const c: Record<string, number> = Object.fromEntries(ACTIONS.map((a) => [a, 0]));
    for (const r of rows) c[r.action] = (c[r.action] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!enabled.has(r.action)) return false;
      if (!q) return true;
      return (
        r.employee.toLowerCase().includes(q) ||
        r.employee_code.toLowerCase().includes(q) ||
        r.actor.toLowerCase().includes(q) ||
        r.week_start.includes(q) ||
        (r.comment ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, enabled, query]);

  const toggle = (action: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {ACTIONS.map((a) => (
          <Stat key={a} action={a} count={counts[a]} />
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {ACTIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggle(a)}
              aria-pressed={enabled.has(a)}
              className={[
                'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-opacity',
                enabled.has(a) ? ACTION_STYLE[a] : 'opacity-40 ' + ACTION_STYLE[a],
              ].join(' ')}
            >
              {ACTION_LABEL[a]}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <input
            type="search"
            placeholder="Search employee, week, comment…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full md:w-80 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-3 py-1.5 text-sm placeholder:text-[var(--color-text-muted)]"
          />
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Showing <span className="font-medium text-[var(--color-text)]">{filtered.length}</span> of {rows.length} events
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <Empty />
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
                <tr>
                  <th className="text-left px-3 py-2.5 font-normal">When</th>
                  <th className="text-left px-3 py-2.5 font-normal">Action</th>
                  <th className="text-left px-3 py-2.5 font-normal">Employee</th>
                  <th className="text-left px-3 py-2.5 font-normal">Week</th>
                  <th className="text-left px-3 py-2.5 font-normal">Totals</th>
                  <th className="text-left px-3 py-2.5 font-normal">Actor</th>
                  <th className="text-left px-3 py-2.5 font-normal">Note</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <Row key={r.id} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ action, count }: { action: string; count: number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3">
      <div
        className={[
          'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset',
          ACTION_STYLE[action],
        ].join(' ')}
      >
        {ACTION_LABEL[action]}
      </div>
      <div className="mt-1 text-h1 tabular-nums">{count}</div>
    </div>
  );
}

function Row({ r }: { r: ApprovalLogRow }) {
  const when = new Date(r.at);
  const whenIso = when.toISOString().replace('T', ' ').slice(0, 16);
  const rel = relativeTime(when);

  return (
    <tr className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/30">
      <td className="px-3 py-3 align-top">
        <div className="font-mono text-xs text-[var(--color-text)]">{whenIso}</div>
        <div className="text-[10px] text-[var(--color-text-muted)]">{rel}</div>
      </td>
      <td className="px-3 py-3 align-top">
        <span
          className={[
            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
            ACTION_STYLE[r.action] ?? '',
          ].join(' ')}
        >
          {ACTION_LABEL[r.action] ?? r.action}
        </span>
        {r.status ? (
          <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
            now: {r.status}
            {r.locked ? ' · locked' : ''}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-3 align-top">
        {r.user_id && r.week_start ? (
          <Link
            href={`/admin/employees/${r.user_id}/week/${r.week_start}`}
            className="hover:underline"
          >
            <span className="font-medium">{r.employee}</span>{' '}
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
              ({r.employee_code})
            </span>
          </Link>
        ) : (
          <span>
            {r.employee}{' '}
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
              ({r.employee_code})
            </span>
          </span>
        )}
      </td>
      <td className="px-3 py-3 align-top font-mono text-xs">{r.week_start || '—'}</td>
      <td className="px-3 py-3 align-top">
        {r.total_hrs !== null ? (
          <div className="text-xs space-y-0.5">
            <div>
              <span className="text-[var(--color-text-muted)]">total </span>
              <span className="font-medium tabular-nums">{fmt(r.total_hrs)}h</span>
              {r.overtime_earned ? (
                <>
                  <span className="text-[var(--color-text-muted)]"> · OT </span>
                  <span className="font-medium tabular-nums">{fmt(r.overtime_earned)}h</span>
                </>
              ) : null}
            </div>
            {r.til_used || r.vacation_used ? (
              <div className="text-[10px] text-[var(--color-text-muted)]">
                {r.til_used ? <>TIL {fmt(r.til_used)}h</> : null}
                {r.til_used && r.vacation_used ? ' · ' : null}
                {r.vacation_used ? <>vac {fmt(r.vacation_used)}h</> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="text-[var(--color-text-muted)]">—</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">{r.actor}</td>
      <td className="px-3 py-3 align-top max-w-xs">
        <div className="text-[var(--color-text-muted)] text-xs break-words">
          {r.comment ?? '—'}
        </div>
      </td>
    </tr>
  );
}

function Empty() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 text-sm text-[var(--color-text-muted)]">
      No events match the current filters. Adjust filters or clear the search to see more.
    </div>
  );
}

function fmt(n: number): string {
  return Number(n).toFixed(n % 1 === 0 ? 0 : 1);
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
