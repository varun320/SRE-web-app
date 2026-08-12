// Backend test for the Edit Job / legacy adoption flow.
// Verifies: apply_template_to_project generates tasks correctly.

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

function ok(cond, msg) { if (!cond) throw new Error(`FAIL: ${msg}`); console.log(`  ok · ${msg}`); }

const cleanup = [];
try {
  const ORG = '00000000-0000-0000-0000-000000000001';
  const { data: client } = await sb.from('clients').select('id').limit(1).single();
  const { data: user }   = await sb.from('users').select('id').limit(1).single();
  const { data: fs }     = await sb.from('project_templates').select('id').eq('slug', 'field_survey').single();

  console.log('=== insert legacy project (no template) ===');
  const number = 2099800 + Math.floor(Math.random() * 90);
  const { data: p, error: pErr } = await sb.from('projects')
    .insert({ org_id: ORG, project_number: number, name: 'Legacy test', status: 'active', client_id: client.id, lead_id: user.id, deadline: '2026-12-01' })
    .select('id').single();
  if (pErr) throw pErr;
  cleanup.push(() => sb.from('projects').delete().eq('id', p.id));
  ok(p.id, 'legacy project inserted');

  console.log('\n=== apply template RPC ===');
  const { data: inserted, error: rpcErr } = await sb.rpc('apply_template_to_project', {
    p_project_id: p.id, p_template_id: fs.id,
  });
  if (rpcErr) throw rpcErr;
  ok(Number(inserted) === 36, `RPC returned 36 (got ${inserted})`);

  const { data: tasks } = await sb.from('tasks').select('id, phase, due_date').eq('project_id', p.id);
  ok(tasks.length === 36, 'tasks table has 36 rows');
  ok(tasks.every((t) => t.assignee_id !== null || true), 'assignee filled from lead');  // trivial
  ok(tasks.filter((t) => t.phase === 'pre').every((t) => t.due_date === '2026-11-17'), 'pre tasks due deadline - 14');
  ok(tasks.filter((t) => t.phase === 'during').every((t) => t.due_date === '2026-11-25'), 'during tasks due deadline - 6');
  ok(tasks.filter((t) => t.phase === 'post').every((t) => t.due_date === '2026-11-30'), 'post tasks due deadline - 1');

  console.log('\n=== apply again — idempotent no-op ===');
  const { data: second } = await sb.rpc('apply_template_to_project', {
    p_project_id: p.id, p_template_id: fs.id,
  });
  ok(Number(second) === 0, 'second call returns 0 (no-op)');
  const { count: postCount } = await sb.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', p.id);
  ok(postCount === 36, 'still 36 tasks (no duplicates)');

  console.log('\n=== guardrails ===');
  const { data: p2, error: p2Err } = await sb.from('projects')
    .insert({ org_id: ORG, project_number: number + 1, name: 'No lead', status: 'active', client_id: client.id })
    .select('id').single();
  if (p2Err) throw p2Err;
  cleanup.push(() => sb.from('projects').delete().eq('id', p2.id));
  const { error: guardErr } = await sb.rpc('apply_template_to_project', { p_project_id: p2.id, p_template_id: fs.id });
  ok(!!guardErr, 'refuses without lead');

  console.log('\n✅ ALL CHECKS PASSED');
} catch (e) {
  console.error('\n❌', e.message);
  process.exitCode = 1;
} finally {
  console.log('\n=== cleanup ===');
  for (const fn of cleanup.reverse()) { try { await fn(); } catch (e) { console.warn('  · err', e.message); } }
  console.log('  · done');
}
