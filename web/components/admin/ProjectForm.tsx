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
    <form
      action={(fd) => start(async () => {
        const res = await createProject(fd);
        if (res?.error) toast.error(res.error);
        else toast.success('Project added');
      })}
      className="flex items-end gap-2"
    >
      <div className="max-w-xs"><Label htmlFor="project_number">Project #</Label><Input id="project_number" name="project_number" type="number" placeholder="2026101" required /></div>
      <div className="flex-1"><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></div>
      <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add project'}</Button>
    </form>
  );
}
