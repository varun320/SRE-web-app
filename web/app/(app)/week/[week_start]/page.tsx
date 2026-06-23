import { getSupabaseServer } from '@/lib/supabase/server';
import { EntryTable } from '@/components/timesheet/EntryTable';
import { isMondayISO } from '@/lib/dates';
import { notFound } from 'next/navigation';
import type { MainCategory, Project, SubCategory, Timesheet, TimesheetEntryDraft } from '@/lib/types';

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
    <main className="mx-auto max-w-7xl">
      <div className="px-6 pt-8 pb-2 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Week of {week_start}</h1>
        <a href={`/week/${week_start}/report`} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline-offset-4 hover:underline">
          View report →
        </a>
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
