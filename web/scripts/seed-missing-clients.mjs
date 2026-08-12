// Adds clients that appear as project names but aren't in the clients table.
// Coordinates are approximate — user can tune them on /clients admin later.
// Idempotent: skips inserts if a client with the same name already exists.

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

const CLIENTS = [
  { name: 'Delek US Holdings',                     location: 'Big Spring, TX',        lat: 31.3521,  lng: -101.4785 },
  { name: 'Big West Oil',                          location: 'North Salt Lake, UT',   lat: 40.8438,  lng: -111.9099 },
  { name: 'MiRO Karlsruhe Refinery',               location: 'Karlsruhe, Germany',    lat: 48.9925,  lng:    8.3855 },
  { name: 'Phillips 66',                           location: 'Houston, TX',           lat: 29.7604,  lng:  -95.3698 },
  { name: 'Phillips 66 Sweeny Refinery',           location: 'Sweeny, TX',            lat: 29.0388,  lng:  -95.7091 },
  { name: 'Nutrien',                               location: 'Saskatoon, SK',         lat: 52.1332,  lng: -106.6700 },
  { name: 'Saudi Aramco Mobil Refinery (SAMREF)',  location: 'Yanbu, Saudi Arabia',   lat: 24.0900,  lng:   38.0618 },
  { name: 'Petro Rabigh',                          location: 'Rabigh, Saudi Arabia',  lat: 22.7967,  lng:   39.0180 },
  { name: 'INERCO',                                location: 'Seville, Spain',        lat: 37.3891,  lng:   -5.9845 },
  { name: 'Anwil S.A.',                            location: 'Włocławek, Poland',     lat: 52.6483,  lng:   19.0678 },
  { name: 'Egyptian Refinery Company',             location: 'Cairo, Egypt',          lat: 30.0444,  lng:   31.2357 },
  { name: 'Hunt Refining',                         location: 'Tuscaloosa, AL',        lat: 33.2098,  lng:  -87.5692 },
  { name: 'ADNOC Gas',                             location: 'Abu Dhabi, UAE',        lat: 24.4539,  lng:   54.3773 },
  { name: 'Nouryon',                               location: 'Amsterdam, Netherlands',lat: 52.3676,  lng:    4.9041 },
  { name: 'St1 Refinery',                          location: 'Gothenburg, Sweden',    lat: 57.7089,  lng:   11.9746 },
  { name: 'DEZA',                                  location: 'Valašské Meziříčí, CZ', lat: 49.4720,  lng:   17.9714 },
  { name: 'Brimstone Energy',                      location: 'Oakland, CA',           lat: 37.8044,  lng: -122.2712 },
  { name: 'Gibson Energy',                         location: 'Calgary, AB',           lat: 51.0447,  lng: -114.0719 },
  { name: 'ICA Fluor',                             location: 'Mexico City, Mexico',   lat: 19.4326,  lng:  -99.1332 },
  { name: 'BBA Consultants',                       location: 'Montreal, QC',          lat: 45.5017,  lng:  -73.5673 },
  { name: 'SLB (Schlumberger)',                    location: 'Houston, TX',           lat: 29.7604,  lng:  -95.3698 },
  { name: 'Baker Hughes',                          location: 'Houston, TX',           lat: 29.7604,  lng:  -95.3698 },
  { name: 'Mellitah Oil & Gas',                    location: 'Mellitah, Libya',       lat: 33.3000,  lng:   11.7200 },
  { name: 'Wilmer Industries',                     location: 'Wilmer, TX',            lat: 32.5893,  lng:  -96.6836 },
  { name: 'Evergen Infrastructure',                location: 'Calgary, AB',           lat: 51.0447,  lng: -114.0719 },
  { name: 'Q-Chem',                                location: 'Mesaieed, Qatar',       lat: 24.9927,  lng:   51.5484 },
];

let inserted = 0;
let skipped  = 0;
for (const c of CLIENTS) {
  const { data: existing } = await sb.from('clients').select('id').eq('name', c.name).maybeSingle();
  if (existing) { skipped++; continue; }
  const { error } = await sb.from('clients').insert({ org_id: ORG_ID, ...c });
  if (error) { console.error(`  ${c.name}: ${error.message}`); continue; }
  inserted++;
  console.log(`  + ${c.name}`);
}
console.log(`\n${inserted} inserted · ${skipped} already existed`);
