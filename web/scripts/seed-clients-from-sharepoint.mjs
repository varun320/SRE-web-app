// One-off: seed clients table from SharePoint /Clients/ folders with location-in-name.
// Geocodes via Nominatim, inserts via pg. Skips rows that fail to geocode.
// Usage: node scripts/seed-clients-from-sharepoint.mjs
import { Client } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const DB_URL = env.NEW_DB_URL;
if (!DB_URL) throw new Error('NEW_DB_URL missing');

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const BASE = 'https://srecovery.sharepoint.com/Clients/';

// name, geocoding query, sharepoint slug (URL segment after /Clients/)
const ENTRIES = [
  ['SAPREF Durban',                       'Durban, South Africa',                         'SAPREF'],
  ['Andeavor Salt Lake City',             'Salt Lake City, Utah, USA',                    'ASLC'],
  ['Husky Prince George Refinery',        'Prince George, British Columbia, Canada',      'HPGR'],
  ['Husky Ram River Gas Plant',           'Nordegg, Alberta, Canada',                     'HRRGP'],
  ['SemCAMS K3 Gas Plant',                'Fox Creek, Alberta, Canada',                   'SemCAMS K3'],
  ['SemCAMS KA Gas Plant',                'Kaybob, Alberta, Canada',                      'SemCAMS KA'],
  ['Altagas Harmattan',                   'Didsbury, Alberta, Canada',                    'Altagas Harmattan'],
  ['CNRL Horizon',                        'Fort McMurray, Alberta, Canada',               'CNRL Horizon'],
  ['Esso Slagen Refinery',                'Tønsberg, Norway',                             'Esso Slagen Refinery'],
  ['PBF Energy Chalmette',                'Chalmette, Louisiana, USA',                    'PBF Energy Chalmette'],
  ['Al Hosn Gas',                         'Shah, Abu Dhabi, UAE',                         'Al Hosn Gas'],
  ['Chevron Salt Lake City Refinery',     'Salt Lake City, Utah, USA',                    'Chevron Salt Lake City'],
  ['Valero Quebec Refinery',              'Lévis, Quebec, Canada',                        'Valero Quebec Refinery'],
  ["Consumers' Co-op Refineries (Regina)",'Regina, Saskatchewan, Canada',                 'CCRL'],
  ['CNRL Progress',                       'Progress, British Columbia, Canada',           'CNRL Progress'],
  ['CNRL South Sturgeon',                 'Sturgeon County, Alberta, Canada',             'CNRL South Sturgeon'],
  ['CNRL Hays',                           'Hays, Alberta, Canada',                        'CNRL Hays'],
  ['Keyera Strachan Gas Plant',           'Strachan, Alberta, Canada',                    'Keyera Strachan'],
  ['Keyera Simonette Gas Plant',          'Simonette, Alberta, Canada',                   'Keyera  Simonette'],
  ['Keyera Nevis & Rimbey',               'Rimbey, Alberta, Canada',                      'KEYERANR'],
  ['Esso Sriracha Refinery',              'Sriracha Refinery, Chonburi, Thailand',        'Esso Sriracha Refinery'],
  ['Esso Slagen Refinery',                'Slagen Refinery, Tønsberg, Norway',            'Esso Slagen Refinery'],
  ['ExxonMobil Port-Jérôme-Gravenchon',   'Port-Jérôme-sur-Seine, France',                'EMPJG'],
  ['Flint Hills Pine Bend Refinery',      'Pine Bend Refinery, Rosemount, Minnesota',     'FHRPBR'],
  ['PBF Energy Chalmette',                'Chalmette Refinery, Louisiana, USA',           'PBF Energy Chalmette'],
  ['Kern Oil',                            'Bakersfield, California, USA',                 'Kern Oil'],
  ['Al Hosn Gas',                         'Shah Gas Field, Abu Dhabi, UAE',               'Al Hosn Gas'],
  ['GASCO Abu Dhabi Gas Industries',      'Habshan, Abu Dhabi, UAE',                      'GASCO'],
  ['Tesoro LA Wilmington',                'Wilmington Refinery, Los Angeles, California', 'Tesoro LA Wilmington'],
  ['Bayernoil Vohburg Refinery',          'Vohburg an der Donau, Bayern, Germany',        'Bayernoil Vohburg Refinery'],
  ['Chevron Burnaby Refinery',            'Burnaby Refinery, British Columbia, Canada',   'Chevron Burnaby Refinery'],
  ['Chevron Richmond Refinery',           'Chevron Richmond Refinery, California, USA',   'Chevron Richmond Refinery'],
  ['Chevron Salt Lake City Refinery',     'Chevron Salt Lake City Refinery, Utah, USA',   'Chevron Salt Lake City'],
  ['BP Whiting Refinery',                 'Whiting Refinery, Indiana, USA',               'BP Whiting Refinery'],
  ['Calumet Montana Refining',            'Great Falls, Montana, USA',                    'Calumet Montana Refining'],
  ['Calumet Shreveport Refinery',         'Shreveport, Louisiana, USA',                   'Calumet Shreveport Refinery'],
  ['HollyFrontier Woods Cross',           'Woods Cross Refinery, Utah, USA',              'HollyFrontier Woods Cross'],
  ['Suncor Edmonton Refinery',            'Suncor Edmonton Refinery, Alberta, Canada',    'Suncor Edmonton Refinery'],
  ['Valero Quebec Refinery',              'Jean-Gaulin Refinery, Lévis, Quebec, Canada',  'Valero Quebec Refinery'],
  ["Consumers' Co-op Refineries (Regina)", 'Co-op Refinery Complex, Regina, Saskatchewan','CCRL'],
];

async function geocode(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'SRE-app seeder (maaz@sulfurrecovery.com)' } });
  if (!r.ok) return null;
  const data = await r.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let inserted = 0, failed = 0, skipped = 0;
  for (const [name, query, slug] of ENTRIES) {
    const exists = await c.query('select 1 from public.clients where org_id = $1 and name = $2', [ORG_ID, name]);
    if (exists.rowCount) { skipped++; console.log('SKIP  (exists):', name); continue; }
    const coords = await geocode(query);
    await sleep(1100);
    if (!coords) { failed++; console.log('FAIL  (no geocode):', name, '←', query); continue; }
    const sharepointUrl = BASE + encodeURI(slug);
    await c.query(
      'insert into public.clients (org_id, name, location, lat, lng, sharepoint_url) values ($1,$2,$3,$4,$5,$6)',
      [ORG_ID, name, query, coords.lat, coords.lng, sharepointUrl]
    );
    inserted++;
    console.log(`OK    ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}  ${name}`);
  }
  await c.end();
  console.log(`\nInserted: ${inserted}   Failed: ${failed}   Skipped(existing): ${skipped}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
