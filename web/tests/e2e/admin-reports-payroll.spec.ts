import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { provisionEmployee, grantAdmin, signIn } from './setup';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ORG_ID = '00000000-0000-0000-0000-000000000001';

const PAYROLL_FROM = '2026-01-05'; // Monday — pay-period epoch start
const PAYROLL_TO   = '2026-01-18'; // +13d

test('admin sees payroll preview row and downloads CSV with expected columns', async ({ page }) => {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // --- Provision employee + admin ---
  const empCode = `E${Math.floor(Math.random() * 9999)}`;
  const empEmail = `e2e-emp-${Date.now()}@example.com`;
  const adminEmail = `e2e-admin-${Date.now()}@example.com`;
  const password = 'CorrectHorse9!';

  const empId = await provisionEmployee(empEmail, password, empCode);
  const adminId = await provisionEmployee(adminEmail, password, `A${Math.floor(Math.random() * 9999)}`);
  await grantAdmin(adminId);

  // --- Seed one approved week via service-role.
  // INSERTs bypass the status guard (which only fires on UPDATEs of status).
  const { data: subSiteWork } = await sb
    .from('sub_categories').select('id').eq('name', 'Site Work').single();
  if (!subSiteWork) throw new Error('Site Work sub-category missing — DB not seeded');

  let { data: project } = await sb.from('projects').select('id').eq('status', 'active').limit(1).maybeSingle();
  if (!project) {
    const res = await sb.from('projects')
      .insert({ org_id: ORG_ID, project_number: 2099001, name: 'E2E Project', status: 'active' })
      .select('id').single();
    if (res.error) throw new Error('project seed: ' + res.error.message);
    project = res.data!;
  }

  const tsRes = await sb.from('timesheets').insert({
    user_id: empId,
    org_id: ORG_ID,
    week_start: PAYROLL_FROM,
    status: 'approved',
    submitted_at: new Date().toISOString(),
    decided_at: new Date().toISOString(),
    decided_by: adminId,
    locked: true,
  }).select('id').single();
  if (tsRes.error) throw new Error('timesheet insert: ' + tsRes.error.message);

  const entryRes = await sb.from('timesheet_entries').insert({
    timesheet_id: tsRes.data!.id,
    main_category: 'Project',
    sub_category_id: subSiteWork.id,
    project_id: project.id,
    mon_hrs: 8, tue_hrs: 8, wed_hrs: 8, thu_hrs: 8, fri_hrs: 8,
    sat_hrs: 0, sun_hrs: 0,
    description: 'E2E payroll fixture',
    position: 0,
  });
  if (entryRes.error) throw new Error('entry insert: ' + entryRes.error.message);

  await sb.from('til_ledger').upsert({
    user_id: empId, week_start: PAYROLL_FROM,
    opening_balance: 0, overtime_earned: 0, til_used: 0, frozen: true, approved_by: adminId,
  });
  await sb.from('vacation_ledger').upsert({
    user_id: empId, week_start: PAYROLL_FROM,
    opening_balance: 0, vacation_used: 0, frozen: true, approved_by: adminId,
  });

  // --- Admin signs in ---
  await signIn(page, adminEmail, password);

  // --- Payroll preview shows one row matching our employee ---
  await page.goto(`/admin/reports/payroll?from=${PAYROLL_FROM}&to=${PAYROLL_TO}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('heading', { name: 'Payroll export' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('tr', { hasText: empCode }).first()).toBeVisible();

  // --- Download CSV and validate shape (fetch directly to avoid download-event flakes) ---
  const downloadHref = await page.getByRole('link', { name: /Download CSV/ }).getAttribute('href');
  expect(downloadHref).toBeTruthy();
  const csvResp = await page.request.get(downloadHref!);
  expect(csvResp.status()).toBe(200);
  expect(csvResp.headers()['content-disposition']).toMatch(/payroll-2026-01-05-2026-01-18\.csv/);
  const content = await csvResp.text();
  const lines = content.replace(/^﻿/, '').split('\n').filter(Boolean);

  expect(lines[0]).toBe(
    'employee_code,full_name,period_start,period_end,regular_hrs,overtime_hrs,til_payout_hrs,til_earned_delta,til_used_delta,til_closing,vacation_used_delta,vacation_closing',
  );
  const row = lines.find((l) => l.startsWith(empCode));
  expect(row).toBeDefined();
  expect(row).toContain('2026-01-05'); // period_start
  expect(row).toContain('2026-01-18'); // period_end
});
