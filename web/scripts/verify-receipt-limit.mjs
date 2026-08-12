// Quick check that the receipt bucket limit is 15 MB after migration.
// Also uploads a synthetic 6 MB blob to prove past-5MB uploads succeed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set in .env.local');

const sb = createClient(url, key, { auth: { persistSession: false } });

// 1) Verify bucket limit
const { data: bucket, error: bErr } = await sb.storage.getBucket('expense-receipts');
if (bErr) throw bErr;
console.log('bucket file_size_limit:', bucket.file_size_limit, `(${(bucket.file_size_limit / 1024 / 1024).toFixed(1)} MB)`);
if (bucket.file_size_limit !== 15728640) {
  throw new Error(`expected 15728640, got ${bucket.file_size_limit}`);
}

// 2) Upload a 6 MB blob (past old 5 MB limit) and clean up
const bytes = new Uint8Array(6 * 1024 * 1024);
// simulate a JPEG header so mime-check passes; body doesn't need to be a real image
bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff;
const key1 = `_verify/${Date.now()}.jpg`;
const { error: upErr } = await sb.storage
  .from('expense-receipts')
  .upload(key1, bytes, { contentType: 'image/jpeg', upsert: true });
if (upErr) throw new Error(`6MB upload failed: ${upErr.message}`);
console.log('6MB upload: OK');

// 3) Upload 16 MB — should be rejected by the 15 MB limit
const big = new Uint8Array(16 * 1024 * 1024);
big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
const { error: bigErr } = await sb.storage
  .from('expense-receipts')
  .upload(`_verify/${Date.now()}-big.jpg`, big, { contentType: 'image/jpeg', upsert: true });
if (!bigErr) throw new Error('16MB upload was accepted — limit not enforced');
console.log('16MB upload rejected (expected):', bigErr.message);

// Cleanup
await sb.storage.from('expense-receipts').remove([key1]);
console.log('OK — receipt limit is 15 MB');
