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

const COMPRESS_THRESHOLD = 2 * 1024 * 1024;   // 2 MB — under this, don't bother
const MAX_DIMENSION = 2400;                    // px — receipts stay readable
const JPEG_QUALITY = 0.85;

async function compressImage(file: File): Promise<File> {
  // Canvas can't decode HEIC; PDFs aren't images. Let them upload as-is.
  if (!file.type.startsWith('image/') || file.type === 'image/heic') return file;
  if (file.size < COMPRESS_THRESHOLD) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  const nameNoExt = file.name.replace(/\.[a-z0-9]+$/i, '');
  return new File([blob], `${nameNoExt}.jpg`, { type: 'image/jpeg' });
}

export async function uploadReceipt(sb: SupabaseClient, expenseId: string, file: File): Promise<string> {
  const { data: userRow } = await sb.auth.getUser();
  const uid = userRow.user?.id;
  if (!uid) throw new Error('not authenticated');

  const compressed = await compressImage(file);

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const key = `${uid}/${expenseId}/${date}-${rand()}.${extFromFile(compressed)}`;

  const { error } = await sb.storage.from(BUCKET).upload(key, compressed, {
    cacheControl: '3600',
    upsert: false,
    contentType: compressed.type || undefined,
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
