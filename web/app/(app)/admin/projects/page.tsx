import { getSupabaseServer } from '@/lib/supabase/server';
import { ProjectsTable } from '@/components/admin/ProjectsTable';
import { ProjectForm } from '@/components/admin/ProjectForm';

export default async function ProjectsPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('projects').select('id, project_number, name, status').order('project_number', { ascending: false });
  type Row = { id: string; project_number: number; name: string; status: 'active' | 'closed' };
  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-4">
      <ProjectForm />
      <ProjectsTable rows={(data ?? []) as Row[]} />
    </div>
  );
}
