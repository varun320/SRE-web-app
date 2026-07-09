// Quick smoke test for the new weekly-overtime rule.
// Runs computeTotals against scenarios from Utsav's 2026-07-06 feedback.
import { computeTotals } from '../lib/totals.ts';

const SUBS = [
  { id: 'proj',   main_category: 'Project', name: 'Site Work',      requires_project: true,  consumes_til: false, consumes_vacation: false, is_overtime_taken: false, sort_order: 0 },
  { id: 'til',    main_category: 'Admin',   name: 'Overtime Taken', requires_project: false, consumes_til: true,  consumes_vacation: false, is_overtime_taken: true,  sort_order: 0 },
  { id: 'payout', main_category: 'Admin',   name: 'TIL Payout',     requires_project: false, consumes_til: true,  consumes_vacation: false, is_overtime_taken: false, sort_order: 0 },
  { id: 'vac',    main_category: 'Admin',   name: 'Vacation Hours', requires_project: false, consumes_til: false, consumes_vacation: true,  is_overtime_taken: false, sort_order: 0 },
];

function row(subId, hrs) {
  const [mon, tue, wed, thu, fri, sat, sun] = hrs;
  return {
    main_category: subId === 'proj' ? 'Project' : 'Admin',
    sub_category_id: subId, project_id: subId === 'proj' ? 'p1' : null,
    mon_hrs: mon, tue_hrs: tue, wed_hrs: wed, thu_hrs: thu, fri_hrs: fri, sat_hrs: sat, sun_hrs: sun,
    description: 't', position: 0,
  };
}

const cases = [
  { name: '20h all on Monday (Utsav bug)',                  rows: [row('proj', [20, 0, 0, 0, 0, 0, 0])],                            expect: 0 },
  { name: '8h Mon–Fri = 40h flat',                          rows: [row('proj', [8, 8, 8, 8, 8, 0, 0])],                            expect: 0 },
  { name: '9h Mon–Fri = 45h',                               rows: [row('proj', [9, 9, 9, 9, 9, 0, 0])],                            expect: 5 },
  { name: '40h Mon–Fri + 6h Saturday',                      rows: [row('proj', [8, 8, 8, 8, 8, 6, 0])],                            expect: 6 },
  { name: '30h Mon–Fri + 8h Saturday (weekend fills to 40)', rows: [row('proj', [6, 6, 6, 6, 6, 8, 0])],                           expect: 0 },
  { name: '50h Mon–Fri + 4h TIL Payout (payout excluded)',  rows: [row('proj', [10,10,10,10,10, 0, 0]), row('payout', [4, 0, 0, 0, 0, 0, 0])], expect: 10 },
  { name: '32h Mon–Thu + 8h TIL Taken on Fri (Utsav 07-08)', rows: [row('proj', [8, 8, 8, 8, 0, 0, 0]), row('til', [0, 0, 0, 0, 8, 0, 0])], expect: 0 },
  { name: '40h Mon–Fri + 8h TIL Taken (no double-count)',    rows: [row('proj', [8, 8, 8, 8, 8, 0, 0]), row('til', [0, 0, 0, 0, 8, 0, 0])], expect: 0 },
  { name: '40h Mon–Fri + 8h Sat + 8h Vacation Fri',          rows: [row('proj', [8, 8, 8, 8, 8, 8, 0]), row('vac', [0, 0, 0, 0, 8, 0, 0])], expect: 8 },
];

let failed = 0;
for (const c of cases) {
  const t = computeTotals(c.rows, SUBS);
  const ok = Math.abs(t.overtime_earned - c.expect) < 0.001;
  console.log(`${ok ? '✓' : '✗'} ${c.name}  →  total=${t.total_hrs}  ot=${t.overtime_earned}  (expected ${c.expect})`);
  if (!ok) failed++;
}
process.exit(failed);
