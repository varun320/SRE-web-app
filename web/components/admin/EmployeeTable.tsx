import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';

interface Row {
  id: string;
  full_name: string;
  email: string;
  employee_code: string;
  department: string | null;
  is_active: boolean;
}

export function EmployeeTable({ rows }: { rows: Row[] }) {
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
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
            <tr>
              <th className="text-left px-4 py-3 font-normal">Code</th>
              <th className="text-left px-4 py-3 font-normal">Name</th>
              <th className="text-left px-4 py-3 font-normal">Email</th>
              <th className="text-left px-4 py-3 font-normal">Department</th>
              <th className="text-left px-4 py-3 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={[
                  'border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40 transition-colors',
                  r.is_active ? '' : 'opacity-60',
                ].join(' ')}
              >
                <td className="px-4 py-3 font-mono">{r.employee_code}</td>
                <td className="px-4 py-3">
                  <Link className="text-[var(--color-accent)] hover:underline font-medium" href={`/admin/employees/${r.id}`}>
                    {r.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.email}</td>
                <td className="px-4 py-3">{r.department ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={r.is_active ? 'success' : 'muted'}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
