'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Project, SubCategory, Timesheet, TimesheetEntryDraft } from '@/lib/types';
import { EntryRow } from './EntryRow';
import { KpiStrip } from './KpiStrip';
import { StatusBanner } from './StatusBanner';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { computeTotals } from '@/lib/totals';
import { useSaveEntries, useSubmit } from '@/lib/hooks';
import { toast } from 'sonner';

interface Props {
  timesheet: Timesheet;
  initialEntries: TimesheetEntryDraft[];
  subCategories: SubCategory[];
  projects: Project[];
  openingTil: number;
  openingVacation: number;
}

function emptyRow(position: number): TimesheetEntryDraft {
  return {
    main_category: '', sub_category_id: null, project_id: null,
    mon_hrs: 0, tue_hrs: 0, wed_hrs: 0, thu_hrs: 0, fri_hrs: 0, sat_hrs: 0, sun_hrs: 0,
    description: '', position,
  };
}

export function EntryTable({ timesheet, initialEntries, subCategories, projects, openingTil, openingVacation }: Props) {
  const [rows, setRows] = useState<TimesheetEntryDraft[]>(initialEntries.length ? initialEntries : [emptyRow(0)]);
  const [dirty, setDirty] = useState(false);
  const locked = timesheet.locked || timesheet.status === 'submitted' || timesheet.status === 'approved';

  useEffect(() => { setRows(initialEntries.length ? initialEntries : [emptyRow(0)]); setDirty(false); }, [initialEntries, timesheet.id]);

  const totals = useMemo(() => computeTotals(rows, subCategories), [rows, subCategories]);
  const save = useSaveEntries(timesheet.id);
  const submit = useSubmit(timesheet.id);

  const subById = new Map(subCategories.map((s) => [s.id, s]));
  const errors = rows.flatMap((r, i) => {
    const e: string[] = [];
    if (!r.main_category) e.push(`Row ${i+1}: main category`);
    if (!r.sub_category_id) e.push(`Row ${i+1}: sub-category`);
    if (r.sub_category_id && subById.get(r.sub_category_id)?.requires_project && !r.project_id) e.push(`Row ${i+1}: project #`);
    if (!r.description.trim()) e.push(`Row ${i+1}: description`);
    return e;
  });

  const setRow = (i: number, next: TimesheetEntryDraft) => { setRows((rs) => rs.map((r, idx) => idx === i ? next : r)); setDirty(true); };
  const addRow = () => { setRows((rs) => [...rs, emptyRow(rs.length)]); setDirty(true); };
  const removeRow = (i: number) => { setRows((rs) => rs.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, position: idx }))); setDirty(true); };

  const onSave = async () => {
    try {
      await save.mutateAsync(rows.map(({ id: _id, ...rest }) => rest));
      setDirty(false);
      toast.success('Saved');
    } catch (e) { toast.error((e as Error).message); }
  };

  const onSubmit = async () => {
    if (dirty) await onSave();
    if (errors.length) { toast.error(`Fix ${errors.length} issue(s) before submitting`); return; }
    try {
      await submit.mutateAsync();
      toast.success('Submitted for approval');
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <StatusBanner status={timesheet.status} declineReason={timesheet.decline_reason} />
      <KpiStrip totals={totals} openingTil={openingTil} openingVacation={openingVacation} />

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
            <tr>
              <th className="text-left p-2">Category</th>
              <th className="text-left p-2">Project #</th>
              <th className="p-2">Mon</th><th className="p-2">Tue</th><th className="p-2">Wed</th>
              <th className="p-2">Thu</th><th className="p-2">Fri</th><th className="p-2">Sat</th><th className="p-2">Sun</th>
              <th className="text-left p-2">Description</th>
              <th className="text-right p-2">Total</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <EntryRow
                key={i}
                row={r}
                index={i}
                subCategories={subCategories}
                projects={projects}
                onChange={(next) => setRow(i, next)}
                onRemove={() => removeRow(i)}
                disabled={locked}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)]">
        <Button type="button" variant="outline" onClick={addRow} disabled={locked}>
          <Plus className="h-4 w-4 mr-1" /> Add row
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-muted)]">{errors.length} validation issue{errors.length === 1 ? '' : 's'}</span>
          <Button type="button" variant="outline" onClick={onSave} disabled={locked || save.isPending || !dirty}>
            {save.isPending ? 'Saving…' : 'Save draft'}
          </Button>
          <Button type="button" onClick={onSubmit} disabled={locked || submit.isPending || errors.length > 0}>
            {submit.isPending ? 'Submitting…' : 'Submit for approval'}
          </Button>
        </div>
      </div>
    </div>
  );
}
