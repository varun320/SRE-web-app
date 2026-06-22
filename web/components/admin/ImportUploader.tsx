'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { ImportMode } from '@/lib/admin/import';

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
}

interface Props {
  mode: ImportMode;
  employees: Employee[];
  onSubmit: (args: { file: File; employee_code?: string }) => void;
  isPending: boolean;
}

export function ImportUploader({ mode, employees, onSubmit, isPending }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [employeeCode, setEmployeeCode] = useState<string>('');

  const accept = mode === 'balances' ? '.csv,text/csv' : '.xlsx';
  const needsEmployee = mode === 'history';
  const canSubmit = !!file && (!needsEmployee || !!employeeCode) && !isPending;

  const handleSubmit = () => {
    if (!file) return;
    onSubmit({ file, employee_code: needsEmployee ? employeeCode : undefined });
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-5 space-y-4">
      <Helper mode={mode} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="import-file">
            File <span className="text-[var(--color-text-muted)]">({mode === 'balances' ? '.csv' : '.xlsx'})</span>
          </Label>
          <input
            id="import-file"
            ref={fileRef}
            type="file"
            accept={accept}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-[var(--color-accent)] file:text-white file:cursor-pointer file:font-medium hover:file:opacity-90"
          />
          {file ? (
            <p className="text-xs text-[var(--color-text-muted)] truncate">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
          ) : null}
        </div>

        {needsEmployee ? (
          <div className="space-y-1.5">
            <Label htmlFor="import-employee">Employee</Label>
            <select
              id="import-employee"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              <option value="">Select an employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.employee_code}>
                  {e.employee_code} — {e.full_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
          <Upload className="h-4 w-4 mr-1.5" />
          {isPending ? 'Analyzing…' : 'Dry-run plan'}
        </Button>
      </div>
    </div>
  );
}

function Helper({ mode }: { mode: ImportMode }) {
  if (mode === 'balances') {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Upload a CSV with columns:{' '}
        <code className="text-xs font-mono bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">
          employee_code,position,til_opening_hrs,vacation_opening_hrs,as_of_date
        </code>
        . One row per employee. Creates a frozen ledger row at{' '}
        <code className="text-xs font-mono">as_of_date − 7 days</code> so the first real week
        carries forward correctly.
      </p>
    );
  }
  return (
    <p className="text-sm text-[var(--color-text-muted)]">
      Upload one employee&apos;s historical timesheet workbook (.xlsx). Lands directly as{' '}
      <strong>approved</strong> with an <code className="font-mono text-xs">imported</code>{' '}
      entry in the approval log. Re-uploading the same file is a no-op.
    </p>
  );
}
