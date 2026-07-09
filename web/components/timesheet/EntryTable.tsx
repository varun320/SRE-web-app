'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project, SubCategory, Timesheet, TimesheetEntryDraft } from '@/lib/types';
import { EntryRow } from './EntryRow';
import { KpiStrip } from './KpiStrip';
import { StatusBanner } from './StatusBanner';
import { Button } from '@/components/ui/button';
import { Check, CircleDashed, Plus } from 'lucide-react';
import { computeTotals } from '@/lib/totals';
import { DAY_KEYS } from '@/lib/dates';
import { useSaveEntries, useSubmit } from '@/lib/hooks';
import { toast } from 'sonner';
import { fireConfetti } from '@/components/ui/confetti';

const SUBMIT_CHEERS = [
  '🎉 Submitted — your future self thanks you.',
  '✨ Locked in. Go enjoy your day.',
  '🚀 Off to the admin queue. Nicely done.',
  '🙌 Submitted for approval — you\'re ahead of the curve.',
  '💪 One more week wrangled. Submitted.',
  '🌟 Clean week, clean submit. Done.',
  '☕ Submitted. Treat yourself to a coffee.',
];
function randomCheer(): string {
  return SUBMIT_CHEERS[Math.floor(Math.random() * SUBMIT_CHEERS.length)];
}

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

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function EntryTable({ timesheet, initialEntries, subCategories, projects, openingTil, openingVacation }: Props) {
  const [rows, setRows] = useState<TimesheetEntryDraft[]>(initialEntries.length ? initialEntries : [emptyRow(0)]);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowsRef = useRef(rows);
  const locked = timesheet.locked || timesheet.status === 'submitted' || timesheet.status === 'approved';

  useEffect(() => { rowsRef.current = rows; }, [rows]);

  useEffect(() => {
    setRows(initialEntries.length ? initialEntries : [emptyRow(0)]);
    setDirty(false);
    setSaveState('idle');
    setSavedAt(null);
  }, [initialEntries, timesheet.id]);

  const totals = useMemo(() => computeTotals(rows, subCategories), [rows, subCategories]);

  // Per-day column sums for the sticky footer.
  const perDay = useMemo(() => {
    const sums = { mon_hrs: 0, tue_hrs: 0, wed_hrs: 0, thu_hrs: 0, fri_hrs: 0, sat_hrs: 0, sun_hrs: 0 } as Record<(typeof DAY_KEYS)[number], number>;
    for (const r of rows) for (const k of DAY_KEYS) sums[k] += Number(r[k] ?? 0);
    return sums;
  }, [rows]);

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

  const performSave = useCallback(async (silent: boolean) => {
    if (locked) return;
    setSaveState('saving');
    try {
      await save.mutateAsync(rowsRef.current.map(({ id: _id, ...rest }) => rest));
      setDirty(false);
      setSavedAt(Date.now());
      setSaveState('saved');
      if (!silent) toast.success('Saved');
    } catch (e) {
      setSaveState('error');
      toast.error((e as Error).message);
    }
  }, [locked, save]);

  const setRow = (i: number, next: TimesheetEntryDraft) => {
    setRows((rs) => rs.map((r, idx) => idx === i ? next : r));
    setDirty(true);
  };
  const addRow = () => { setRows((rs) => [...rs, emptyRow(rs.length)]); setDirty(true); };
  const removeRow = (i: number) => {
    setRows((rs) => rs.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, position: idx })));
    setDirty(true);
  };

  // Debounced autosave — waits AUTOSAVE_DEBOUNCE_MS after the last change.
  // Silent (no toast). Manual Save button still triggers a toast on success.
  useEffect(() => {
    if (!dirty || locked) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void performSave(true); }, AUTOSAVE_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rows, dirty, locked, performSave]);

  // Cmd/Ctrl+S manual save.
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        void performSave(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked, performSave]);

  const onSubmit = async () => {
    if (dirty) await performSave(true);
    if (errors.length) { toast.error(`Fix ${errors.length} issue(s) before submitting`); return; }
    try {
      await submit.mutateAsync();
      fireConfetti();
      toast.success(randomCheer());
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <StatusBanner status={timesheet.status} declineReason={timesheet.decline_reason} />
      <KpiStrip totals={totals} openingTil={openingTil} openingVacation={openingVacation} />
      <EmptyStateToast rows={rows} locked={locked} timesheetId={timesheet.id} />

      <div className="mx-3 md:mx-4 mb-6 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border-soft)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            {/* Sticky header — stays just below the 48 px app header on scroll. */}
            <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <tr>
                <Th className="text-left px-2 py-2">Category</Th>
                <Th className="text-left px-2 py-2">Project #</Th>
                <Th className="px-0.5 py-2">Mon</Th>
                <Th className="px-0.5 py-2">Tue</Th>
                <Th className="px-0.5 py-2">Wed</Th>
                <Th className="px-0.5 py-2">Thu</Th>
                <Th className="px-0.5 py-2">Fri</Th>
                <Th className="px-0.5 py-2">Sat</Th>
                <Th className="px-0.5 py-2">Sun</Th>
                <Th className="text-left px-2 py-2">Description</Th>
                <Th className="text-right px-2 py-2">Total</Th>
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
            {/* Sticky totals footer — pinned to the bottom of the viewport while scrolling the grid. */}
            <tfoot className="text-[13px]">
              <tr>
                <TotalCell colSpan={2} className="text-left">
                  <span className="col-muted uppercase tracking-wider text-[11px]">Day totals</span>
                </TotalCell>
                {DAY_KEYS.map((k) => (
                  <TotalCell key={k} className="text-center num">
                    {perDay[k] > 0 ? perDay[k].toFixed(2) : <span className="col-muted">—</span>}
                  </TotalCell>
                ))}
                <TotalCell className="text-right">
                  <SaveIndicator state={saveState} dirty={dirty} savedAt={savedAt} locked={locked} />
                </TotalCell>
                <TotalCell className="text-right num font-semibold text-[14px]">
                  {totals.total_hrs.toFixed(2)}
                </TotalCell>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between px-3 md:px-4 py-3 border-t border-[var(--color-border-soft)] gap-3 md:gap-4">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={addRow} disabled={locked}>
              <Plus className="h-4 w-4 mr-1" /> Add row
            </Button>
            <span className="text-[11px] text-[var(--color-text-subtle)]">
              Autosaves as you type · <kbd className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px]">⌘S</kbd> to save now
            </span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-xs text-[var(--color-text-muted)] pb-2">
              {errors.length} validation issue{errors.length === 1 ? '' : 's'}
            </span>
            <div className="flex flex-col items-end">
              <Button type="button" onClick={onSubmit} disabled={locked || submit.isPending || errors.length > 0}>
                {submit.isPending ? 'Submitting…' : 'Submit for approval'}
              </Button>
              <span className="text-[10px] text-[var(--color-text-muted)] mt-1">sends to admin · locks the week</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <th
      className={[
        'font-normal bg-[var(--color-surface-2)]/50 border-b border-[var(--color-border-soft)]',
        className,
      ].join(' ')}
    >
      {children}
    </th>
  );
}

function TotalCell({ colSpan, className = '', children }: { colSpan?: number; className?: string; children: React.ReactNode }) {
  return (
    <td
      colSpan={colSpan}
      className={[
        'bg-[var(--color-surface-2)]/40 border-t border-[var(--color-border)] px-2 py-2.5',
        className,
      ].join(' ')}
    >
      {children}
    </td>
  );
}

function SaveIndicator({ state, dirty, savedAt, locked }: { state: SaveState; dirty: boolean; savedAt: number | null; locked: boolean }) {
  const [_, force] = useState(0);
  useEffect(() => {
    if (state !== 'saved' || !savedAt) return;
    const t = setInterval(() => force((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [state, savedAt]);

  if (locked) return <span className="text-[11px] col-muted">Locked</span>;

  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] col-muted">
        <CircleDashed className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === 'error') {
    return <span className="text-[11px] text-[var(--color-status-declined-fg)]">Save failed</span>;
  }
  if (dirty) {
    return <span className="text-[11px] col-muted">Unsaved changes</span>;
  }
  if (state === 'saved' && savedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-status-approved-fg)]">
        <Check className="h-3 w-3" /> Saved {agoShort(savedAt)}
      </span>
    );
  }
  return <span className="text-[11px] col-muted">No changes</span>;
}

function agoShort(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

// One-time toast when the user lands on an empty draft week. Uses
// sessionStorage keyed by timesheet id so we don't nag on every reload
// within the same session.
function EmptyStateToast({ rows, locked, timesheetId }: { rows: TimesheetEntryDraft[]; locked: boolean; timesheetId: string }) {
  useEffect(() => {
    if (locked) return;
    const isEmpty = rows.length === 1 && !rows[0].main_category && !rows[0].description;
    if (!isEmpty) return;
    const key = `sre.emptyHint.${timesheetId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* ignore */ }
    const t = setTimeout(() => {
      toast('New week. Pick a category and start logging hours.', { duration: 6000 });
    }, 350);
    return () => clearTimeout(t);
    // Only fire once per timesheet id per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timesheetId]);
  return null;
}
