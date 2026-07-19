'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { SearchInput } from '@/components/ui/search-input';

interface Row {
  id: string;
  full_name: string;
  email: string;
  employee_code: string;
  department: string | null;
  is_active: boolean;
}

export function EmployeeTable({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.full_name.toLowerCase().includes(q)
      || r.email.toLowerCase().includes(q)
      || r.employee_code.toLowerCase().includes(q)
      || (r.department ?? '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={UserPlus}
        title="No employees yet"
        description={<>Click <strong>Add employee</strong> to create the first one.</>}
      />
    );
  }

  return (
    <div className="space-y-3">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by name, email, code, or department"
        className="max-w-sm"
      />
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={r.is_active ? '' : 'opacity-60'}>
                  <td className="font-mono">{r.employee_code}</td>
                  <td>
                    <Link className="text-[var(--color-accent)] hover:underline font-medium" href={`/admin/employees/${r.id}`}>
                      {r.full_name}
                    </Link>
                  </td>
                  <td className="col-muted">{r.email}</td>
                  <td>{r.department ?? '—'}</td>
                  <td>
                    <StatusBadge tone={r.is_active ? 'success' : 'muted'}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-sm text-[var(--color-text-muted)] py-6">
                    No employees match “{query}”.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
