'use client';
import type { Project, SubCategory, TimesheetEntryDraft, MainCategory } from '@/lib/types';
import { DAY_KEYS } from '@/lib/dates';
import { CategoryCell } from './CategoryCell';
import { ProjectCell } from './ProjectCell';
import { HourCell } from './HourCell';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';

interface Props {
  row: TimesheetEntryDraft;
  index: number;
  subCategories: readonly SubCategory[];
  projects: readonly Project[];
  onChange: (next: TimesheetEntryDraft) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// Maps main_category to the CSS-variable suffix used for its colour swatch.
const TONE: Record<MainCategory | '', 'project' | 'admin' | 'office' | null> = {
  'Project':        'project',
  'Admin':          'admin',
  'Office & Sales': 'office',
  '': null,
};

export function EntryRow({ row, index, subCategories, projects, onChange, onRemove, disabled }: Props) {
  const sub = subCategories.find((s) => s.id === row.sub_category_id);
  const requiresProject = sub?.requires_project ?? (row.main_category === 'Project');

  const rowTotal = DAY_KEYS.reduce((acc, k) => acc + (row[k] || 0), 0);
  const missingDescription = row.description.trim().length === 0;
  const missingProject = requiresProject && !row.project_id;

  const maxDayInRow = DAY_KEYS.reduce((acc, k) => Math.max(acc, row[k] || 0), 0);
  const isTilPayoutRow = sub?.name === 'TIL Payout';
  const showOtHint = maxDayInRow > 8 && !isTilPayoutRow;

  const tone = TONE[row.main_category];
  const borderColor = tone
    ? `var(--color-cat-${tone}-border)`
    : 'var(--color-border-soft)';

  return (
    <tr
      className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40 transition-colors"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <td className="px-2 py-2.5">
        <CategoryCell
          mainCategory={row.main_category}
          subCategoryId={row.sub_category_id}
          subCategories={subCategories}
          onChange={({ mainCategory, subCategoryId }) => onChange({ ...row, main_category: mainCategory, sub_category_id: subCategoryId, project_id: null })}
          disabled={disabled}
        />
      </td>
      <td className="px-2 py-2.5">
        <ProjectCell
          projectId={row.project_id}
          required={requiresProject}
          projects={projects}
          onChange={(id) => onChange({ ...row, project_id: id })}
          disabled={disabled}
        />
        {missingProject ? <span className="block text-[10px] text-[var(--color-status-declined-fg)] mt-1">required</span> : null}
      </td>
      {DAY_KEYS.map((k, i) => (
        <td key={k} className="px-0.5 py-2.5 text-center">
          <HourCell value={row[k]} onChange={(n) => onChange({ ...row, [k]: n })} disabled={disabled} ariaLabel={`${DAY_LABELS[i]} hours row ${index+1}`} />
        </td>
      ))}
      <td className="px-2 py-2.5 min-w-[180px]">
        <div className="relative">
          <Input
            value={row.description}
            onChange={(e) => onChange({ ...row, description: e.target.value })}
            disabled={disabled}
            placeholder={missingDescription ? 'Description required' : 'What you worked on'}
            className={`pr-8 ${missingDescription ? 'border-[var(--color-status-declined-fg)]' : ''}`}
            aria-invalid={missingDescription}
          />
          {!disabled ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove row ${index+1}`}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)] transition-colors p-1 rounded"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {showOtHint ? (
          <span className="block text-[10px] text-[var(--color-status-submitted-fg)] mt-1">
            → hours above 8/day count as overtime (added to TIL bank on approval)
          </span>
        ) : null}
      </td>
      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-sm">{rowTotal.toFixed(2)}</td>
    </tr>
  );
}
