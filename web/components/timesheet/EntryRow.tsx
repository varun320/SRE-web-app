'use client';
import type { Project, SubCategory, TimesheetEntryDraft } from '@/lib/types';
import { DAY_KEYS } from '@/lib/dates';
import { CategoryCell } from './CategoryCell';
import { ProjectCell } from './ProjectCell';
import { HourCell } from './HourCell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

export function EntryRow({ row, index, subCategories, projects, onChange, onRemove, disabled }: Props) {
  const sub = subCategories.find((s) => s.id === row.sub_category_id);
  const requiresProject = sub?.requires_project ?? (row.main_category === 'Project');

  const rowTotal = DAY_KEYS.reduce((acc, k) => acc + (row[k] || 0), 0);
  const missingDescription = row.description.trim().length === 0;
  const missingProject = requiresProject && !row.project_id;

  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="p-2"><CategoryCell
        mainCategory={row.main_category}
        subCategoryId={row.sub_category_id}
        subCategories={subCategories}
        onChange={({ mainCategory, subCategoryId }) => onChange({ ...row, main_category: mainCategory, sub_category_id: subCategoryId, project_id: null })}
        disabled={disabled}
      /></td>
      <td className="p-2"><ProjectCell
        projectId={row.project_id}
        required={requiresProject}
        projects={projects}
        onChange={(id) => onChange({ ...row, project_id: id })}
        disabled={disabled}
      /></td>
      {DAY_KEYS.map((k, i) => (
        <td key={k} className="p-1 text-center">
          <HourCell value={row[k]} onChange={(n) => onChange({ ...row, [k]: n })} disabled={disabled} ariaLabel={`${DAY_LABELS[i]} hours row ${index+1}`} />
        </td>
      ))}
      <td className="p-2">
        <Input
          value={row.description}
          onChange={(e) => onChange({ ...row, description: e.target.value })}
          disabled={disabled}
          placeholder={missingDescription ? 'Description required' : ''}
          className={missingDescription ? 'border-[var(--color-status-declined)]' : ''}
          aria-invalid={missingDescription}
        />
      </td>
      <td className="p-2 text-right font-mono tabular-nums">{rowTotal.toFixed(2)}</td>
      <td className="p-2">
        {missingProject && <span className="text-xs text-[var(--color-status-declined)]">project required</span>}
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={disabled} aria-label={`Remove row ${index+1}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
