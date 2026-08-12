// End-to-end backend test for the New Job flow.
// Tests the create_project_from_template RPC + Directory inserts against prod
// Supabase using service role. Cleans up on exit.
//
// Covers:
//   1. Templates + sections + tasks seeded correctly
//   2. Inserting site + contact
//   3. RPC creates project, team, all tasks with correct phase-staggered dates
//   4. v_project_progress computes 0% at start
//   5. Task assignee = lead
//   6. Lead is on team
//
// Cleanup deletes the created project, sites/contacts, in reverse.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');

const sb = createClient(url, key, { auth: { persistSession: false } });

const ORG_ID = '00000000-0000-0000-0000-000000000001';

// Provision a scratch auth user so the RPC's auth.uid() check passes.
// service_role bypasses RLS but auth.uid() is still null under it, and
// current_user_org() depends on a real users row.
async function provisionScratchUser(cleanupList) {
  const email = `test-newjob-${Date.now()}@example.com`;
  const password = `Test-${Date.now()}!`;
  const { data: created, error: cErr } = await sb.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (cErr || !created.user) throw new Error(`createUser: ${cErr?.message}`);
  const uid = created.user.id;
  cleanupList.push(() => sb.auth.admin.deleteUser(uid));

  const { data: pos } = await sb.from('positions').select('id').limit(1).single();
  const { error: uErr } = await sb.from('users').insert({
    id: uid, org_id: ORG_ID, full_name: 'New Job Test', email,
    employee_code: `TEST${Date.now() % 10000}`, position_id: pos.id,
  });
  if (uErr) throw new Error(`insert users: ${uErr.message}`);
  cleanupList.push(() => sb.from('users').delete().eq('id', uid));

  const { error: rErr } = await sb.from('user_roles').insert({ user_id: uid, role: 'employee' });
  if (rErr) throw new Error(`insert user_roles: ${rErr.message}`);
  cleanupList.push(() => sb.from('user_roles').delete().eq('user_id', uid));

  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: sess, error: siErr } = await anon.auth.signInWithPassword({ email, password });
  if (siErr || !sess.session) throw new Error(`signInWithPassword: ${siErr?.message}`);

  const bound = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } },
  });
  return { bound, uid };
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok · ${msg}`);
}

const cleanup = [];

async function main() {
  console.log('=== templates seed check ===');
  const { data: templates, error: tErr } = await sb
    .from('project_templates')
    .select('id, slug, name');
  if (tErr) throw tErr;
  const bySlug = new Map(templates.map((t) => [t.slug, t]));
  assert(bySlug.has('field_survey'), 'field_survey template exists');
  assert(bySlug.has('amine_study'),  'amine_study template exists');
  assert(bySlug.has('desk_review'),  'desk_review template exists');
  assert(bySlug.has('turnaround'),   'turnaround template exists');

  // Field survey should have the full task list. Count via join.
  const fs = bySlug.get('field_survey');
  const { data: fsSections } = await sb
    .from('template_sections').select('id, phase').eq('template_id', fs.id);
  const { data: fsTasks } = await sb
    .from('template_tasks').select('id, section_id').in('section_id', fsSections.map((s) => s.id));
  console.log(`  · field_survey has ${fsSections.length} sections, ${fsTasks.length} tasks`);
  assert(fsTasks.length >= 25, 'field_survey has ≥25 tasks');

  // Split by phase
  const secToPhase = new Map(fsSections.map((s) => [s.id, s.phase]));
  const phaseCounts = { pre: 0, during: 0, post: 0 };
  for (const t of fsTasks) phaseCounts[secToPhase.get(t.section_id)]++;
  assert(phaseCounts.pre > 0,    'field_survey has Pre tasks');
  assert(phaseCounts.during > 0, 'field_survey has During tasks');
  assert(phaseCounts.post > 0,   'field_survey has Post tasks');

  console.log('\n=== fetch prerequisites ===');
  const { data: clients } = await sb.from('clients').select('id, name').limit(1);
  assert(clients?.length > 0, 'at least one client exists');
  const client = clients[0];
  console.log(`  · using client ${client.name}`);

  const { data: users } = await sb.from('users').select('id, full_name').limit(3);
  assert(users?.length > 0, 'at least one user exists');
  const lead = users[0];
  const teammates = users.slice(1);
  console.log(`  · lead: ${lead.full_name}, team: ${teammates.map((u) => u.full_name).join(', ') || '(solo)'}`);

  console.log('\n=== insert directory rows ===');
  const testTag = `_test_${Date.now()}`;
  const { data: newSite, error: sErr } = await sb
    .from('sites')
    .insert({ org_id: '00000000-0000-0000-0000-000000000001', client_id: client.id, name: `Test Site ${testTag}` })
    .select('id').single();
  if (sErr) throw sErr;
  cleanup.push(() => sb.from('sites').delete().eq('id', newSite.id));
  assert(newSite.id, 'site inserted');

  const { data: newContact, error: cErr } = await sb
    .from('contacts')
    .insert({
      org_id: '00000000-0000-0000-0000-000000000001', client_id: client.id,
      name: `Test Contact ${testTag}`, email: 'test@example.com', role: 'Test',
    })
    .select('id').single();
  if (cErr) throw cErr;
  cleanup.push(() => sb.from('contacts').delete().eq('id', newContact.id));
  assert(newContact.id, 'contact inserted');

  console.log('\n=== provision scratch auth user ===');
  const { bound, uid: scratchUid } = await provisionScratchUser(cleanup);
  console.log(`  · signed in as scratch user ${scratchUid}`);
  // Use scratch user as lead so auth.uid() aligns
  const testLead = { id: scratchUid, full_name: 'New Job Test' };
  const testTeam = users.slice(0, 2);  // any existing users as teammates

  console.log('\n=== create_project_from_template RPC ===');
  const projNumber = 2099901 + Math.floor(Math.random() * 90);  // out-of-band test number
  const deadline = '2027-01-15';
  const { data: projectId, error: rpcErr } = await bound.rpc('create_project_from_template', {
    p_project_number: projNumber,
    p_name: fs.name,
    p_scope_title: `Test Scope ${testTag}`,
    p_client_id: client.id,
    p_site_id: newSite.id,
    p_contact_id: newContact.id,
    p_template_id: fs.id,
    p_lead_id: testLead.id,
    p_deadline: deadline,
    p_team_ids: testTeam.map((u) => u.id),
    p_accent_color: null,
  });
  if (rpcErr) throw rpcErr;
  cleanup.push(() => sb.from('projects').delete().eq('id', projectId));
  assert(projectId, 'RPC returned a project id');
  console.log(`  · created project ${projNumber} (${projectId})`);

  console.log('\n=== verify project row ===');
  const { data: proj } = await sb
    .from('projects')
    .select('project_number, phase, deadline, lead_id, client_id, site_id, contact_id, template_id, scope_title, status')
    .eq('id', projectId).single();
  assert(proj.project_number === projNumber, 'project_number matches');
  assert(proj.phase === 'pre',                'phase defaults to pre');
  assert(proj.deadline === deadline,          'deadline set');
  assert(proj.lead_id === testLead.id,        'lead_id set');
  assert(proj.client_id === client.id,        'client_id set');
  assert(proj.site_id === newSite.id,         'site_id set');
  assert(proj.contact_id === newContact.id,   'contact_id set');
  assert(proj.template_id === fs.id,          'template_id set');
  assert(proj.status === 'active',            'status defaults to active');

  console.log('\n=== verify team ===');
  const { data: team } = await sb
    .from('project_team_members').select('user_id').eq('project_id', projectId);
  const teamIds = new Set(team.map((r) => r.user_id));
  assert(teamIds.has(testLead.id), 'lead is on team');
  for (const t of testTeam) assert(teamIds.has(t.id), `teammate ${t.full_name} on team`);

  console.log('\n=== verify tasks ===');
  const { data: tasks } = await sb
    .from('tasks').select('id, phase, due_date, assignee_id, status, priority')
    .eq('project_id', projectId);
  assert(tasks.length === fsTasks.length, `task count matches template (${tasks.length} == ${fsTasks.length})`);
  assert(tasks.every((t) => t.assignee_id === testLead.id), 'all tasks assigned to lead');
  assert(tasks.every((t) => t.status === 'todo'), 'all tasks status = todo');

  const expectedDue = {
    pre:    '2027-01-01',  // deadline - 14
    during: '2027-01-09',  // deadline - 6
    post:   '2027-01-14',  // deadline - 1
  };
  for (const [phase, expected] of Object.entries(expectedDue)) {
    const phaseTasks = tasks.filter((t) => t.phase === phase);
    if (phaseTasks.length === 0) continue;
    assert(
      phaseTasks.every((t) => t.due_date === expected),
      `${phase} tasks due ${expected}`,
    );
  }

  console.log('\n=== verify progress view ===');
  const { data: prog } = await sb
    .from('v_project_progress').select('progress_pct, total_count')
    .eq('project_id', projectId).single();
  assert(Number(prog.total_count) === tasks.length, 'progress view total_count matches');
  assert(Number(prog.progress_pct) === 0, 'progress starts at 0%');

  console.log('\n=== simulate task completion, re-check progress ===');
  const half = tasks.slice(0, Math.floor(tasks.length / 2));
  await sb.from('tasks').update({ status: 'done' }).in('id', half.map((t) => t.id));
  const { data: prog2 } = await sb
    .from('v_project_progress').select('progress_pct')
    .eq('project_id', projectId).single();
  const expectedPct = Math.round(100 * half.length / tasks.length);
  assert(
    Math.abs(Number(prog2.progress_pct) - expectedPct) <= 1,
    `progress after marking ${half.length}/${tasks.length} done ≈ ${expectedPct}%`,
  );

  console.log('\n=== duplicate project_number rejected ===');
  const { error: dupErr } = await bound.rpc('create_project_from_template', {
    p_project_number: projNumber,
    p_name: fs.name, p_scope_title: 'dup', p_client_id: client.id,
    p_site_id: null, p_contact_id: null, p_template_id: fs.id,
    p_lead_id: testLead.id, p_deadline: deadline, p_team_ids: [], p_accent_color: null,
  });
  assert(!!dupErr, 'duplicate project_number rejected');

  console.log('\n✅ ALL CHECKS PASSED');
}

async function runCleanup() {
  console.log('\n=== cleanup ===');
  // Run in reverse so FKs unwind
  for (const fn of cleanup.reverse()) {
    try { await fn(); console.log('  · cleaned'); } catch (e) { console.warn('  · cleanup err:', e.message); }
  }
}

try {
  await main();
} catch (e) {
  console.error('\n❌', e.message);
  process.exitCode = 1;
} finally {
  await runCleanup();
}
