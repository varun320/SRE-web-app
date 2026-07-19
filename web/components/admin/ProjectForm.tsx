'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createProject } from '@/app/(app)/admin/projects/actions';
import { toast } from 'sonner';

export function ProjectForm() {
  const [pending, start] = useTransition();
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
      <header className="mb-4">
        <h3 className="text-sm font-medium text-[var(--color-text)]">Add project</h3>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          Numbers descend by default so the newest project sits at the top.
        </p>
      </header>
      <form
        action={(fd) => start(async () => {
          const res = await createProject(fd);
          if (res?.error) toast.error(res.error);
          else toast.success('Project added');
        })}
        className="flex flex-col sm:flex-row sm:items-end gap-3"
      >
        <div className="w-full sm:w-40 space-y-1.5">
          <Label htmlFor="project_number" className="text-xs font-medium">Project #</Label>
          <Input id="project_number" name="project_number" type="number" placeholder="2026101" required className="tabular-nums" />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="name" className="text-xs font-medium">Name</Label>
          <Input id="name" name="name" required placeholder="Descriptive project name" />
        </div>
        <Button type="submit" disabled={pending} className="sm:mb-0">
          {pending ? 'Adding…' : 'Add project'}
        </Button>
      </form>
    </section>
  );
}
