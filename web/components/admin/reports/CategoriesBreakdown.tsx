'use client';

import { useState } from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import type { CategoryBreakdown } from '@/lib/admin/reports/categories';
import { EmptyState } from '@/components/ui/empty-state';

interface Props {
  rows: CategoryBreakdown[];
  downloadHref: string;
}

export function CategoriesBreakdown({ rows, downloadHref }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No approved hours in this range"
        description="Approve some timesheets, or widen the date range."
      />
    );
  }

  const grandTotal = rows.reduce((sum, r) => sum + r.total_hrs, 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">{rows.length}</span>{' '}
          <span className="text-[var(--color-text-muted)]">main categor{rows.length === 1 ? 'y' : 'ies'} · </span>
          <span className="font-mono tabular-nums">{grandTotal.toFixed(2)}</span>
          <span className="text-[var(--color-text-muted)]"> total hours</span>
        </div>
        <a
          href={downloadHref}
          className="inline-flex items-center rounded-md bg-[var(--color-accent)] text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Download CSV
        </a>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] divide-y divide-[var(--color-border-soft)]">
        {rows.map((c) => (
          <CategoryRow key={c.main_category} category={c} grandTotal={grandTotal} />
        ))}
      </div>
    </section>
  );
}

function CategoryRow({ category, grandTotal }: { category: CategoryBreakdown; grandTotal: number }) {
  const [open, setOpen] = useState(true);
  const pct = grandTotal > 0 ? (category.total_hrs / grandTotal) * 100 : 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-surface-2)]/40 transition-colors"
      >
        <ChevronRight
          className={`h-4 w-4 text-[var(--color-text-muted)] shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium">{category.main_category}</div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden">
            <div className="h-full bg-[var(--color-accent)]" style={{ width: `${pct.toFixed(1)}%` }} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono tabular-nums text-sm">
            {category.total_hrs.toFixed(2)}
            <span className="text-[var(--color-text-muted)] text-xs ml-0.5">h</span>
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
            {pct.toFixed(1)}% of total
          </div>
        </div>
      </button>

      {open ? (
        <ul className="bg-[var(--color-surface-2)]/30 border-t border-[var(--color-border-soft)] divide-y divide-[var(--color-border-soft)]">
          {category.by_sub.map((s) => {
            const subPct = category.total_hrs > 0 ? (s.hrs / category.total_hrs) * 100 : 0;
            return (
              <li key={s.sub_category} className="px-4 py-2 pl-11 flex items-center justify-between text-sm gap-3">
                <span className="truncate">{s.sub_category}</span>
                <span className="flex items-baseline gap-2 shrink-0">
                  <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">{subPct.toFixed(1)}%</span>
                  <span className="font-mono tabular-nums text-[var(--color-text-muted)]">{s.hrs.toFixed(2)}h</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
