'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

interface Project {
  id: string;
  project_number: number;
  name: string;
  status: string;
}

interface Props {
  projects: Project[];
  selected?: string;
}

export function ProjectFilter({ projects, selected }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const onChange = (value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set('project_id', value);
    else params.delete('project_id');
    start(() => router.push(`?${params.toString()}`));
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="proj" className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
        Project
      </label>
      <select
        id="proj"
        defaultValue={selected ?? ''}
        disabled={pending}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
      >
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.project_number} — {p.name}
            {p.status === 'closed' ? ' (closed)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
