// Diagnostic — check notifications state on the connected Supabase project.
// Reads env from web/.env.local; no writes. Safe.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, '..', '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    }),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function q(sql, args = []) {
  // Use REST rpc for arbitrary SQL — Supabase doesn't expose one by default.
  // Fall back to per-endpoint queries below.
  return { error: new Error('use table queries'), data: null };
}

console.log(`\n== Supabase: ${url} ==\n`);

// 1. Total notification count
{
  const { count, error } = await sb.from('notifications').select('id', { count: 'exact', head: true });
  console.log(`notifications table rows: ${count ?? 'ERR'}${error ? ' — ' + error.message : ''}`);
}

// 2. Last 5 notifications (any recipient)
{
  const { data, error } = await sb
    .from('notifications')
    .select('id, recipient_id, kind, tone, created_at, read_at, email_dispatched_at')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) {
    console.log(`recent read error: ${error.message}`);
  } else {
    console.log(`\nMost recent 5:`);
    for (const n of data ?? []) {
      console.log(
        `  ${n.created_at}  ${n.kind}  tone=${n.tone}  read=${n.read_at ? 'y' : 'n'}  email=${n.email_dispatched_at ? 'sent' : 'no'}`,
      );
    }
  }
}

// 3. Recent inserts in the last 14 days by kind
{
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data, error } = await sb
    .from('notifications')
    .select('kind')
    .gte('created_at', since);
  if (error) {
    console.log(`\n14-day count error: ${error.message}`);
  } else {
    const byKind = new Map();
    for (const r of data ?? []) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
    console.log(`\nLast 14 days by kind (${data?.length ?? 0} total):`);
    for (const [k, v] of byKind) console.log(`  ${k}: ${v}`);
  }
}

// 4. Users with email_notifications preference set
{
  const { data, error } = await sb
    .from('users')
    .select('id, email, email_notifications')
    .limit(20);
  if (error) {
    console.log(`\nusers pref error: ${error.message}`);
  } else {
    console.log(`\nEmail-notifications preference (first 20 users):`);
    let on = 0, off = 0;
    for (const u of data ?? []) {
      if (u.email_notifications) on++; else off++;
    }
    console.log(`  opted in: ${on} · opted out: ${off}`);
  }
}

// 5. Is the webhook configured? (Cannot read GUCs via anon; skip; note check.)
console.log(`\napp.notification_webhook_url — GUC-level, cannot read via REST. Check with:`);
console.log(`  SELECT current_setting('app.notification_webhook_url', true);`);
console.log(`\napp.notification_webhook_secret — same.`);
