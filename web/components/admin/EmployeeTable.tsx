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
            {rows.map((r) => (
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
