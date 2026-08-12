// Creates a single synthetic payout row for each report where
// status='paid' AND sum(payouts) < total. Payout date = submission_date
// (best available proxy), amount = outstanding, reference = 'legacy import'.
//
// Dry-run by default. Pass --apply to write.

import { readFileSync } from 'node:fs';
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

const { data: paidReports } = await sb
  .from('expense_reports')
  .select('id, user_id, invoice_no, submission_date, decided_at, total_cad, org_id')
  .eq('status', 'paid');

const { data: agg } = await sb
  .from('v_expense_payout_agg')
  .select('user_id, invoice_no, paid_to_date');
const paidBy = new Map((agg ?? []).map((p) => [`${p.user_id}:${p.invoice_no}`, Number(p.paid_to_date)]));

const missing = (paidReports ?? [])
  .map((r) => {
    const paid = paidBy.get(`${r.user_id}:${r.invoice_no}`) ?? 0;
    const total = Number(r.total_cad);
    return { r, paid, total, outstanding: total - paid };
  })
  .filter((m) => m.outstanding > 0.005);

console.log(`${paidReports?.length ?? 0} paid reports · ${missing.length} missing a payout row`);
for (const m of missing) {
  const date = m.r.decided_at?.slice(0, 10) ?? m.r.submission_date ?? new Date().toISOString().slice(0, 10);
  console.log(`  ${m.r.invoice_no}  total=${m.total.toFixed(2)}  paid=${m.paid.toFixed(2)}  → +${m.outstanding.toFixed(2)} on ${date}`);
}

if (!process.argv.includes('--apply')) {
  console.log('\n(dry-run — pass --apply to write)');
  process.exit(0);
}

// created_by is NOT NULL — attribute the synthetic payout to whoever approved
// the report (decided_by) if available, else the first admin.
const { data: firstAdmin } = await sb.from('user_roles').select('user_id').eq('role', 'admin').limit(1).single();
const fallbackActor = firstAdmin?.user_id;

console.log('\napplying…');
let applied = 0;
for (const m of missing) {
  const date = m.r.decided_at?.slice(0, 10) ?? m.r.submission_date ?? new Date().toISOString().slice(0, 10);
  const { data: full } = await sb.from('expense_reports').select('decided_by').eq('id', m.r.id).single();
  const actor = full?.decided_by ?? fallbackActor;
  if (!actor) { console.error(`  ${m.r.invoice_no}: no actor available`); continue; }
  const { error } = await sb.from('expense_payouts').insert({
    user_id:     m.r.user_id,
    org_id:      m.r.org_id ?? ORG_ID,
    invoice_no:  m.r.invoice_no,
    payout_date: date,
    amount_cad:  m.outstanding,
    reference:   'legacy import backfill',
    notes:       'auto-created to reconcile status=paid with zero payout rows',
    created_by:  actor,
  });
  if (error) { console.error(`  ${m.r.invoice_no}: ${error.message}`); continue; }
  applied++;
}
console.log(`applied ${applied} payout rows`);
