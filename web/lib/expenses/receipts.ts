import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'expense-receipts';

function extFromFile(f: File): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(f.name);
  if (m) return m[1].toLowerCase();
  const t = f.type;
  if (t === 'image/jpeg') return 'jpg';
  if (t === 'image/png') return 'png';
  if (t === 'image/webp') return 'webp';
  if (t === 'image/heic') return 'heic';
  if (t === 'application/pdf') return 'pdf';
  return 'bin';
}

function rand(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

export async function uploadReceipt(sb: SupabaseClient, expenseId: string, file: File): Promise<string> {
  const { data: userRow } = await sb.auth.getUser();
  const uid = userRow.user?.id;
  if (!uid) throw new Error('not authenticated');

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const key = `${uid}/${expenseId}/${date}-${rand()}.${extFromFile(file)}`;

  const { error } = await sb.storage.from(BUCKET).upload(key, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  return key;
}

export async function receiptSignedUrl(sb: SupabaseClient, key: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(key, expiresIn);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteReceipt(sb: SupabaseClient, key: string): Promise<void> {
  const { error } = await sb.storage.from(BUCKET).remove([key]);
  if (error) throw new Error(error.message);
}
