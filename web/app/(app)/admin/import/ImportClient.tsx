'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  postCommit,
  postDryRun,
  type ImportDryRunResponse,
  type ImportMode,
} from '@/lib/admin/import';
import { ImportUploader } from '@/components/admin/ImportUploader';
import { ImportDiffTable } from '@/components/admin/ImportDiffTable';
import { ImportConfirmBar } from '@/components/admin/ImportConfirmBar';

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
}

interface Props {
  employees: Employee[];
}

const TABS: { mode: ImportMode; label: string }[] = [
  { mode: 'balances', label: 'Opening balances' },
  { mode: 'history', label: 'Historical week' },
];

export function ImportClient({ employees }: Props) {
  const [mode, setMode] = useState<ImportMode>('balances');
  const [plan, setPlan] = useState<ImportDryRunResponse | null>(null);

  const dryRun = useMutation({
    mutationFn: postDryRun,
    onSuccess: (data) => {
      setPlan(data);
      const { create, conflict } = data.summary.counts;
      if (conflict > 0) toast.warning(`Plan has ${conflict} conflict(s)`);
      else if (create === 0) toast.message('Nothing to apply');
      else toast.success(`Plan ready: ${create} to apply`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const commit = useMutation({
    mutationFn: postCommit,
    onSuccess: (res) => {
      toast.success(`Committed: ${res.applied} applied, ${res.skipped} skipped`);
      setPlan(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const switchMode = (next: ImportMode) => {
    setMode(next);
    setPlan(null);
  };

  return (
    <div className="space-y-5">
      <nav role="tablist" className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
        {TABS.map((t) => (
          <button
            key={t.mode}
            type="button"
            role="tab"
            aria-selected={mode === t.mode}
            onClick={() => switchMode(t.mode)}
            className={[
              'px-3 py-1.5 text-sm rounded transition-colors',
              mode === t.mode
                ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <ImportUploader
        mode={mode}
        employees={employees}
        onSubmit={({ file, employee_code }) =>
          dryRun.mutate({ file, mode, employee_code })
        }
        isPending={dryRun.isPending}
      />

      {plan ? (
        <>
          <ImportDiffTable items={plan.items} summary={plan.summary} />
          <ImportConfirmBar
            summary={plan.summary}
            onCommit={() => commit.mutate(plan.batch_id)}
            onCancel={() => setPlan(null)}
            isCommitting={commit.isPending}
          />
        </>
      ) : null}
    </div>
  );
}
