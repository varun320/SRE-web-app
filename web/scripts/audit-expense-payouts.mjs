// Debug: verify what admin sees on the payments table vs raw payouts.
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

const { data: payouts } = await sb.from('expense_payouts').select('invoice_no, user_id, amount_cad').order('invoice_no');
const { data: agg } = await sb.from('v_expense_payout_agg').select('*');

console.log(`raw expense_payouts: ${payouts.length} rows`);
console.log(`v_expense_payout_agg: ${agg.length} rows\n`);

const uid = '417a1a65-8b2f-4581-9ef5-86fbca5c7725';
const { data: reports } = await sb.from('expense_reports').select('invoice_no, status, total_cad').eq('user_id', uid).order('invoice_no');
console.log('utsav reports vs computed paid:');
for (const r of reports) {
  const row = agg.find((a) => a.invoice_no === r.invoice_no && a.user_id === uid);
  const paid = row ? Number(row.paid_to_date) : 0;
  const total = Number(r.total_cad);
  const disp =
    (r.status !== 'approved' && r.status !== 'paid') ? '—' :
    paid <= 0                     ? 'Unpaid' :
    paid + 0.005 < total          ? 'Partially Paid' :
                                    'Paid';
  console.log(`  ${r.invoice_no}  status=${r.status.padEnd(9)} total=${total.toFixed(2).padStart(10)}  paid=${paid.toFixed(2).padStart(10)}  → ${disp}`);
}

console.log('\nall payouts:');
for (const p of payouts) console.log(`  ${p.invoice_no} amount=${p.amount_cad}`);
