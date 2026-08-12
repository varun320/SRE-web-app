'use client';

import Link from 'next/link';
import { Briefcase, ExternalLink } from 'lucide-react';
import { ShowMore } from '@/shared/ui/show-more';
import { StatusBadge } from '@/shared/ui/status-badge';
import { formatDate } from '@/shared/lib/dates';
import { PHASE_LABEL, type ProjectPhase } from '@/features/projects/types';

interface JobRow {
  id: string;
  project_number: number;
  name: string;
  scope_title: string | null;
  status: 'active' | 'closed';
  phase: ProjectPhase;
  deadline: string | null;
  template_id: string | null;
}

function phaseTone(p: ProjectPhase): 'neutral' | 'info' | 'success' {
  return p === 'pre' ? 'neutral' : p === 'during' ? 'info' : 'success';
}

interface Props {
  title: string;
  empty: string;
  rows: JobRow[];
}

export function ClientJobsSection({ title, empty, rows }: Props) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
      <h2 className="text-h3 flex items-center gap-2">
        <Briefcase className="h-4 w-4" /> {title}
        <span className="text-xs font-normal text-[var(--color-text-muted)]">· {rows.length}</span>
      </h2>

      <div className="mt-3">
        <ShowMore
          items={rows}
          initial={8}
          step={12}
          emptyLabel={empty}
          render={(j) => (
            <div key={j.id} className="py-2 border-t border-[var(--color-border-soft)] first:border-t-0 flex items-center gap-3">
              <span className="font-mono text-sm text-[var(--color-text-muted)] w-20">{j.project_number}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/projects/${j.project_number}`} className="text-sm hover:underline inline-flex items-center gap-1">
                  {j.scope_title ?? j.name} <ExternalLink className="h-3 w-3 opacity-60" />
                </Link>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {j.template_id ? (
                  <StatusBadge tone={phaseTone(j.phase)}>{PHASE_LABEL[j.phase]}</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">unadopted</StatusBadge>
                )}
                <span className="text-[11px] text-[var(--color-text-muted)] w-20 text-right">
                  {j.deadline ? formatDate(j.deadline) : '—'}
                </span>
              </div>
            </div>
          )}
        />
      </div>
    </section>
  );
}
