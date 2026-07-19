import { getSupabaseServer } from '@/lib/supabase/server';
import { EntryTable } from '@/components/timesheet/EntryTable';
import { WeekPicker } from '@/components/timesheet/WeekPicker';
import { currentMonday, isMondayISO, formatDate } from '@/lib/dates';
import { notFound } from 'next/navigation';
import type { MainCategory, Project, SubCategory, Timesheet, TimesheetEntryDraft } from '@/lib/types';
import { InfoHint } from '@/components/ui/info-hint';
import { CopyLastWeekButton } from '@/components/timesheet/CopyLastWeekButton';

interface PageProps { params: Promise<{ week_start: string }> }

export default async function WeekPage({ params }: PageProps) {
  const { week_start } = await params;
  if (!isMondayISO(week_start)) notFound();

  const supabase = await getSupabaseServer();
  const { data: tsId, error: ensureErr } = await supabase.rpc('create_or_get_week', { p_week_start: week_start });
  if (ensureErr) throw new Error(ensureErr.message);

  const [tsRes, entriesRes, subsRes, projectsRes, tilRes, vacRes] = await Promise.all([
    supabase.from('timesheets').select('id,user_id,week_start,status,submitted_at,decided_at,decline_reason,locked').eq('id', tsId).single(),
    supabase.from('timesheet_entries').select('id,main_category,sub_category_id,project_id,mon_hrs,tue_hrs,wed_hrs,thu_hrs,fri_hrs,sat_hrs,sun_hrs,description,position').eq('timesheet_id', tsId).order('position'),
    supabase.from('sub_categories').select('id,main_category,name,requires_project,consumes_til,consumes_vacation,is_overtime_taken,sort_order').eq('is_active', true).order('main_category').order('sort_order'),
    supabase.from('projects').select('id,project_number,name,status').eq('status', 'active').order('project_number'),
    supabase.from('v_til_balance').select('closing_balance').maybeSingle(),
    supabase.from('v_vacation_balance').select('closing_balance').maybeSingle(),
  ]);

  if (tsRes.error || entriesRes.error || subsRes.error || projectsRes.error) {
    throw new Error(tsRes.error?.message ?? entriesRes.error?.message ?? subsRes.error?.message ?? projectsRes.error!.message);
  }

  const initialEntries = (entriesRes.data ?? []).map((r): TimesheetEntryDraft => ({
    ...r, main_category: r.main_category as MainCategory,
  }));

  return (
    <main className="w-full">
      <div className="px-3 md:px-4 pt-6 pb-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <h1 className="text-h1">Week of {formatDate(week_start)}</h1>
            <InfoHint label="Weekly timesheet">
              <p className="mb-1">Add one row per activity, split hours across the day columns.</p>
              <p className="mb-1"><strong>Project</strong> rows need a project number (e.g. <code>2026101</code>). Admin and Office &amp; Sales rows don&apos;t.</p>
              <p className="mb-1">Hours over <strong>8/day</strong> earn overtime; approved overtime lands in your TIL bank.</p>
              <p><strong>Save</strong> keeps a draft; <strong>Submit</strong> sends it to admin for approval.</p>
            </InfoHint>
          </div>
          <WeekPicker weekStart={week_start} currentMonday={currentMonday()} />
        </div>
        <div className="flex items-center gap-3">
          {(tsRes.data as Timesheet).status === 'draft' ? (
            <CopyLastWeekButton weekStart={week_start} hasEntries={initialEntries.length > 0} />
          ) : null}
          <a href={`/week/${week_start}/report`} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline-offset-4 hover:underline">
            View report →
          </a>
        </div>
      </div>
      <EntryTable
        timesheet={tsRes.data as Timesheet}
        initialEntries={initialEntries}
        subCategories={(subsRes.data ?? []) as SubCategory[]}
        projects={(projectsRes.data ?? []) as Project[]}
        openingTil={Number(tilRes.data?.closing_balance ?? 0)}
        openingVacation={Number(vacRes.data?.closing_balance ?? 0)}
      />
    </main>
  );
}
