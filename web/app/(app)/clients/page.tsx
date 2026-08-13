import { getSupabaseServer } from '@/shared/supabase/server';
import { fetchIsAdmin } from '@/shared/lib/role';
import { PageHeader } from '@/shared/ui/page-header';
import { ClientsMap } from '@/features/clients/components/ClientsMap';
import { ClientForm } from '@/features/clients/components/ClientForm';
import { DirectoryList } from '@/features/clients/components/DirectoryList';
import { fetchDirectoryCards } from '@/features/clients/queries';
import type { ClientRow } from '@/features/clients/types';

export default async function ClientsPage() {
  const sb = await getSupabaseServer();
  const isAdmin = await fetchIsAdmin(sb);
  const [mapRes, cards] = await Promise.all([
    sb.from('clients').select('id, name, location, lat, lng, sharepoint_url').order('name'),
    fetchDirectoryCards(sb),
  ]);

  const rows: ClientRow[] = (mapRes.data ?? []).map((r: {
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
        title="Directory"
        description={`Shared company, location & contact library — ${rows.length} client${rows.length === 1 ? '' : 's'} on record. New clients you add here (or when creating a job) feed the CRM automatically.`}
      />
      {isAdmin && <ClientForm />}
      <ClientsMap clients={rows} />
      <DirectoryList cards={cards} initial={8} step={12} />
    </div>
  );
}
