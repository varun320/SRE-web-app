/**
 * Provision the first admin on a fresh Supabase project.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   ADMIN_EMAIL=you@sulfurrecovery.com \
 *   ADMIN_PASSWORD='<temp password>' \
 *     node scripts/provision-admin.mjs
 */
import { createClient } from '@supabase/supabase-js';

const URL    = process.env.SUPABASE_URL;
const KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL  = process.env.ADMIN_EMAIL;
const PASS   = process.env.ADMIN_PASSWORD;
const NAME   = process.env.ADMIN_NAME ?? 'Admin';
const CODE   = process.env.ADMIN_CODE ?? 'A001';

for (const [k, v] of Object.entries({ SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: KEY, ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD: PASS })) {
  if (!v) { console.error(`missing env: ${k}`); process.exit(1); }
}

const sb = createClient(URL, KEY);

// 1. Get org_id (created by seed.sql)
const { data: org, error: orgErr } = await sb.from('organizations').select('id').limit(1).single();
if (orgErr || !org) { console.error('no organization seeded; run supabase db query -f supabase/seed.sql first'); process.exit(1); }

// 2. Pick first position
const { data: pos } = await sb.from('positions').select('id').limit(1).single();

// 3. Clean up any prior auth row with same email (idempotent)
const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
const prior = list.users.find((u) => u.email === EMAIL);
if (prior) {
  console.log('removing prior auth user:', EMAIL);
  await sb.auth.admin.deleteUser(prior.id);
}

// 4. Create auth user
const { data: created, error: authErr } = await sb.auth.admin.createUser({
  email: EMAIL, password: PASS, email_confirm: true,
});
if (authErr) { console.error('createUser failed:', authErr.message); process.exit(1); }
const uid = created.user.id;
console.log('auth user created:', uid);

// 5. Insert public.users row
const { error: usrErr } = await sb.from('users').insert({
  id: uid, org_id: org.id, full_name: NAME, email: EMAIL,
  employee_code: CODE, department: 'Operations', position_id: pos?.id ?? null, is_active: true,
});
if (usrErr) { console.error('users insert failed:', usrErr.message); process.exit(1); }

// 6. Grant admin + employee roles
await sb.from('user_roles').insert([
  { user_id: uid, role: 'admin' },
  { user_id: uid, role: 'employee' },
]);

console.log('\nDONE — sign in at /login as:', EMAIL);
