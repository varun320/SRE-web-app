'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createPosition } from '@/app/(app)/admin/positions/actions';
import { toast } from 'sonner';

export function PositionForm() {
  const [pending, start] = useTransition();
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
      <header className="mb-4">
        <h3 className="text-sm font-medium text-[var(--color-text)]">Add position</h3>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          Vacation hours here become the default when a new employee is assigned this position.
        </p>
      </header>
      <form
        action={(fd) => start(async (): Promise<void> => {
          const res = await createPosition(fd);
          if (res?.error) toast.error(res.error);
          else toast.success('Position added');
        })}
        className="flex flex-col sm:flex-row sm:items-end gap-3"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="pos_name" className="text-xs font-medium">Name</Label>
          <Input id="pos_name" name="name" required placeholder="e.g. Senior Engineer" />
        </div>
        <div className="w-full sm:w-44 space-y-1.5">
          <Label htmlFor="pos_hrs" className="text-xs font-medium">Annual vacation hrs</Label>
          <Input id="pos_hrs" name="annual_vacation_hours" type="number" step="0.25" min="0" defaultValue="120" className="tabular-nums" />
        </div>
        <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add position'}</Button>
      </form>
    </section>
  );
}
