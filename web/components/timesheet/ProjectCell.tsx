'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Project } from '@/lib/types';

interface Props {
  projectId: string | null;
  required: boolean;
  projects: readonly Project[];
  onChange: (id: string | null) => void;
  disabled?: boolean;
}

export function ProjectCell({ projectId, required, projects, onChange, disabled }: Props) {
  if (!required) {
    return <span className="text-[var(--color-text-muted)] text-sm">—</span>;
  }
  return (
    <Select
      value={projectId ?? undefined}
      onValueChange={(v) => onChange(v)}
      disabled={disabled}
    >
      <SelectTrigger className="h-9 w-40 font-mono"><SelectValue placeholder="Project #" /></SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="font-mono">{p.project_number}</span> — {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
