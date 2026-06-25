import { createClient } from '@supabase/supabase-js';
import type { Page, BrowserContext } from '@playwright/test';
import { expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ORG_ID = '00000000-0000-0000-0000-000000000001';

if (!SERVICE_ROLE) {
  throw new Error('Set SUPABASE_SERVICE_ROLE_KEY (from `supabase status`) before running e2e');
}

function service() {
  return createClient(SUPABASE_URL, SERVICE_ROLE);
}

/**
 * Provision a fresh employee. Tears down any prior auth row with the same
 * email first so tests can be re-run cleanly without DB reset.
 */
export async function provisionEmployee(email: string, password: string, employeeCode: string): Promise<string> {
  const admin = service();

  const { data: existing } = await admin.auth.admin.listUsers();
  const existingUser = existing?.users.find((u) => u.email === email);
  if (existingUser) await admin.auth.admin.deleteUser(existingUser.id);

  const { data: { user }, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error || !user) throw new Error(error?.message ?? 'createUser failed');

  const { data: pos, error: posErr } = await admin
    .from('positions').select('id').eq('name', 'Senior Engineer').single();
  if (posErr || !pos) throw new Error(posErr?.message ?? 'Senior Engineer position not found');

  const { error: insErr } = await admin.from('users').insert({
    id: user.id,
    org_id: ORG_ID,
    full_name: 'E2E User',
    email,
    employee_code: employeeCode,
    position_id: pos.id,
  });
  if (insErr) throw new Error(insErr.message);

  const { error: roleErr } = await admin.from('user_roles').insert({ user_id: user.id, role: 'employee' });
  if (roleErr) throw new Error(roleErr.message);

  return user.id;
}

/** Grant admin to an existing user (idempotent). */
export async function grantAdmin(userId: string): Promise<void> {
  const sb = service();
  const { error } = await sb.from('user_roles').upsert({ user_id: userId, role: 'admin' });
  if (error) throw new Error(error.message);
}

/**
 * Robust UI sign-in. Three fixes for the dev-server auth race that made
 * the old `click → expect URL` pattern flake:
 *
 *   1. Race waitForURL with the Sign-in click so navigation is captured
 *      atomically instead of polling after the fact.
 *   2. Wait until we leave /login specifically (not "match /week"), so the
 *      / → /week/current → /week/YYYY-MM-DD chain doesn't matter.
 *   3. Fall back to a second click if the first didn't trigger navigation
 *      within 15s (dev-server compile race).
 *
 * After return, page is on some authenticated app route and the cookie is
 * settled. Callers can navigate freely.
 */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  const attempt = async () => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 }),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ]);
  };

  try {
    await attempt();
  } catch {
    // One retry — clears any half-baked dev-server compile state
    await attempt();
  }

  // Sanity: the authenticated shell mounted (Header has the brand link).
  await expect(
    page.getByRole('link', { name: /Timesheet|Week$/ }).first(),
  ).toBeVisible({ timeout: 30_000 });
}

/** Clear cookies between user switches. Cleaner than navigating to signout. */
export async function signOut(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}
