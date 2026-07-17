import { getSupabaseServer } from '@/lib/supabase/server';
import { DecisionBar } from '@/components/admin/DecisionBar';
import { DailyBreakdown } from '@/components/report/DailyBreakdown';
import { CategoryTable } from '@/components/report/CategoryTable';
import { SubCategoryTable } from '@/components/report/SubCategoryTable';
import { ProjectTable } from '@/components/report/ProjectTable';
import { LineItems } from '@/components/report/LineItems';
import { notFound } from 'next/navigation';
import type { TimesheetStatus, MainCategory } from '@/lib/types';

interface Props {
  params: Promise<{ id: string; ws: string }>;
}

interface ReportRow {
  main_category: MainCategory;
  sub_category: string;
  project_number: number | null;
  description: string | null;
  mon_hrs: number;
  tue_hrs: number;
  wed_hrs: number;
  thu_hrs: number;
  fri_hrs: number;
  sat_hrs: number;
  sun_hrs: number;
  row_total: number;
}

export default async function AdminWeekReview({ params }: Props) {
  const { id, ws } = await params;
  const sb = await getSupabaseServer();

  const { data: ts } = await sb
    .from('timesheets')
    .select('id, status, submitted_at, decided_at, decline_reason, locked')
    .eq('user_id', id).eq('week_start', ws).maybeSingle();
  if (!ts) notFound();

  const { data: user } = await sb
    .from('users').select('full_name, employee_code, email').eq('id', id).single();
  const { data: rows } = await sb
    .from('v_weekly_report')
    .select('main_category, sub_category, project_number, description, mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, sat_hrs, sun_hrs, row_total')
    .eq('timesheet_id', ts.id);

  const r = (rows ?? []) as ReportRow[];
  return (
    <div className="space-y-6">
      <div className="mx-3 md:mx-4 mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-5 py-4">
        <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{user?.employee_code}</div>
        <div className="text-lg font-semibold">{user?.full_name}</div>
        <div className="text-sm text-[var(--color-text-muted)]">
          Week of {ws} Â· status <strong>{ts.status}</strong>
          {ts.decline_reason ? ` Â· last reason: ${ts.decline_reason}` : ''}
        </div>
      </div>

      {r.length === 0 ? (
        <div className="mx-3 md:mx-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-5 py-6 text-sm text-[var(--color-text-muted)]">
          This week has no entries yet.
        </div>
      ) : (
        <>
          <section className="px-3 md:px-4"><h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Line items</h2><LineItems rows={r} /></section>
          <section className="px-3 md:px-4"><h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Daily breakdown</h2><DailyBreakdown rows={r} /></section>
          <section className="px-3 md:px-4"><h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Hours by category</h2><CategoryTable rows={r} /></section>
          <section className="px-3 md:px-4"><h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Hours by sub-category</h2><SubCategoryTable rows={r} /></section>
          <section className="px-3 md:px-4"><h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Hours by project</h2><ProjectTable rows={r} /></section>
        </>
      )}

      <DecisionBar timesheetId={ts.id} status={ts.status as TimesheetStatus} />
    </div>
  );
}
