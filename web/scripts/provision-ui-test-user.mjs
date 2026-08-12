// Provisions a scratch admin user for UI testing. Prints EMAIL / PASSWORD /
// USER_ID so a follow-up cleanup script can delete them. Kept tiny and dumb.
import { readFileSync, writeFileSync } from 'node:fs';
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
const ORG_ID = '00000000-0000-0000-0000-000000000001';

const email = `uitest-${Date.now()}@example.com`;
const password = `UiTest-${Date.now()}!`;
const { data: created, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
const uid = created.user.id;

const { data: pos } = await sb.from('positions').select('id').limit(1).single();
await sb.from('users').insert({ id: uid, org_id: ORG_ID, full_name: 'UI Test Admin', email, employee_code: `UITEST${Date.now() % 10000}`, position_id: pos.id });
await sb.from('user_roles').insert({ user_id: uid, role: 'admin' });

writeFileSync(resolve(__dirname, '.ui-test-creds.json'), JSON.stringify({ email, password, uid }, null, 2));
console.log(JSON.stringify({ email, password, uid }));
