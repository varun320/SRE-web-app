import Link from 'next/link';
import { ArrowLeft, Package, ExternalLink } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';

interface LegacyRow {
  id: string;
  project_number: number;
  name: string;
  client_id: string | null;
  clients: { name: string } | null;
}

export default async function LegacyProjectsPage() {
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from('projects')
    .select('id, project_number, name, client_id, clients ( name )')
    .eq('status', 'active')
    .is('template_id', null)
    .order('project_number', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as LegacyRow[];

  const withClient = rows.filter((r) => r.client_id).length;

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
          <Package className="h-3.5 w-3.5" /> Legacy
        </div>
        <h1 className="mt-1 text-h1">Unadopted projects</h1>
        <p className="mt-2 text-body-sm text-[var(--color-text-muted)]">
          These {rows.length} projects were created by the timesheet system before the PM module existed. Click <strong>Adopt / edit</strong> on any row
          to pick a template, lead, and deadline — tasks generate automatically. {withClient}/{rows.length} have a client pre-matched via name.
        </p>
      </section>

      {rows.length === 0 ? (
        <EmptyState icon={Package} title="Nothing to adopt" description="Every active project has a template." />
      ) : (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job #</th>
                  <th>Client</th>
                  <th>Scope / name</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono">{r.project_number}</td>
                    <td>
                      {r.clients?.name ? (
                        <span>{r.clients.name}</span>
                      ) : (
                        <StatusBadge tone="warning">no client</StatusBadge>
                      )}
                    </td>
                    <td className="col-muted">{r.name}</td>
                    <td className="text-right">
                      <Link
                        href={`/projects/${r.project_number}`}
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                      >
                        Adopt / edit <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
