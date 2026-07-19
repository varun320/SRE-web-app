import { getSupabaseServer } from '@/lib/supabase/server';
import { ProjectsTable } from '@/components/admin/ProjectsTable';
import { ProjectForm } from '@/components/admin/ProjectForm';

export default async function ProjectsPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('projects').select('id, project_number, name, status').order('project_number', { ascending: false });
  type Row = { id: string; project_number: number; name: string; status: 'active' | 'closed' };
  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Projects</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)] max-w-2xl">
          Active projects are pickable on timesheets and expense reports. Close a project to hide it from new entries without touching historical data.
        </p>
      </div>
      <ProjectForm />
      <ProjectsTable rows={(data ?? []) as Row[]} />
    </div>
  );
}
