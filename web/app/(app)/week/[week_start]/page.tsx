import { getSupabaseServer } from '@/lib/supabase/server';
import { EntryTable } from '@/components/timesheet/EntryTable';
import { WeekHero } from '@/components/timesheet/WeekHero';
import { DAY_KEYS, isMondayISO } from '@/lib/dates';
import { addDays, format, parseISO } from 'date-fns';
import { notFound } from 'next/navigation';
import type { MainCategory, Project, SubCategory, Timesheet, TimesheetEntryDraft } from '@/lib/types';

interface PageProps { params: Promise<{ week_start: string }> }

interface RawEntry {
  id: string;
  main_category: string;
  sub_category_id: string | null;
  project_id: string | null;
  mon_hrs: number | null;
  tue_hrs: number | null;
  wed_hrs: number | null;
  thu_hrs: number | null;
  fri_hrs: number | null;
  sat_hrs: number | null;
  sun_hrs: number | null;
  description: string | null;
  position: number;
}

function computeDailyTotals(entries: RawEntry[]): number[] {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const e of entries) {
    for (let i = 0; i < DAY_KEYS.length; i++) {
      totals[i] += Number(e[DAY_KEYS[i]] ?? 0);
    }
  }
  return totals;
}

function countValidationIssues(
  entries: TimesheetEntryDraft[],
  subs: SubCategory[],
): number {
  let issues = 0;
  const subById = new Map(subs.map((s) => [s.id, s]));
  for (const e of entries) {
    if (!e.main_category) { issues++; continue; }
    if (!e.sub_category_id) { issues++; continue; }
    const sub = subById.get(e.sub_category_id);
    if (!sub) { issues++; continue; }
    if (sub.requires_project && !e.project_id) issues++;
  }
  return issues;
}

export default async function WeekPage({ params }: PageProps) {
  const { week_start } = await params;
  if (!isMondayISO(week_start)) notFound();

  const supabase = await getSupabaseServer();
  const { data: tsId, error: ensureErr } = await supabase.rpc('create_or_get_week', { p_week_start: week_start });
  if (ensureErr) throw new Error(ensureErr.message);

  const prevMondayISO = format(addDays(parseISO(week_start), -7), 'yyyy-MM-dd');

  const [tsRes, entriesRes, subsRes, projectsRes, tilRes, vacRes, prevEntriesRes] =
    await Promise.all([
      supabase.from('timesheets').select('id,user_id,week_start,status,submitted_at,decided_at,decline_reason,locked').eq('id', tsId).single(),
      supabase.from('timesheet_entries').select('id,main_category,sub_category_id,project_id,mon_hrs,tue_hrs,wed_hrs,thu_hrs,fri_hrs,sat_hrs,sun_hrs,description,position').eq('timesheet_id', tsId).order('position'),
      supabase.from('sub_categories').select('id,main_category,name,requires_project,consumes_til,consumes_vacation,is_overtime_taken,sort_order').eq('is_active', true).order('main_category').order('sort_order'),
      supabase.from('projects').select('id,project_number,name,status').eq('status', 'active').order('project_number'),
      supabase.from('v_til_balance').select('closing_balance').maybeSingle(),
      supabase.from('v_vacation_balance').select('closing_balance').maybeSingle(),
      supabase
        .from('timesheet_entries')
        .select('mon_hrs,tue_hrs,wed_hrs,thu_hrs,fri_hrs,sat_hrs,sun_hrs,timesheets!inner(week_start)')
        .eq('timesheets.week_start', prevMondayISO),
    ]);

  if (tsRes.error || entriesRes.error || subsRes.error || projectsRes.error) {
    throw new Error(tsRes.error?.message ?? entriesRes.error?.message ?? subsRes.error?.message ?? projectsRes.error!.message);
  }

  const rawEntries = (entriesRes.data ?? []) as RawEntry[];
  const initialEntries = rawEntries.map((r): TimesheetEntryDraft => ({
    ...r,
    main_category: r.main_category as MainCategory,
    mon_hrs: Number(r.mon_hrs ?? 0),
    tue_hrs: Number(r.tue_hrs ?? 0),
    wed_hrs: Number(r.wed_hrs ?? 0),
    thu_hrs: Number(r.thu_hrs ?? 0),
    fri_hrs: Number(r.fri_hrs ?? 0),
    sat_hrs: Number(r.sat_hrs ?? 0),
    sun_hrs: Number(r.sun_hrs ?? 0),
    description: r.description ?? '',
  }));

  const dailyHours = computeDailyTotals(rawEntries);
  const totalHours = dailyHours.reduce((a, b) => a + b, 0);

  const prevRows = (prevEntriesRes.data ?? []) as Array<Partial<RawEntry>>;
  const lastWeekHours = prevRows.length
    ? prevRows.reduce(
        (sum, r) =>
          sum +
          Number(r.mon_hrs ?? 0) +
          Number(r.tue_hrs ?? 0) +
          Number(r.wed_hrs ?? 0) +
          Number(r.thu_hrs ?? 0) +
          Number(r.fri_hrs ?? 0) +
          Number(r.sat_hrs ?? 0) +
          Number(r.sun_hrs ?? 0),
        0,
      )
    : null;

  const openingTil = Number(tilRes.data?.closing_balance ?? 0);
  const openingVacation = Number(vacRes.data?.closing_balance ?? 0);

  const subs = (subsRes.data ?? []) as SubCategory[];
  const validationIssues = countValidationIssues(initialEntries, subs);

  return (
    <main className="mx-auto max-w-7xl px-4 md:px-6 pt-6">
      <WeekHero
        timesheet={tsRes.data as Timesheet}
        dailyHours={dailyHours}
        totalHours={totalHours}
        lastWeekHours={lastWeekHours}
        openingTil={openingTil}
        openingVacation={openingVacation}
        tilDelta={null}
        vacationDelta={null}
        validationIssues={validationIssues}
      />
      <EntryTable
        timesheet={tsRes.data as Timesheet}
        initialEntries={initialEntries}
        subCategories={subs}
        projects={(projectsRes.data ?? []) as Project[]}
        openingTil={openingTil}
        openingVacation={openingVacation}
      />
    </main>
  );
}
