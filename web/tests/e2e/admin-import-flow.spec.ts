import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { provisionEmployee, grantAdmin, signIn, signOut } from './setup';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test('admin imports balances CSV; employee sees opening balance; re-upload is a no-op', async ({ page, context }) => {
  // --- Provision: employee + admin ---
  const empCode = `E${Math.floor(Math.random() * 9999)}`;
  const empEmail = `e2e-emp-${Date.now()}@example.com`;
  const adminEmail = `e2e-admin-${Date.now()}@example.com`;
  const password = 'CorrectHorse9!';

  const empId = await provisionEmployee(empEmail, password, empCode);
  const adminId = await provisionEmployee(adminEmail, password, `A${Math.floor(Math.random() * 9999)}`);
  await grantAdmin(adminId);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

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
  await signIn(page, adminEmail, password);

  await page.goto('/admin/import');
  await page.getByLabel(/^File/).setInputFiles(csvPath);
  await page.getByRole('button', { name: /Dry-run plan/ }).click();

  // Dry-run shells out to the Python CLI; allow time for cold start.
  const row = page.locator('tr', { hasText: empCode }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row.getByText('create', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Commit import/ }).click();
  await expect(page.getByText(/Committed:.*applied/)).toBeVisible();

  // --- Employee signs in and sees opening balance ---
  await signOut(context);
  await signIn(page, empEmail, password);

  await page.goto('/me/til');
  await expect(page.getByText(/40/).first()).toBeVisible();
  await page.goto('/me/vacation');
  await expect(page.getByText(/200/).first()).toBeVisible();

  // --- DB sanity: synthetic ledger row exists at as_of − 7 days ---
  const { data: til } = await sb
    .from('til_ledger')
    .select('week_start, opening_balance, frozen')
    .eq('user_id', empId)
    .eq('week_start', '2025-12-29');
  expect(til?.length).toBe(1);
  expect(Number(til![0].opening_balance)).toBe(40);
  expect(til![0].frozen).toBe(true);

  // --- Re-upload same CSV: idempotent skip, commit disabled ---
  await signOut(context);
  await signIn(page, adminEmail, password);
  await page.goto('/admin/import');
  await page.getByLabel(/^File/).setInputFiles(csvPath);
  await page.getByRole('button', { name: /Dry-run plan/ }).click();

  const skipRow = page.locator('tr', { hasText: empCode }).first();
  await expect(skipRow.getByText('skip', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Commit import/ })).toBeDisabled();

  fs.rmSync(csvDir, { recursive: true, force: true });
});
