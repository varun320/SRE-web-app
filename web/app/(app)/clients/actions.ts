'use server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { revalidatePath } from 'next/cache';
import { friendlyError } from '@/lib/errors';

function parseCoords(input: string): { lat: number; lng: number } | null {
  const m = input.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function createClient(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };

  const name = String(formData.get('name') ?? '').trim();
  const location = String(formData.get('location') ?? '').trim() || null;
  const coordsRaw = String(formData.get('coords') ?? '').trim();
  const sharepointUrl = String(formData.get('sharepoint_url') ?? '').trim() || null;

  if (!name) return { error: 'name required' };
  const coords = parseCoords(coordsRaw);
  if (!coords) return { error: 'coordinates required — paste "lat, lng" (e.g. 25.276987, 55.296249) or a Google Maps URL' };
  if (sharepointUrl && !/^https?:\/\//i.test(sharepointUrl)) return { error: 'SharePoint URL must start with http(s)://' };

  const { error } = await sb.from('clients').insert({
    org_id: '00000000-0000-0000-0000-000000000001',
    name,
    location,
    lat: coords.lat,
    lng: coords.lng,
    sharepoint_url: sharepointUrl,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clients');
}

export async function deleteClient(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'missing id' };
  const { error } = await sb.from('clients').delete().eq('id', id);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clients');
}
