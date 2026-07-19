'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updatePosition } from '@/app/(app)/admin/positions/actions';
import { toast } from 'sonner';

interface Row { id: string; name: string; annual_vacation_hours: number; }

export function PositionsTable({ rows }: { rows: Row[] }) {
  const [pending, start] = useTransition();
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 text-sm text-[var(--color-text-muted)]">
        No positions yet. Add one above.
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
          <tr>
            <th className="text-left px-4 py-3 font-normal">Position</th>
            <th className="text-left px-4 py-3 font-normal">Annual vacation hrs</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-[var(--color-border-soft)]">
              <td colSpan={3} className="px-4 py-3">
                <form
                  action={(fd) => start(async () => {
                    const res = await updatePosition(fd);
                    if (res?.error) toast.error(res.error);
                    else toast.success('Saved');
                  })}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-center"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <Input name="name" defaultValue={p.name} aria-label="Position name" />
                  <Input
                    name="annual_vacation_hours"
                    type="number"
                    step="0.25"
                    min="0"
                    defaultValue={p.annual_vacation_hours}
                    aria-label="Annual vacation hours"
                    className="tabular-nums"
                  />
                  <Button type="submit" variant="outline" size="sm" disabled={pending}>Save</Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
