/**
 * Provision (or refresh) the dev test user with admin + employee roles and
 * opening TIL / vacation balances. Idempotent — safe to re-run.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *     node scripts/provision-dev-user.mjs
 */
import { createClient } from '@supabase/supabase-js';

const URL   = process.env.SUPABASE_URL;
const KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.DEV_EMAIL    ?? 'dev@sulfurrecovery.com';
const PASS  = process.env.DEV_PASSWORD ?? 'Sulfur2026!';
const NAME  = process.env.DEV_NAME     ?? 'Dev Tester';
const CODE  = process.env.DEV_CODE     ?? 'DEV1';

for (const [k, v] of Object.entries({ SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: KEY })) {
  if (!v) { console.error(`missing env: ${k}`); process.exit(1); }
}

const sb = createClient(URL, KEY);

const { data: org, error: orgErr } = await sb.from('organizations').select('id').limit(1).single();
if (orgErr || !org) { console.error('no organization seeded'); process.exit(1); }

const { data: pos } = await sb
  .from('positions')
  .select('id, title')
  .ilike('title', '%senior%engineer%')
  .maybeSingle();
const positionId = pos?.id
  ?? (await sb.from('positions').select('id').limit(1).single()).data?.id
  ?? null;

// Idempotent auth create: reuse existing user or create new.
const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
const prior = list.users.find((u) => u.email === EMAIL);

let uid;
if (prior) {
  uid = prior.id;
  // Reset password so credentials stay in sync with dev-credentials.md.
  await sb.auth.admin.updateUserById(uid, { password: PASS, email_confirm: true });
  console.log('reused auth user:', uid);
} else {
  const { data: created, error: authErr } = await sb.auth.admin.createUser({
    email: EMAIL, password: PASS, email_confirm: true,
  });
  if (authErr) { console.error('createUser failed:', authErr.message); process.exit(1); }
  uid = created.user.id;
  console.log('created auth user:', uid);
}

// Upsert public.users
const { error: usrErr } = await sb.from('users').upsert({
  id: uid, org_id: org.id, full_name: NAME, email: EMAIL,
  employee_code: CODE, department: 'Operations', position_id: positionId, is_active: true,
});
if (usrErr) { console.error('users upsert failed:', usrErr.message); process.exit(1); }

// Grant both roles (unique per (user_id, role), so ignore duplicate errors).
for (const role of ['admin', 'employee']) {
  const { error } = await sb.from('user_roles').upsert(
    { user_id: uid, role },
    { onConflict: 'user_id,role', ignoreDuplicates: true },
  );
  if (error && !/duplicate key|already exists/i.test(error.message)) {
    console.warn(`role ${role} upsert:`, error.message);
  }
}

// Opening ledgers — dated the Monday before "today" so the current week is fresh.
const today = new Date();
const dow = today.getUTCDay(); // 0..6 (Sun..Sat)
const daysBackToLastMonday = ((dow + 6) % 7) + 7; // one week + shift to Monday
const openingWeek = new Date(today);
openingWeek.setUTCDate(today.getUTCDate() - daysBackToLastMonday);
const openingWeekStr = openingWeek.toISOString().slice(0, 10);

async function upsertLedger(table, extra) {
  const { error } = await sb.from(table).upsert(
    { user_id: uid, week_start: openingWeekStr, frozen: true, stale: false, ...extra },
    { onConflict: 'user_id,week_start' },
  );
  if (error && !/no unique|duplicate|violates/i.test(error.message)) {
    console.warn(`${table} upsert:`, error.message);
  }
}

// closing_balance is a generated column on both ledgers — don't set it.
await upsertLedger('til_ledger', {
  opening_balance: 40, overtime_earned: 0, til_used: 0,
});
await upsertLedger('vacation_ledger', {
  opening_balance: 200, vacation_used: 0,
});

console.log('\nDONE — sign in at /login as:', EMAIL);
console.log('  password:', PASS);
console.log('  roles:   admin + employee');
console.log('  opening: 40h TIL, 200h vacation (week', openingWeekStr, ')');
