import { getSupabaseServer } from '@/lib/supabase/server';
import { DailyBreakdown } from '@/components/report/DailyBreakdown';
import { CategoryTable } from '@/components/report/CategoryTable';
import { SubCategoryTable } from '@/components/report/SubCategoryTable';
import { ProjectTable } from '@/components/report/ProjectTable';
import { isMondayISO } from '@/lib/dates';
import { notFound } from 'next/navigation';

interface Props { params: Promise<{ week_start: string }> }

export default async function ReportPage({ params }: Props) {
  const { week_start } = await params;
  if (!isMondayISO(week_start)) notFound();

  const supabase = await getSupabaseServer();
  const { data: rows, error } = await supabase
    .from('v_weekly_report')
    .select('main_category,sub_category,project_number,description,mon_hrs,tue_hrs,wed_hrs,thu_hrs,fri_hrs,sat_hrs,sun_hrs,row_total')
    .eq('week_start', week_start);
  if (error) throw new Error(error.message);

  const r = rows ?? [];
  return (
    <main className="mx-auto max-w-6xl px-6 py-6 space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">Weekly Report — {week_start}</h1>
      <section><h2 className="text-sm uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Daily breakdown</h2><DailyBreakdown rows={r} /></section>
      <section><h2 className="text-sm uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Hours by category</h2><CategoryTable rows={r} /></section>
      <section><h2 className="text-sm uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Hours by sub-category</h2><SubCategoryTable rows={r} /></section>
      <section><h2 className="text-sm uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Hours by project</h2><ProjectTable rows={r} /></section>
    </main>
  );
}
