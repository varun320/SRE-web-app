// Cleans up: scratch UI test user + any projects created during the UI test.
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ''), env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const credsPath = resolve(__dirname, '.ui-test-creds.json');
if (!existsSync(credsPath)) { console.log('no creds file — nothing to clean'); process.exit(0); }
const { uid } = JSON.parse(readFileSync(credsPath, 'utf8'));

// Delete any test projects created (project_number 2099900..2099999 range)
const { data: testProjects } = await sb.from('projects').select('id, project_number').gte('project_number', 2099900).lte('project_number', 2099999);
for (const p of testProjects ?? []) {
  await sb.from('projects').delete().eq('id', p.id);
  console.log(`deleted project ${p.project_number}`);
}

// Delete UI test contacts and sites (created inline during test)
await sb.from('contacts').delete().ilike('name', 'UI Test%');
await sb.from('sites').delete().ilike('name', 'UI Test%');

// Delete user
await sb.from('user_roles').delete().eq('user_id', uid);
await sb.from('users').delete().eq('id', uid);
await sb.auth.admin.deleteUser(uid);
unlinkSync(credsPath);
console.log('UI test user cleaned');
