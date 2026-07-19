import { getSupabaseServer } from '@/lib/supabase/server';
import { ProjectsTable } from '@/components/admin/ProjectsTable';
import { ProjectForm } from '@/components/admin/ProjectForm';
import { PageHeader } from '@/components/ui/page-header';

export default async function ProjectsPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('projects').select('id, project_number, name, status').order('project_number', { ascending: false });
  type Row = { id: string; project_number: number; name: string; status: 'active' | 'closed' };
  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-5">
      <PageHeader
        title="Projects"
        description="Active projects are pickable on timesheets and expense reports. Close a project to hide it from new entries without touching historical data."
        tip={
          <>
            <p className="mb-1"><strong>Number format</strong>: YYYY + 3-digit sequence (e.g. <code>2026101</code>).</p>
            <p className="mb-1"><strong>Close</strong> hides the project from new-row dropdowns; existing rows keep referencing it.</p>
            <p><strong>Rename</strong> updates the display everywhere including historical entries.</p>
          </>
        }
      />
      <ProjectForm />
      <ProjectsTable rows={(data ?? []) as Row[]} />
    </div>
  );
}
