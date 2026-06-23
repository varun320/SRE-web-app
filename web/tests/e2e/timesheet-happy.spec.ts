import { test, expect } from '@playwright/test';
import { provisionEmployee } from './setup';

test('employee can sign in, add entries, save, and submit', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'CorrectHorse9!';
  await provisionEmployee(email, password, `E${Math.floor(Math.random() * 9999)}`);

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/week\/\d{4}-\d{2}-\d{2}/);

  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Admin' }).click();
  await page.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'Administrative' }).click();
  await page.getByLabel('Mon hours row 1').fill('8');
  await page.getByPlaceholder('Description required').fill('Catch-up');

  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(page.getByText('Submitted for approval')).toBeVisible();
  await expect(page.getByText(/Submitted — awaiting/)).toBeVisible();
});
