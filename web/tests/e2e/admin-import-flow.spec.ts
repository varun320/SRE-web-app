import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { provisionEmployee } from './setup';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test('admin imports balances CSV; employee sees opening balance; re-upload is a no-op', async ({
  page,
}) => {
  // --- Provision an employee + an admin ---
  const empCode = `E${Math.floor(Math.random() * 9999)}`;
  const empEmail = `e2e-emp-${Date.now()}@example.com`;
  const adminEmail = `e2e-admin-${Date.now()}@example.com`;
  const password = 'CorrectHorse9!';

  const empId = await provisionEmployee(empEmail, password, empCode);
  await provisionEmployee(adminEmail, password, `A${Math.floor(Math.random() * 9999)}`);

  // Elevate admin
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: admins } = await sb.from('users').select('id').eq('email', adminEmail).single();
  if (!admins) throw new Error('admin not provisioned');
  await sb.from('user_roles').insert({ user_id: admins.id, role: 'admin' });

  // --- Write a per-test balances CSV ---
  const csvDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-import-'));
  const csvPath = path.join(csvDir, 'balances.csv');
  const asOf = '2026-01-05';
  fs.writeFileSync(
    csvPath,
    `employee_code,position,til_opening_hrs,vacation_opening_hrs,as_of_date\n${empCode},Senior Engineer,40,200,${asOf}\n`,
    'utf-8',
  );

  // --- Admin signs in and walks the import UI ---
  await page.goto('/login');
  await page.locator('#email').fill(adminEmail);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: /Timesheet|Week$/ }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/week\/\d{4}-\d{2}-\d{2}/, { timeout: 15_000 });

  await page.goto('/admin/import');
  await page.getByLabel(/^File/).setInputFiles(csvPath);
  await page.getByRole('button', { name: /Dry-run plan/ }).click();

  // Diff renders with one create row for the employee
  const row = page.locator('tr', { hasText: empCode }).first();
  await expect(row).toBeVisible();
  await expect(row.getByText('create', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Commit import/ }).click();
  await expect(page.getByText(/Committed:.*applied/)).toBeVisible();

  // --- Employee signs in and sees opening balance ---
  await page.goto('/auth/signout').catch(() => {});
  await page.goto('/login');
  await page.locator('#email').fill(empEmail);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: /Timesheet|Week$/ }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/week\/\d{4}-\d{2}-\d{2}/, { timeout: 15_000 });

  await page.goto('/me/til');
  await expect(page.getByText(/40/).first()).toBeVisible(); // opening TIL
  await page.goto('/me/vacation');
  await expect(page.getByText(/200/).first()).toBeVisible(); // opening vacation

  // --- Verify in DB: synthetic ledger row exists at as_of − 7 days ---
  const { data: til } = await sb
    .from('til_ledger')
    .select('week_start, opening_balance, frozen')
    .eq('user_id', empId)
    .eq('week_start', '2025-12-29');
  expect(til?.length).toBe(1);
  expect(Number(til![0].opening_balance)).toBe(40);
  expect(til![0].frozen).toBe(true);

  // --- Re-upload same CSV: idempotent skip ---
  await page.goto('/auth/signout').catch(() => {});
  await page.goto('/login');
  await page.locator('#email').fill(adminEmail);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/admin/import');
  await page.getByLabel(/^File/).setInputFiles(csvPath);
  await page.getByRole('button', { name: /Dry-run plan/ }).click();

  const skipRow = page.locator('tr', { hasText: empCode }).first();
  await expect(skipRow.getByText('skip', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Commit import/ })).toBeDisabled();

  // cleanup
  fs.rmSync(csvDir, { recursive: true, force: true });
});
