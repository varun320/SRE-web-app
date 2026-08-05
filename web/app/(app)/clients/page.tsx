import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { PageHeader } from '@/components/ui/page-header';
import { ClientsMap } from '@/components/admin/ClientsMap';
import { ClientForm } from '@/components/admin/ClientForm';
import { ClientsTable } from '@/components/admin/ClientsTable';
import type { ClientRow } from '@/lib/clients';

export default async function ClientsPage() {
  const sb = await getSupabaseServer();
  const isAdmin = await fetchIsAdmin(sb);
  const { data } = await sb
    .from('clients')
    .select('id, name, location, lat, lng, sharepoint_url')
    .order('name');

  const rows: ClientRow[] = (data ?? []).map((r: {
    id: string; name: string; location: string | null;
    lat: number; lng: number; sharepoint_url: string | null;
  }) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    lat: r.lat,
    lng: r.lng,
    sharepointUrl: r.sharepoint_url,
  }));

  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-5">
      <PageHeader
        title="Clients map"
        description={`${rows.length} client${rows.length === 1 ? '' : 's'} plotted.`}
      />
      {isAdmin && <ClientForm />}
      <ClientsMap clients={rows} />
      <ClientsTable rows={rows} canEdit={isAdmin} />
    </div>
  );
}
