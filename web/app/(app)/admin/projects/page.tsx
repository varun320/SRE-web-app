import { getSupabaseServer } from '@/lib/supabase/server';
import { ProjectsTable } from '@/components/admin/ProjectsTable';
import { ProjectForm } from '@/components/admin/ProjectForm';

export default async function ProjectsPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('projects').select('id, project_number, name, status').order('project_number', { ascending: false });
  type Row = { id: string; project_number: number; name: string; status: 'active' | 'closed' };
  return (
    <div className="px-4 md:px-6 py-6 space-y-5">
      <header>
        <h2 className="text-lg font-medium tracking-tight">Projects</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Active and closed projects. Project numbers follow the <code className="font-mono text-xs">YYYYNNN</code> convention.</p>
      </header>
      <ProjectForm />
      <ProjectsTable rows={(data ?? []) as Row[]} />
    </div>
  );
}
