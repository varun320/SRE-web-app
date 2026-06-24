'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
}

interface Props {
  employees: Employee[];
  selected?: string;
}

export function EmployeePicker({ employees, selected }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const onChange = (value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set('user_id', value);
    else params.delete('user_id');
    start(() => router.push(`?${params.toString()}`));
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="emp" className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
        Employee
      </label>
      <select
        id="emp"
        defaultValue={selected ?? ''}
        disabled={pending}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
      >
        <option value="">Select an employee…</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.employee_code} — {e.full_name}
          </option>
        ))}
      </select>
    </div>
  );
}
