import { getSupabaseServer } from '@/lib/supabase/server';
import { aggregateByProject, fetchProjectHours } from '@/lib/admin/reports/projects';
import { DateRangePicker } from '@/components/admin/reports/DateRangePicker';
import { ProjectsBreakdown } from '@/components/admin/reports/ProjectsBreakdown';
import { ProjectFilter } from '@/components/admin/reports/ProjectFilter';

interface SearchParams {
  from?: string;
  to?: string;
  project_id?: string;
}

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const monday = (() => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const dow = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    return d;
  })();
  const from = new Date(monday);
  from.setUTCDate(monday.getUTCDate() - 84); // ~12 weeks back
  const to = new Date(monday);
  to.setUTCDate(monday.getUTCDate() + 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default async function ProjectsReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const fallback = defaultRange();
  const from = sp.from ?? fallback.from;
  const to = sp.to ?? fallback.to;
  const projectId = sp.project_id;

  const sb = await getSupabaseServer();

  const [projectsRes, hoursRows] = await Promise.all([
    sb.from('projects')
      .select('id, project_number, name, status')
      .order('project_number', { ascending: false }),
    fetchProjectHours(sb, { from, to, projectId }),
  ]);

  const breakdown = aggregateByProject(hoursRows);

  const params = new URLSearchParams({ from, to });
  if (projectId) params.set('project_id', projectId);
  const downloadHref = `/api/admin/reports/projects?${params.toString()}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h3 className="text-base font-medium tracking-tight">Hours by project</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            How many approved hours each project absorbed in the range, broken down by employee.
          </p>
        </div>
        <ProjectFilter projects={(projectsRes.data ?? []) as { id: string; project_number: number; name: string; status: string }[]} selected={projectId} />
      </div>

      <DateRangePicker defaultFrom={from} defaultTo={to} />
      <ProjectsBreakdown rows={breakdown} downloadHref={downloadHref} />
    </div>
  );
}

