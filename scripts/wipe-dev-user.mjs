/**
 * Wipe the dev test user's app data (timesheets, entries, expenses, ledgers,
 * receipts, notifications, audit logs). Keeps the auth account + role + card
 * setup untouched so the login creds continue to work.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *     node scripts/wipe-dev-user.mjs [email]
 *
 * Default email: dev@sulfurrecovery.com
 */
import { createRequire } from 'node:module';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');

const SB_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !KEY) {
  console.error('missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const EMAIL = process.argv[2] ?? 'dev@sulfurrecovery.com';
const sb = createClient(SB_URL, KEY, { auth: { persistSession: false } });

const { data: user, error: userErr } = await sb
  .from('users')
  .select('id, full_name, email')
  .eq('email', EMAIL)
  .maybeSingle();
if (userErr) throw userErr;
if (!user) {
  console.error(`no user with email ${EMAIL}`);
  process.exit(1);
}
const userId = user.id;
console.log(`wiping data for ${user.full_name} <${user.email}> (${userId})`);

// Simple delete + count. Timesheet entries cascade from timesheets; expense
// lines + payouts cascade from expense_reports. Everything else is a direct
// delete keyed on user_id.
async function wipe(table, filter = { user_id: userId }) {
  const [col, val] = Object.entries(filter)[0];
  const { count, error } = await sb.from(table).delete({ count: 'exact' }).eq(col, val);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ${table.padEnd(28)} -${count ?? 0}`);
}

console.log('deleting app data:');
await wipe('timesheets');            // cascades to timesheet_entries
await wipe('expense_reports');       // cascades to expense_line_items
await wipe('expense_payouts');
await wipe('til_ledger');
await wipe('vacation_ledger');
await wipe('notifications');
await wipe('approval_log', { actor_id: userId });         // if this user acted
await wipe('expense_approval_log', { actor_id: userId }); // same
await wipe('user_credit_cards');
await wipe('import_batches', { imported_by: userId });

// Storage: purge all receipts under expense-receipts/{user_id}/
console.log('deleting receipts from storage:');
const { data: files, error: listErr } = await sb.storage
  .from('expense-receipts')
  .list(userId, { limit: 1000 });
if (listErr && listErr.message !== 'The resource was not found') throw listErr;

if (files && files.length > 0) {
  // Recursively list — first level is expense_id folders.
  const paths = [];
  for (const f of files) {
    if (f.name && !f.metadata) {
      // subfolder — list its children
      const { data: children } = await sb.storage
        .from('expense-receipts')
        .list(`${userId}/${f.name}`, { limit: 1000 });
      for (const c of children ?? []) paths.push(`${userId}/${f.name}/${c.name}`);
    } else {
      paths.push(`${userId}/${f.name}`);
    }
  }
  if (paths.length) {
    const { error: rmErr } = await sb.storage.from('expense-receipts').remove(paths);
    if (rmErr) throw rmErr;
    console.log(`  expense-receipts             -${paths.length}`);
  } else {
    console.log('  expense-receipts             -0');
  }
} else {
  console.log('  expense-receipts             -0');
}

console.log(`\nDone. Login creds for ${EMAIL} still work.`);
