'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
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

export interface EmployeeOption {
  id: string;
  employee_code: string;
  full_name: string;
}

export interface AllWeeksFilters {
  status: WeekStatus | 'all';
  userId: string | 'all';
  page: number;
  pageSize: number;
  total: number;
}

interface Props {
  rows: WeekRow[];
  employees: EmployeeOption[];
  filters: AllWeeksFilters;
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

export function AllWeeksTable({ rows, employees, filters }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState('');

  // Search box only filters the current server-paged slice.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.employee_code.toLowerCase().includes(q) ||
        r.week_start.includes(q) ||
        (r.decline_reason ?? '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    // Any filter change resets to page 1
    if (key !== 'page') next.delete('page');
    start(() => router.push(`?${next.toString()}`));
  };

  const totalPages = Math.max(1, Math.ceil(filters.total / filters.pageSize));
  const hasPrev = filters.page > 1;
  const hasNext = filters.page < totalPages;
  const firstOnPage = (filters.page - 1) * filters.pageSize + 1;
  const lastOnPage = Math.min(filters.page * filters.pageSize, filters.total);

  const hasAnyFilter = filters.status !== 'all' || filters.userId !== 'all';

  return (
    <section className="space-y-3">
      {/* Filter row */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Status filter chips (URL-bound) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label="All statuses"
            active={filters.status === 'all'}
            onClick={() => updateParam('status', null)}
          />
          {ORDER.map((s) => (
            <FilterChip
              key={s}
              label={STATUS_LABEL[s]}
              tone={STATUS_TONE[s]}
              active={filters.status === s}
              onClick={() => updateParam('status', filters.status === s ? null : s)}
            />
          ))}
        </div>

        <div className="flex-1" />

        {/* Employee dropdown */}
        <select
          aria-label="Filter by employee"
          value={filters.userId}
          disabled={pending}
          onChange={(e) => updateParam('user_id', e.currentTarget.value === 'all' ? null : e.currentTarget.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
        >
          <option value="all">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.employee_code} — {e.full_name}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <input
            type="search"
            placeholder="Search on this page…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full md:w-56 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-3 py-1.5 text-sm placeholder:text-[var(--color-text-muted)]"
          />
        </div>

        {hasAnyFilter ? (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(sp.toString());
              next.delete('status');
              next.delete('user_id');
              next.delete('page');
              start(() => router.push(`?${next.toString()}`));
            }}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] shrink-0"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        ) : null}
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        {filters.total === 0
          ? 'No weeks match.'
          : <>Showing <span className="font-medium text-[var(--color-text)]">{firstOnPage}–{lastOnPage}</span> of <span className="font-medium text-[var(--color-text)]">{filters.total}</span>{query ? <> · {visible.length} match the search</> : null}</>}
      </p>

      {visible.length === 0 ? (
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
                {visible.map((r) => (
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

      {/* Pagination */}
      {totalPages > 1 ? (
        <nav className="flex items-center justify-between pt-2" aria-label="Pagination">
          <button
            type="button"
            onClick={() => updateParam('page', String(filters.page - 1))}
            disabled={!hasPrev || pending}
            className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
            Page {filters.page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => updateParam('page', String(filters.page + 1))}
            disabled={!hasNext || pending}
            className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </nav>
      ) : null}
    </section>
  );
}

function FilterChip({
  label,
  tone,
  active,
  onClick,
}: {
  label: string;
  tone?: 'muted' | 'info' | 'success' | 'danger';
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="transition-opacity"
      style={{ opacity: active ? 1 : 0.45 }}
    >
      <StatusBadge tone={tone ?? 'neutral'}>{label}</StatusBadge>
    </button>
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
