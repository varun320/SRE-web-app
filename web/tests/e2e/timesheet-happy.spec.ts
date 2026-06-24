import { test, expect } from '@playwright/test';
import { provisionEmployee } from './setup';

test('employee can sign in, add entries, save, and submit', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'CorrectHorse9!';
  await provisionEmployee(email, password, `E${Math.floor(Math.random() * 9999)}`);

  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Header nav appears post-auth; tolerates the / → /week/current → /week/YYYY-MM-DD chain.
  await expect(page.getByRole('link', { name: /Timesheet|Week$/ }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/week\/\d{4}-\d{2}-\d{2}/, { timeout: 15_000 });

  // CategoryCell renders two base-ui Select triggers identified by their placeholders.
  await page.getByText('Main…', { exact: true }).first().click();
  await page.getByRole('option', { name: 'Admin' }).click();
  await page.getByText('Sub…', { exact: true }).first().click();
  await page.getByRole('option', { name: 'Administrative' }).click();
  await page.getByLabel('Mon hours row 1').fill('8');
  await page.getByPlaceholder('Description required').fill('Catch-up');

  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(page.getByText('Submitted for approval')).toBeVisible();
  await expect(page.getByText(/Submitted — awaiting/)).toBeVisible();
});
