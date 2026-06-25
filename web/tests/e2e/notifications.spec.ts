import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { provisionEmployee, grantAdmin, signIn, signOut } from './setup';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const WEEK = '2026-02-02'; // a Monday

test('submit notifies admins; approve notifies employee; mark-all-read clears badge', async ({ page, context }) => {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // --- Provision: admin + employee ---
  const password = 'CorrectHorse9!';
  const empCode = `E${Math.floor(Math.random() * 9999)}`;
  const empEmail = `e2e-emp-${Date.now()}@example.com`;
  const adminEmail = `e2e-admin-${Date.now()}@example.com`;

  const empId = await provisionEmployee(empEmail, password, empCode);
  const adminId = await provisionEmployee(adminEmail, password, `A${Math.floor(Math.random() * 9999)}`);
  await grantAdmin(adminId);

  // --- Seed a draft timesheet + 1 entry, then submit it AS the employee ---
  const { data: subSiteWork } = await sb.from('sub_categories').select('id').eq('name', 'Site Work').single();
  if (!subSiteWork) throw new Error('Site Work sub-category missing');
  let { data: project } = await sb.from('projects').select('id').eq('status', 'active').limit(1).maybeSingle();
  if (!project) {
    const res = await sb.from('projects')
      .insert({ org_id: ORG_ID, project_number: 2099009, name: 'Notifications E2E Project', status: 'active' })
      .select('id').single();
    project = res.data!;
  }

  const { data: ts, error: tsErr } = await sb.from('timesheets').insert({
    user_id: empId, org_id: ORG_ID, week_start: WEEK, status: 'draft',
  }).select('id').single();
  if (tsErr) throw new Error('ts insert: ' + tsErr.message);

  await sb.from('timesheet_entries').insert({
    timesheet_id: ts!.id,
    main_category: 'Project',
    sub_category_id: subSiteWork.id,
    project_id: project!.id,
    mon_hrs: 8, tue_hrs: 8, wed_hrs: 8, thu_hrs: 8, fri_hrs: 8, sat_hrs: 0, sun_hrs: 0,
    description: 'Notifications E2E entry',
    position: 0,
  });

  // Sign in as employee via REST (anon key) and call submit_timesheet — this
  // is the path that fires the admin fanout via notify_users().
  const empClient = createClient(SUPABASE_URL, ANON_KEY);
  const empAuth = await empClient.auth.signInWithPassword({ email: empEmail, password });
  if (empAuth.error) throw new Error('emp sign-in: ' + empAuth.error.message);
  const submitRpc = await empClient.rpc('submit_timesheet', { p_timesheet_id: ts!.id });
  if (submitRpc.error) throw new Error('submit_timesheet: ' + submitRpc.error.message);

  // Sanity: admin received exactly one submission notification.
  const { data: adminInbox } = await sb
    .from('notifications')
    .select('id, kind')
    .eq('user_id', adminId);
  expect(adminInbox).toHaveLength(1);
  expect(adminInbox![0].kind).toBe('timesheet_submitted');

  // --- Admin signs in via UI and sees the bell badge ---
  await signIn(page, adminEmail, password);

  // Bell badge shows 1
  const bell = page.getByRole('button', { name: /Notifications.*1 unread/i }).first();
  await expect(bell).toBeVisible({ timeout: 30_000 });

  // Open dropdown + click the notification → navigates to review page
  await bell.click();
  const notifLink = page.getByRole('link', { name: /submitted the week of/ }).first();
  await expect(notifLink).toBeVisible({ timeout: 10_000 });
  await notifLink.click();
  await expect(page).toHaveURL(new RegExp(`/admin/employees/${empId}/week/${WEEK}`), { timeout: 15_000 });

  // --- Approve via service-role so we don't have to wire the full approve UI ---
  // (the UI button calls the same RPC; verified separately in DecisionBar tests)
  const adminClient = createClient(SUPABASE_URL, ANON_KEY);
  const adminAuth = await adminClient.auth.signInWithPassword({ email: adminEmail, password });
  if (adminAuth.error) throw new Error('admin sign-in: ' + adminAuth.error.message);
  const approveRpc = await adminClient.rpc('approve_timesheet', { p_timesheet_id: ts!.id, p_comment: 'e2e' });
  if (approveRpc.error) throw new Error('approve: ' + approveRpc.error.message);

  // Employee should now have a "approved" notification.
  const { data: empInbox } = await sb
    .from('notifications')
    .select('id, kind')
    .eq('user_id', empId);
  expect(empInbox).toHaveLength(1);
  expect(empInbox![0].kind).toBe('timesheet_approved');

  // --- Employee signs in, sees badge, marks all read ---
  await signOut(context);
  await signIn(page, empEmail, password);

  const empBell = page.getByRole('button', { name: /Notifications.*1 unread/i }).first();
  await expect(empBell).toBeVisible({ timeout: 30_000 });
  await empBell.click();
  await expect(page.getByText(/approved your week of 2026-02-02/i)).toBeVisible();

  // Mark all read
  await page.getByRole('button', { name: /Mark all read/i }).click();
  // Badge should disappear (button reverts to plain "Notifications" label)
  await expect(page.getByRole('button', { name: /^Notifications$/ }).first()).toBeVisible({ timeout: 10_000 });
});
