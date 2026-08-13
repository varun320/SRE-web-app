/**
 * Migrate the SRE app from one Supabase project to another using pure Node
 * (no pg_dump/psql required). Streams table data directly via Postgres COPY.
 *
 * Reads credentials from `.env.new` at the repo root:
 *   OLD_DB_URL, NEW_DB_URL
 *   OLD_SUPABASE_URL, OLD_SERVICE_ROLE_KEY
 *   NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/migrate-to-new-supabase.mjs --phase=auth
 *   node scripts/migrate-to-new-supabase.mjs --phase=data
 *   node scripts/migrate-to-new-supabase.mjs --phase=storage
 *   node scripts/migrate-to-new-supabase.mjs --phase=verify
 *   node scripts/migrate-to-new-supabase.mjs --phase=all
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { Client } = require('pg');
const copyStreams = require('pg-copy-streams');
const { createClient } = require('@supabase/supabase-js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', 'web', '.env.new');

function loadEnv() {
  const raw = readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  env.NEW_SUPABASE_URL ||= env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '');
  env.NEW_SERVICE_ROLE_KEY ||= env.SUPABASE_SERVICE_ROLE_KEY;
  const required = [
    'OLD_DB_URL', 'NEW_DB_URL',
    'OLD_SUPABASE_URL', 'OLD_SERVICE_ROLE_KEY',
    'NEW_SUPABASE_URL', 'NEW_SERVICE_ROLE_KEY',
  ];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) {
    console.error(`Missing in .env.new: ${missing.join(', ')}`);
    process.exit(1);
  }
  return env;
}

async function connect(url) {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

async function tableCount(client, qualified) {
  const r = await client.query(`select count(*)::text as c from ${qualified}`);
  return r.rows[0].c;
}

/**
 * Stream a single table from old → new using COPY BINARY. Idempotent-ish:
 * if the target table has rows already, we bail (caller must truncate first).
 */
async function copyTable(oldC, newC, qualified) {
  const before = await tableCount(newC, qualified);
  if (before !== '0') {
    console.log(`  ${qualified.padEnd(40)} skip (already has ${before} rows)`);
    return { skipped: true, copied: 0 };
  }
  const outStream = oldC.query(copyStreams.to(`COPY ${qualified} TO STDOUT WITH BINARY`));
  const inStream = newC.query(copyStreams.from(`COPY ${qualified} FROM STDIN WITH BINARY`));
  await pipeline(outStream, inStream);
  const after = await tableCount(newC, qualified);
  console.log(`  ${qualified.padEnd(40)} ${after} rows`);
  return { skipped: false, copied: Number(after) };
}

async function listPublicTables(client) {
  const r = await client.query(`
    select table_name
      from information_schema.tables
     where table_schema = 'public'
       and table_type = 'BASE TABLE'
     order by table_name
  `);
  return r.rows.map((row) => `public.${row.table_name}`);
}

// ─────────────────────────── AUTH ────────────────────────────
async function phaseAuth(env) {
  console.log('\n=== PHASE: auth (users + identities) ===');
  const oldC = await connect(env.OLD_DB_URL);
  const newC = await connect(env.NEW_DB_URL);
  try {
    await newC.query("SET session_replication_role = 'replica'");
    for (const t of ['auth.users', 'auth.identities']) {
      await copyTable(oldC, newC, t);
    }
    await newC.query("SET session_replication_role = 'origin'");
    console.log('auth migrated.');
  } finally {
    await oldC.end();
    await newC.end();
  }
}

// ─────────────────────────── DATA ────────────────────────────
async function phaseData(env) {
  console.log('\n=== PHASE: data (public schema) ===');
  const oldC = await connect(env.OLD_DB_URL);
  const newC = await connect(env.NEW_DB_URL);
  try {
    const tables = await listPublicTables(oldC);
    console.log(`  found ${tables.length} public tables`);
    await newC.query("SET session_replication_role = 'replica'");
    for (const t of tables) {
      await copyTable(oldC, newC, t);
    }
    await newC.query("SET session_replication_role = 'origin'");

    // Re-sync all sequences so future inserts don't collide with copied IDs.
    console.log('\n  resyncing sequences...');
    const seqs = await newC.query(`
      select
        c.relname::regclass::text as seq,
        d.refobjid::regclass::text as tbl,
        a.attname as col
      from pg_class c
      join pg_depend d on d.objid = c.oid and d.deptype = 'a'
      join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
      where c.relkind = 'S'
        and c.relnamespace = 'public'::regnamespace
    `);
    for (const s of seqs.rows) {
      await newC.query(
        `SELECT setval('${s.seq}', COALESCE((SELECT MAX(${s.col}) FROM ${s.tbl}), 1), (SELECT MAX(${s.col}) FROM ${s.tbl}) IS NOT NULL)`,
      );
    }
    console.log(`  synced ${seqs.rows.length} sequences.`);
    console.log('public data migrated.');
  } finally {
    await oldC.end();
    await newC.end();
  }
}

// ────────────────────────── STORAGE ──────────────────────────
async function phaseStorage(env) {
  console.log('\n=== PHASE: storage (all buckets) ===');
  const oldSb = createClient(env.OLD_SUPABASE_URL, env.OLD_SERVICE_ROLE_KEY);
  const newSb = createClient(env.NEW_SUPABASE_URL, env.NEW_SERVICE_ROLE_KEY);

  const { data: buckets, error: bErr } = await oldSb.storage.listBuckets();
  if (bErr) throw bErr;
  if (!buckets?.length) { console.log('no buckets to migrate.'); return; }

  for (const b of buckets) {
    console.log(`\nbucket: ${b.name} (public=${b.public})`);
    const { data: existing } = await newSb.storage.getBucket(b.name);
    if (!existing) {
      const { error } = await newSb.storage.createBucket(b.name, {
        public: b.public,
        fileSizeLimit: b.file_size_limit,
        allowedMimeTypes: b.allowed_mime_types,
      });
      if (error) throw error;
      console.log(`  created bucket ${b.name} on new project`);
    }
    await copyBucketRecursive(oldSb, newSb, b.name, '');
  }
  console.log('\nstorage migrated.');
}

async function copyBucketRecursive(oldSb, newSb, bucket, prefix) {
  const { data: entries, error } = await oldSb.storage
    .from(bucket)
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  for (const entry of entries ?? []) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      await copyBucketRecursive(oldSb, newSb, bucket, fullPath);
      continue;
    }
    const { data: blob, error: dErr } = await oldSb.storage.from(bucket).download(fullPath);
    if (dErr) { console.error(`  skip ${fullPath}: ${dErr.message}`); continue; }
    const buf = Buffer.from(await blob.arrayBuffer());
    const { error: uErr } = await newSb.storage.from(bucket).upload(fullPath, buf, {
      upsert: true,
      contentType: entry.metadata?.mimetype || undefined,
    });
    if (uErr) { console.error(`  fail ${fullPath}: ${uErr.message}`); continue; }
    console.log(`  ${fullPath}`);
  }
}

// ────────────────────────── VERIFY ───────────────────────────
async function phaseVerify(env) {
  console.log('\n=== PHASE: verify (row counts) ===');
  const oldC = await connect(env.OLD_DB_URL);
  const newC = await connect(env.NEW_DB_URL);
  try {
    const list = await newC.query(`
      select table_schema||'.'||table_name as t
        from information_schema.tables
       where table_schema in ('public','auth') and table_type = 'BASE TABLE'
       order by 1
    `);
    console.log(`\n${'table'.padEnd(45)}${'old'.padStart(10)}${'new'.padStart(10)}  diff`);
    console.log('─'.repeat(75));
    for (const { t } of list.rows) {
      const o = await tableCount(oldC, t);
      const n = await tableCount(newC, t);
      const diff = Number(n) - Number(o);
      const marker = diff === 0 ? '  ok' : `  ⚠ ${diff > 0 ? '+' : ''}${diff}`;
      console.log(`${t.padEnd(45)}${o.padStart(10)}${n.padStart(10)}${marker}`);
    }
  } finally {
    await oldC.end();
    await newC.end();
  }
}

// ─────────────────────────── MAIN ────────────────────────────
const phase = (process.argv.find((a) => a.startsWith('--phase='))?.split('=')[1]) || 'all';
const env = loadEnv();

const phases = { auth: phaseAuth, data: phaseData, storage: phaseStorage, verify: phaseVerify };

if (phase === 'all') {
  for (const p of ['auth', 'data', 'storage', 'verify']) await phases[p](env);
} else if (phases[phase]) {
  await phases[phase](env);
} else {
  console.error(`unknown phase: ${phase}. use auth | data | storage | verify | all`);
  process.exit(1);
}
console.log('\ndone.');
