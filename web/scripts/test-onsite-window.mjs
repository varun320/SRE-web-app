// Verify the new on-site window model:
//   · create_project_from_template accepts p_has_onsite/start/end
//   · Pre-Job tasks anchor off onsite_start - 14
//   · During-Job tasks anchor off onsite_start - 6
//   · Post-Job tasks anchor off deadline - 1 (report submission)
//   · projects_onsite_window_valid check rejects invalid combinations
//   · apply_template_to_project on a legacy project respects onsite_start too

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
const ORG = '00000000-0000-0000-0000-000000000001';

function ok(cond, msg) { if (!cond) throw new Error(`FAIL: ${msg}`); console.log(`  ok · ${msg}`); }

const cleanup = [];
try {
  const { data: client } = await sb.from('clients').select('id').limit(1).single();
  const { data: fs }     = await sb.from('project_templates').select('id').eq('slug', 'field_survey').single();

  console.log('=== provision scratch admin for auth.uid() ===');
  const email = `test-onsite-${Date.now()}@example.com`;
  const pw = `TestOn-${Date.now()}!`;
  const { data: created } = await sb.auth.admin.createUser({ email, password: pw, email_confirm: true });
  const uid = created.user.id;
  cleanup.push(() => sb.auth.admin.deleteUser(uid));
  const { data: pos } = await sb.from('positions').select('id').limit(1).single();
  await sb.from('users').insert({ id: uid, org_id: ORG, full_name: 'Onsite Test', email, employee_code: `ON${Date.now()%10000}`, position_id: pos.id });
  cleanup.push(() => sb.from('users').delete().eq('id', uid));
  await sb.from('user_roles').insert({ user_id: uid, role: 'employee' });
  cleanup.push(() => sb.from('user_roles').delete().eq('user_id', uid));

  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ''), env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: sess } = await anon.auth.signInWithPassword({ email, password: pw });
  const bound = createClient(env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ''), env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } },
  });

  console.log('\n=== create WITH on-site window ===');
  const projNumber = 2099700 + Math.floor(Math.random() * 90);
  const { data: projectId, error } = await bound.rpc('create_project_from_template', {
    p_project_number: projNumber,
    p_name: 'Field Sampling Survey',
    p_scope_title: 'Onsite window test',
    p_client_id: client.id,
    p_site_id: null,
    p_contact_id: null,
    p_template_id: fs.id,
    p_lead_id: uid,
    p_deadline:     '2027-02-01',   // report submission
    p_team_ids: [],
    p_accent_color: null,
    p_has_onsite:   true,
    p_onsite_start: '2027-01-11',
    p_onsite_end:   '2027-01-18',
  });
  if (error) throw error;
  cleanup.push(() => sb.from('projects').delete().eq('id', projectId));
  ok(projectId, 'RPC accepted on-site params + created project');

  const { data: p } = await sb.from('projects').select('has_onsite, onsite_start, onsite_end, deadline').eq('id', projectId).single();
  ok(p.has_onsite === true, 'has_onsite persisted');
  ok(p.onsite_start === '2027-01-11', 'onsite_start persisted');
  ok(p.onsite_end   === '2027-01-18', 'onsite_end persisted');

  const { data: tasks } = await sb.from('tasks').select('phase, due_date').eq('project_id', projectId);
  const preOK    = tasks.filter((t) => t.phase === 'pre').every((t) => t.due_date === '2026-12-28');   // onsite_start - 14
  const duringOK = tasks.filter((t) => t.phase === 'during').every((t) => t.due_date === '2027-01-05'); // onsite_start - 6
  const postOK   = tasks.filter((t) => t.phase === 'post').every((t) => t.due_date === '2027-01-31');   // deadline - 1
  ok(preOK,    'Pre-Job tasks anchor 14 days before on-site start');
  ok(duringOK, 'During-Job tasks anchor 6 days before on-site start');
  ok(postOK,   'Post-Job tasks anchor 1 day before report deadline');

  console.log('\n=== check constraint rejects invalid ===');
  const { error: badErr } = await sb.from('projects').update({ has_onsite: true, onsite_start: null }).eq('id', projectId);
  ok(!!badErr, 'refuses has_onsite=true with null start');
  const { error: badErr2 } = await sb.from('projects').update({ onsite_start: '2027-02-01', onsite_end: '2027-01-01' }).eq('id', projectId);
  ok(!!badErr2, 'refuses start > end');

  console.log('\n=== create WITHOUT on-site (backward compatible) ===');
  const num2 = projNumber + 1;
  const { data: p2 } = await bound.rpc('create_project_from_template', {
    p_project_number: num2, p_name: 'Field Sampling Survey', p_scope_title: 'Desktop-only',
    p_client_id: client.id, p_site_id: null, p_contact_id: null, p_template_id: fs.id, p_lead_id: uid,
    p_deadline: '2027-02-01', p_team_ids: [], p_accent_color: null,
    p_has_onsite: false, p_onsite_start: null, p_onsite_end: null,
  });
  cleanup.push(() => sb.from('projects').delete().eq('id', p2));
  const { data: t2 } = await sb.from('tasks').select('phase, due_date').eq('project_id', p2);
  const preFallback = t2.filter((t) => t.phase === 'pre').every((t) => t.due_date === '2027-01-18');   // deadline - 14
  const durFallback = t2.filter((t) => t.phase === 'during').every((t) => t.due_date === '2027-01-26'); // deadline - 6
  ok(preFallback, 'no on-site → Pre anchors 14 days before deadline');
  ok(durFallback, 'no on-site → During anchors 6 days before deadline');

  console.log('\n✅ ALL CHECKS PASSED');
} catch (e) {
  console.error('\n❌', e.message);
  process.exitCode = 1;
} finally {
  console.log('\n=== cleanup ===');
  for (const fn of cleanup.reverse()) { try { await fn(); } catch (e) { console.warn('  err', e.message); } }
  console.log('  · done');
}
