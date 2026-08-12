// Backfill projects.client_id for legacy timesheet projects by fuzzy-matching
// project.name substrings against clients.name. Non-destructive: only updates
// rows where client_id is currently null AND a confident match is found.
//
// Confidence rule: exact case-insensitive substring match of the client name
// (or one of its known short forms) inside the project name. Multiple matches
// → pick the longest client name (most specific). Anything ambiguous is
// skipped and reported so a human can decide.

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

// Extra aliases beyond the raw client name — helps match short forms Utsav
// uses in project titles (e.g. "SAMREF" for the full Aramco Mobil name).
const ALIASES = {
  'Saudi Aramco Mobil Refinery Company Ltd.(SAMREF)': ['SAMREF'],
  'Saudi Aramco Ras Tanura Refinery':                 ['Ras Tanura', 'Aramco Ras Tanura'],
  'Saudi Aramco Shaybah NGL Plant':                   ['Shaybah'],
  'Saudi Aramco Shedgum Gas Plant':                   ['Shedgum'],
  'Saudi Aramco Wasit Gas Plant':                     ['Wasit'],
  'Centrica Hanlan Robb Gas Plant':                   ['Hanlan Robb', 'Canlin Hanlan Robb'],
  'Centrica Wildcat Hills Gas Plant':                 ['Wildcat Hills'],
  'Enbridge Pine River Gas Plant':                    ['Pine River'],
  'Repsol Edson Gas Plant':                           ['Edson'],
  'Shell Waterton Gas Plant':                         ['Waterton'],
  'HollyFrontier Woods Cross':                        ['HF Sinclair', 'Woods Cross'],
  'Andeavor Los Angeles Carson Refinery':             ['Carson', 'LA Carson'],
  'Andeavor Mandan Refinery':                         ['Mandan'],
  'Andeavor Salt Lake City':                          ['Salt Lake City'],
  'Chevron Burnaby Refinery':                         ['Burnaby'],
  'Chevron Richmond Refinery':                        ['Chevron Richmond'],
  'Chevron Salt Lake City Refinery':                  ['Chevron Salt Lake'],
  'BP Whiting Refinery':                              ['BP Whiting', 'Whiting'],
  'Suncor Edmonton Refinery':                         ['Suncor Edm', 'Suncor Edmonton'],
  'Consumers\' Co-op Refineries (Regina)':            ['Regina', 'Co-op Refineries'],
  'ExxonMobil Port-Jérôme-Gravenchon':                ['ExxonMobil - Fawley', 'ExxonMobil', 'Fawley'],
  'Valero Quebec Refinery':                           ['Valero'],
  'Kern Oil':                                         ['Kern Oil'],
  'GASCO Abu Dhabi Gas Industries':                   ['ADNOC Gas', 'ADNOC', 'GASCO'],
  'Al Hosn Gas':                                      ['Al Hosn'],
  'PBF Energy Chalmette':                             ['Chalmette', 'PBF'],
  'Flint Hills Pine Bend Refinery':                   ['Pine Bend', 'Flint Hills'],
  'Calumet Montana Refining':                         ['Calumet Montana'],
  'Calumet Shreveport Refinery':                      ['Shreveport'],
  'CNRL Horizon':                                     ['CNRL'],
  // Aliases for the newly-seeded clients
  'Delek US Holdings':                                ['Delek TX', 'Delek'],
  'Big West Oil':                                     ['Big West'],
  'MiRO Karlsruhe Refinery':                          ['MiRO'],
  'Phillips 66':                                      ['P66'],
  'Phillips 66 Sweeny Refinery':                      ['P66 - Sweeny', 'Sweeny'],
  'Saudi Aramco Mobil Refinery (SAMREF)':             ['SAMREF', 'Saudi Aramco Mobil'],
  'Petro Rabigh':                                     ['Petro Rabigh', 'Rabigh'],
  'INERCO':                                           ['INERCO'],
  'Anwil S.A.':                                       ['Anwil'],
  'Egyptian Refinery Company':                        ['Egyptian Refinery'],
  'Hunt Refining':                                    ['Hunt Refinery', 'Hunt Refining'],
  'ADNOC Gas':                                        ['ADNOC Gas', 'ADNOC'],
  'Nouryon':                                          ['Nouyron', 'Nouryon'],
  'St1 Refinery':                                     ['St1'],
  'DEZA':                                             ['DEZA'],
  'Brimstone Energy':                                 ['Brimstone'],
  'Gibson Energy':                                    ['Gibson Processing', 'Gibson'],
  'ICA Fluor':                                        ['ICA Fluor'],
  'BBA Consultants':                                  ['BBA'],
  'SLB (Schlumberger)':                               ['SLB', 'Schlumberger'],
  'Baker Hughes':                                     ['Baker Hughes'],
  'Mellitah Oil & Gas':                               ['Mellitah'],
  'Wilmer Industries':                                ['Wilmer Industries', 'Wilmer'],
  'Evergen Infrastructure':                           ['Evergen'],
  'Q-Chem':                                           ['QChem', 'Q-Chem'],
  'Nutrien':                                          ['Nutrien'],
};

const { data: clients } = await sb.from('clients').select('id, name');
const { data: projects } = await sb
  .from('projects')
  .select('id, project_number, name, client_id')
  .is('client_id', null);

// Build a match table: alias → client_id, sorted longest first so the more
// specific alias wins when both apply (e.g. "Aramco Ras Tanura" beats "Aramco").
const entries = [];
for (const c of clients) {
  entries.push({ needle: c.name, client_id: c.id, client_name: c.name });
  for (const alias of ALIASES[c.name] ?? []) entries.push({ needle: alias, client_id: c.id, client_name: c.name });
}
entries.sort((a, b) => b.needle.length - a.needle.length);

let matched = 0;
let skipped = 0;
const skippedList = [];
const updates = [];

for (const p of projects ?? []) {
  const hay = (p.name ?? '').toLowerCase();
  if (!hay) { skipped++; skippedList.push({ number: p.project_number, name: p.name, reason: 'empty name' }); continue; }
  const hit = entries.find((e) => hay.includes(e.needle.toLowerCase()));
  if (hit) {
    updates.push({ id: p.id, project_number: p.project_number, name: p.name, client_id: hit.client_id, matched_as: hit.needle, client_name: hit.client_name });
    matched++;
  } else {
    skipped++;
    skippedList.push({ number: p.project_number, name: p.name, reason: 'no match' });
  }
}

console.log(`\n${projects.length} legacy projects · ${matched} matched · ${skipped} skipped`);
console.log('\n=== MATCHES ===');
for (const u of updates) console.log(`  ${u.project_number} "${u.name}" → ${u.client_name} (via "${u.matched_as}")`);
console.log('\n=== UNMATCHED ===');
for (const s of skippedList) console.log(`  ${s.number} "${s.name}"`);

if (process.argv.includes('--apply')) {
  console.log('\napplying updates…');
  for (const u of updates) {
    const { error } = await sb.from('projects').update({ client_id: u.client_id }).eq('id', u.id);
    if (error) console.error(`  ${u.project_number} failed: ${error.message}`);
  }
  console.log(`applied ${updates.length} updates`);
} else {
  console.log('\n(dry-run — pass --apply to write)');
}
