import type { ImportPlanItem, ImportPlanSummary } from '@/lib/admin/import';

interface Props {
  items: ImportPlanItem[];
  summary: ImportPlanSummary;
}

const ACTION_STYLES: Record<ImportPlanItem['action'], string> = {
  create:
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  skip:
    'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] ring-[var(--color-border)]',
  conflict:
    'bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/30',
};

export function ImportDiffTable({ items, summary }: Props) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
      <header className="px-4 py-3 border-b border-[var(--color-border-soft)] flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div className="text-sm font-medium truncate">{summary.source_filename}</div>
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <Pill action="create" count={summary.counts.create} />
          <Pill action="skip" count={summary.counts.skip} />
          <Pill action="conflict" count={summary.counts.conflict} />
          <span>· {summary.total} total</span>
        </div>
      </header>

      {summary.warnings.length > 0 ? (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-xs text-amber-800 dark:text-amber-200">
          <strong className="mr-1">Warnings:</strong>
          {summary.warnings.slice(0, 5).join(' · ')}
          {summary.warnings.length > 5 ? ` (+${summary.warnings.length - 5} more)` : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
            <tr>
              <th className="text-left px-3 py-2 font-normal w-24">Action</th>
              <th className="text-left px-3 py-2 font-normal">Target</th>
              <th className="text-left px-3 py-2 font-normal">Detail / Reason</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-[var(--color-border-soft)]">
                <td className="px-3 py-2">
                  <span
                    className={[
                      'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                      ACTION_STYLES[it.action],
                    ].join(' ')}
                  >
                    {it.action}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{it.target}</td>
                <td className="px-3 py-2 text-[var(--color-text-muted)]">
                  {it.detail || it.reason || '—'}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
                  No plan items.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pill({ action, count }: { action: ImportPlanItem['action']; count: number }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        ACTION_STYLES[action],
      ].join(' ')}
    >
      {action}: {count}
    </span>
  );
}
