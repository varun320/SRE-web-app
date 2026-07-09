import { Button } from '@/components/ui/button';
import type { ImportPlanSummary } from '@/lib/admin/import';

interface Props {
  summary: ImportPlanSummary;
  onCommit: () => void;
  onCancel: () => void;
  isCommitting: boolean;
}

export function ImportConfirmBar({ summary, onCommit, onCancel, isCommitting }: Props) {
  const { create, conflict } = summary.counts;
  const blocked = conflict > 0 || create === 0;

  return (
    <div className="sticky bottom-0 -mx-3 md:-mx-4 px-3 md:px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-[var(--color-text-muted)]">
        {conflict > 0 ? (
          <span className="text-[var(--color-status-declined-fg)] font-medium">
            {conflict} conflict{conflict === 1 ? '' : 's'} must be resolved before commit
          </span>
        ) : create === 0 ? (
          <span>Nothing to apply</span>
        ) : (
          <>
            About to apply <span className="font-medium text-[var(--color-text)]">{create}</span>{' '}
            row{create === 1 ? '' : 's'}. This writes to the database in one transaction.
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isCommitting}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onCommit}
          disabled={blocked || isCommitting}
        >
          {isCommitting ? 'Committing…' : 'Commit import'}
        </Button>
      </div>
    </div>
  );
}
