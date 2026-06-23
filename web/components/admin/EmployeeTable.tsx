import Link from 'next/link';

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
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 text-sm text-[var(--color-text-muted)]">
        No employees yet. Click <strong>Add employee</strong> to create one.
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
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
            <tr key={r.id} className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40 transition-colors">
              <td className="px-4 py-3 font-mono">{r.employee_code}</td>
              <td className="px-4 py-3"><Link className="text-[var(--color-accent)] hover:underline" href={`/admin/employees/${r.id}`}>{r.full_name}</Link></td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.email}</td>
              <td className="px-4 py-3">{r.department ?? '—'}</td>
              <td className="px-4 py-3">{r.is_active ? 'Active' : 'Inactive'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
