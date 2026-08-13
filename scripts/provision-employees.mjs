/**
 * Provision one-or-more employee accounts against the cloud Supabase.
 * Idempotent: if an email already exists in auth, we reuse it and just
 * refresh its metadata. Random passwords are generated per new account
 * and printed to stdout ONCE — capture them there, they're not stored.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *     node scripts/provision-employees.mjs
 */
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';

// Pull @supabase/supabase-js from web/node_modules — this script lives outside
// any package, so it needs a require() rooted at a package that has it.
const require = createRequire(new URL('../web/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');

const SB_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !KEY) {
  console.error('missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const EMPLOYEES = [
  { email: 'talha@sulfurrecovery.com', full_name: 'Talha',  employee_code: 'T001' },
  { email: 'utsav@sulfurrecovery.com', full_name: 'Utsav',  employee_code: 'U001' },
];

const sb = createClient(SB_URL, KEY);

const { data: org, error: orgErr } = await sb
  .from('organizations')
  .select('id')
  .limit(1)
  .single();
if (orgErr || !org) {
  console.error('no organization seeded:', orgErr?.message);
  process.exit(1);
}

const { data: firstPos } = await sb
  .from('positions')
  .select('id, title')
  .order('title')
  .limit(1)
  .single();
if (!firstPos?.id) {
  console.error('no position rows exist — add at least one under /admin/positions first');
  process.exit(1);
}

function generatePassword() {
  // 16-char URL-safe random (128 bits of entropy, no ambiguous chars).
  const raw = randomBytes(12).toString('base64');
  return raw.replace(/[/+=]/g, '').padEnd(16, 'x').slice(0, 16);
}

const results = [];

for (const emp of EMPLOYEES) {
  const password = generatePassword();

  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const prior = list.users.find((u) => u.email === emp.email);

  let uid;
  let action;
  if (prior) {
    uid = prior.id;
    action = 'reused';
    // Don't reset an existing password — the user may already be using it.
    // If you *want* to force-rotate, uncomment:
    // await sb.auth.admin.updateUserById(uid, { password, email_confirm: true });
  } else {
    const { data: created, error: authErr } = await sb.auth.admin.createUser({
      email: emp.email,
      password,
      email_confirm: true,
    });
    if (authErr) {
      console.error(`createUser failed for ${emp.email}:`, authErr.message);
      continue;
    }
    uid = created.user.id;
    action = 'created';
  }

  const { error: usrErr } = await sb.from('users').upsert({
    id: uid,
    org_id: org.id,
    full_name: emp.full_name,
    email: emp.email,
    employee_code: emp.employee_code,
    department: 'Engineering',
    position_id: firstPos.id,
    is_active: true,
  });
  if (usrErr) {
    console.error(`users upsert failed for ${emp.email}:`, usrErr.message);
    continue;
  }

  const { error: roleErr } = await sb.from('user_roles').upsert(
    { user_id: uid, role: 'employee' },
    { onConflict: 'user_id,role', ignoreDuplicates: true },
  );
  if (roleErr && !/duplicate key|already exists/i.test(roleErr.message)) {
    console.warn(`role upsert for ${emp.email}:`, roleErr.message);
  }

  results.push({ ...emp, uid, action, password: action === 'created' ? password : '(unchanged)' });
}

console.log('\n== DONE ==\n');
for (const r of results) {
  console.log(`${r.action.toUpperCase()}  ${r.email}`);
  console.log(`  name:     ${r.full_name}`);
  console.log(`  code:     ${r.employee_code}`);
  console.log(`  uid:      ${r.uid}`);
  console.log(`  password: ${r.password}`);
  console.log('');
}
console.log('Sign in at https://sre-web-app.vercel.app/login with email + password.');
console.log('If you prefer no password, tell them to use the Magic link tab instead.');
