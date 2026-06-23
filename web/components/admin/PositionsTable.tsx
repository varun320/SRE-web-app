'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updatePositionVacation } from '@/app/(app)/admin/positions/actions';
import { toast } from 'sonner';

interface Row { id: string; name: string; annual_vacation_hours: number; }

export function PositionsTable({ rows }: { rows: Row[] }) {
  const [pending, start] = useTransition();
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
              <td className="px-4 py-3">{p.name}</td>
              <td className="px-4 py-3">
                <form action={(fd) => start(async () => {
                  const res = await updatePositionVacation(fd);
                  if (res?.error) toast.error(res.error);
                  else toast.success('Saved');
                })} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <Input name="annual_vacation_hours" type="number" step="0.25" defaultValue={p.annual_vacation_hours} className="w-32" />
                  <Button type="submit" variant="outline" size="sm" disabled={pending}>Save</Button>
                </form>
              </td>
              <td className="px-4 py-3"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
