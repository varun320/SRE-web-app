'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { setProjectStatus } from '@/app/(app)/admin/projects/actions';

interface Row { id: string; project_number: number; name: string; status: 'active' | 'closed'; }

export function ProjectsTable({ rows }: { rows: Row[] }) {
  const [pending, start] = useTransition();
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 text-sm text-[var(--color-text-muted)]">
        No projects yet. Add one above.
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
          <tr>
            <th className="text-left px-4 py-3 font-normal">Number</th>
            <th className="text-left px-4 py-3 font-normal">Name</th>
            <th className="text-left px-4 py-3 font-normal">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-[var(--color-border-soft)]">
              <td className="px-4 py-3 font-mono">{p.project_number}</td>
              <td className="px-4 py-3">{p.name}</td>
              <td className="px-4 py-3">{p.status}</td>
              <td className="px-4 py-3 text-right">
                <form action={(fd) => start(async () => { await setProjectStatus(fd); })}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value={p.status === 'active' ? 'closed' : 'active'} />
                  <Button type="submit" variant="outline" size="sm" disabled={pending}>
                    {p.status === 'active' ? 'Close' : 'Re-open'}
                  </Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
