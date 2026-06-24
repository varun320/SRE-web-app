'use client';

import { useState } from 'react';
import { ArrowUpDown, Snowflake } from 'lucide-react';
import type { BalanceRow } from '@/lib/admin/reports/balances';
import { EmptyState } from '@/components/ui/empty-state';

type SortKey = 'employee_code' | 'full_name' | 'til_closing' | 'vacation_closing';

interface Props {
  rows: BalanceRow[];
  downloadHref: string;
}

export function BalancesTable({ rows, downloadHref }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'employee_code',
    dir: 'asc',
  });

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (typeof av === 'number' && typeof bv === 'number') {
      return sort.dir === 'asc' ? av - bv : bv - av;
    }
    const as = String(av ?? '');
    const bs = String(bv ?? '');
    return sort.dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
  });

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Snowflake}
        title="No active employees"
        description="Add employees on the Employees tab; their opening balances will appear here once seeded."
      />
    );
  }

  const totals = rows.reduce(
    (a, r) => ({ til: a.til + r.til_closing, vac: a.vac + r.vacation_closing }),
    { til: 0, vac: 0 },
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">{rows.length}</span>{' '}
          <span className="text-[var(--color-text-muted)]">active employee{rows.length === 1 ? '' : 's'} · </span>
          <span className="font-mono tabular-nums">{totals.til.toFixed(2)}</span>
          <span className="text-[var(--color-text-muted)]"> TIL · </span>
          <span className="font-mono tabular-nums">{totals.vac.toFixed(2)}</span>
          <span className="text-[var(--color-text-muted)]"> vacation (org-wide)</span>
        </div>
        <a
          href={downloadHref}
          className="inline-flex items-center rounded-md bg-[var(--color-accent)] text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Download CSV
        </a>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
              <tr>
                <Th label="Code"      sortKey="employee_code"    sort={sort} setSort={setSort} />
                <Th label="Name"      sortKey="full_name"        sort={sort} setSort={setSort} />
                <th className="text-left px-3 py-2.5 font-normal">Position</th>
                <Th label="TIL"       sortKey="til_closing"      sort={sort} setSort={setSort} align="right" />
                <Th label="Vacation"  sortKey="vacation_closing" sort={sort} setSort={setSort} align="right" />
                <th className="text-left px-3 py-2.5 font-normal">As of</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.user_id} className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40">
                  <td className="px-3 py-2.5 font-mono text-xs">{r.employee_code}</td>
                  <td className="px-3 py-2.5">{r.full_name}</td>
                  <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{r.position ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.til_closing.toFixed(2)}</td>
                  <td className={[
                    'px-3 py-2.5 text-right font-mono tabular-nums',
                    r.vacation_closing < 8 ? 'text-red-700 dark:text-red-300 font-medium' : '',
                  ].join(' ')}>
                    {r.vacation_closing.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--color-text-muted)] font-mono">
                    {r.til_week ?? r.vacation_week ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Th({
  label,
  sortKey,
  sort,
  setSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  setSort: (s: { key: SortKey; dir: 'asc' | 'desc' }) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.key === sortKey;
  return (
    <th className={`px-3 py-2.5 font-normal text-${align}`}>
      <button
        type="button"
        onClick={() =>
          setSort({
            key: sortKey,
            dir: active && sort.dir === 'asc' ? 'desc' : 'asc',
          })
        }
        className={[
          'inline-flex items-center gap-1 transition-colors',
          active ? 'text-[var(--color-text)]' : 'hover:text-[var(--color-text)]',
        ].join(' ')}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
      </button>
    </th>
  );
}
