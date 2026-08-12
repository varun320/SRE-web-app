// Seeds a fresh test project for Phase 2 UI tests. Uses whatever user is
// stored in .ui-test-creds.json as the lead.
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
const { email, password } = JSON.parse(readFileSync(resolve(__dirname, '.ui-test-creds.json'), 'utf8'));

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ''), env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess, error: siErr } = await anon.auth.signInWithPassword({ email, password });
if (siErr) throw siErr;
const bound = createClient(env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ''), env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } },
});

const { data: client } = await bound.from('clients').select('id').limit(1).single();
const { data: tpl } = await bound.from('project_templates').select('id, name').eq('slug', 'field_survey').single();

const number = 2099900 + Math.floor(Math.random() * 90);
const { data: projectId, error } = await bound.rpc('create_project_from_template', {
  p_project_number: number,
  p_name: tpl.name,
  p_scope_title: 'Phase 2 UI Test',
  p_client_id: client.id,
  p_site_id: null,
  p_contact_id: null,
  p_template_id: tpl.id,
  p_lead_id: sess.user.id,
  p_deadline: '2026-11-30',
  p_team_ids: [],
  p_accent_color: null,
});
if (error) throw error;
console.log(JSON.stringify({ number, projectId }));
