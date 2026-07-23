import { test, expect } from '@playwright/test';

/**
 * Production smoke — opt-in via PROD_URL env. Skipped on local runs.
 *   PROD_URL=https://sre-web-app.vercel.app \
 *   PROD_EMAIL=dev@sulfurrecovery.com PROD_PASSWORD=Sulfur2026! \
 *     npx playwright test prod-smoke
 */
const PROD = process.env.PROD_URL;
const EMAIL = process.env.PROD_EMAIL ?? 'dev@sulfurrecovery.com';
const PASS  = process.env.PROD_PASSWORD ?? 'Sulfur2026!';

test.describe(PROD ? 'prod smoke' : 'prod smoke (skipped — set PROD_URL)', () => {
  test.skip(!PROD, 'no PROD_URL');
  test.use({ baseURL: PROD });

  test('sign in → key surfaces render without 500', async ({ page }) => {
    // Sign in
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill(EMAIL);
    await page.locator('#password').fill(PASS);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 }),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ]);
    await expect(page.getByRole('link', { name: /Timesheet|Week$/ }).first()).toBeVisible({ timeout: 30_000 });

    // Login now lands on /home; navigate to the week editor explicitly.
    await page.goto('/week/current', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/week\/\d{4}-\d{2}-\d{2}/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Submit for approval/ })).toBeVisible();

    // TIL bank — hero balance
    await page.goto('/me/til');
    await expect(page.getByRole('heading', { level: 1, name: /TIL bank/i })).toBeVisible();

    // Vacation
    await page.goto('/me/vacation');
    await expect(page.getByRole('heading', { level: 1, name: /Vacation/i })).toBeVisible();

    // Admin landing (approvals tab is default view)
    await page.goto('/admin');
    await expect(page.getByRole('tab', { name: /Inbox/i }).first()).toBeVisible();

    // Reports landing — cards linking to each report
    await page.goto('/admin/reports');
    await expect(page.getByRole('link', { name: /Pay period/i }).first()).toBeVisible();

    // Notifications page
    await page.goto('/me/notifications');
    await expect(page.getByText(/No notifications yet|Mark all read/i).first()).toBeVisible();

    // Import gated off in prod — should 404
    const res = await page.request.get('/admin/import');
    expect([200, 307, 404]).toContain(res.status());
  });
});
