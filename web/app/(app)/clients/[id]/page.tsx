import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Mail, Phone, Users, Building2, ExternalLink, Briefcase } from 'lucide-react';
import { getSupabaseServer } from '@/shared/supabase/server';
import { fetchIsAdmin } from '@/shared/lib/role';
import { StatusBadge } from '@/shared/ui/status-badge';
import { ClientDirectorySection } from '@/features/clients/components/ClientDirectorySection';
import { ClientJobsSection } from '@/features/clients/components/ClientJobsSection';
import { formatDate } from '@/shared/lib/dates';

interface Client {
  id: string;
  name: string;
  location: string | null;
  lat: number;
  lng: number;
  sharepoint_url: string | null;
}

interface Contact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
}

interface Site {
  id: string;
  name: string;
  address: string | null;
}

interface JobRow {
  id: string;
  project_number: number;
  name: string;
  scope_title: string | null;
  status: 'active' | 'closed';
  phase: 'pre' | 'during' | 'post';
  deadline: string | null;
  template_id: string | null;
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await getSupabaseServer();
  const isAdmin = await fetchIsAdmin(sb);

  const [clientRes, contactsRes, sitesRes, jobsRes] = await Promise.all([
    sb.from('clients').select('id, name, location, lat, lng, sharepoint_url').eq('id', id).maybeSingle(),
    sb.from('contacts').select('id, name, role, email, phone').eq('client_id', id).order('name'),
    sb.from('sites').select('id, name, address').eq('client_id', id).order('name'),
    sb.from('projects').select('id, project_number, name, scope_title, status, phase, deadline, template_id')
      .eq('client_id', id).order('project_number', { ascending: false }),
  ]);
  if (clientRes.error) throw new Error(clientRes.error.message);
  if (!clientRes.data) notFound();
  const client = clientRes.data as Client;
  const contacts = (contactsRes.data ?? []) as Contact[];
  const sites = (sitesRes.data ?? []) as Site[];
  const jobs = (jobsRes.data ?? []) as JobRow[];

  const active = jobs.filter((j) => j.status === 'active');
  const past   = jobs.filter((j) => j.status === 'closed');

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <div>
        <Link href="/clients" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ArrowLeft className="h-3.5 w-3.5" /> All clients
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 md:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full opacity-70"
          style={{ background: 'radial-gradient(circle, var(--color-accent-tint) 0%, transparent 70%)' }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
            <Building2 className="h-3.5 w-3.5" /> Client
          </div>
          <h1 className="mt-1 text-h1">{client.name}</h1>
          <p className="mt-2 flex items-center gap-3 text-body-sm text-[var(--color-text-muted)]">
            {client.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {client.location}
              </span>
            ) : null}
            <span className="font-mono">{client.lat.toFixed(4)}, {client.lng.toFixed(4)}</span>
            {client.sharepoint_url ? (
              <a href={client.sharepoint_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline">
                SharePoint <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ClientDirectorySection
          title="Contacts"
          clientId={client.id}
          isAdmin={isAdmin}
          items={contacts.map((c) => ({
            id: c.id,
            primary: c.name,
            secondary: c.role,
            lines: [
              c.email ? { icon: 'mail' as const, text: c.email, href: `mailto:${c.email}` } : null,
              c.phone ? { icon: 'phone' as const, text: c.phone, href: `tel:${c.phone}` } : null,
            ].filter((x) => x !== null),
          }))}
          kind="contact"
        />
        <ClientDirectorySection
          title="Sites / Locations"
          clientId={client.id}
          isAdmin={isAdmin}
          items={sites.map((s) => ({
            id: s.id,
            primary: s.name,
            secondary: s.address,
            lines: [],
          }))}
          kind="site"
        />
      </div>

      <ClientJobsSection
        title="Active jobs"
        empty="No active jobs for this client."
        rows={active}
      />

      {past.length > 0 ? (
        <ClientJobsSection
          title="Previous work"
          empty="No past jobs recorded."
          rows={past}
        />
      ) : null}
    </main>
  );
}
