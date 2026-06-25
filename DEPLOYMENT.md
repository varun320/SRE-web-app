# Deployment Runbook — SRE Timesheet

Target stack: **Vercel** for the Next.js web app, **Supabase** for Postgres + Auth + Edge Functions.

Total operator time end-to-end: ~45 min for first deploy, ~5 min for subsequent pushes.

---

## 0. Prerequisites

- A Supabase account with billing enabled (free tier works to start).
- A Vercel account connected to the GitHub org that owns `varun320/SRE-web-app`.
- A custom domain you can point at Vercel (optional but recommended).
- Resend account + verified sending domain for email (optional, gated by `email_notifications`).

---

## 1. Create the Supabase project

```bash
# From a local shell with `supabase` CLI logged in:
supabase projects create sre-timesheet \
  --org-id <your-org-id> \
  --region us-east-1 \
  --db-password "<generate a strong one and save it>"
```

Save the **project ref** (e.g. `xyzabc123`). All later URLs use it.

Grab the keys from the Supabase dashboard → Project Settings → API:
- `Project URL`             → goes to `NEXT_PUBLIC_SUPABASE_URL`
- `Anon (public) key`       → goes to `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `Service role key` (kept secret) → goes to `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Apply migrations + seed reference data

```bash
cd /path/to/SRE-app
supabase link --project-ref <project-ref>
supabase db push                  # applies all 30 migrations
supabase db execute -f supabase/seed.sql   # organizations + positions + sub_categories
```

Verify:

```bash
supabase db query "select count(*) from public.sub_categories"
# Expect ~23
supabase db query "select count(*) from public.positions"
# Expect at least 1 (e.g. 'Senior Engineer')
```

---

## 3. Configure Supabase Auth

In the dashboard → Authentication → URL Configuration:

- **Site URL**: `https://<your-domain>`
- **Redirect URLs**: add
  - `https://<your-domain>/auth/callback`
  - `https://<your-domain>/auth/reset-password`
  - `https://<your-domain>/**` (catch-all for password reset return)

For magic-link / password-reset emails, set up custom SMTP in Authentication → SMTP Settings (Resend, SendGrid, AWS SES). Until you do, Supabase sends from a generic domain that often goes to spam.

---

## 4. Deploy the web app to Vercel

### 4a. Connect the repo

In Vercel → New Project → import `varun320/SRE-web-app`.

- **Root directory:** `web`
- **Framework preset:** Next.js (auto-detected)
- **Build command:** `next build` (defaulted)

### 4b. Environment variables

Add via Vercel dashboard → Settings → Environment Variables (or `vercel env add`):

| Key | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon key from §1) | All |
| `SUPABASE_SERVICE_ROLE_KEY` | (service-role key from §1) | **Production only** |
| `NEXT_PUBLIC_IMPORTER_ENABLED` | `false` (until §7) | All |

Hit **Deploy**. First build takes 2-3 min.

### 4c. Custom domain

Vercel → Settings → Domains → add. Update Supabase Site URL in §3 once the domain resolves.

---

## 5. Provision the first admin

After the first build, no users exist yet. Create one via the Supabase dashboard or:

```bash
# Set these for the command below
export SUPABASE_URL=https://<project-ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

cd web && node --input-type=module -e "
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ORG = '00000000-0000-0000-0000-000000000001';
const EMAIL = 'you@sulfurrecovery.com';
const PASS  = '<temp password — they reset on first login>';

const { data: created } = await sb.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true });
const uid = created.user.id;
const { data: pos } = await sb.from('positions').select('id').limit(1).single();
await sb.from('users').insert({
  id: uid, org_id: ORG, full_name: 'Admin', email: EMAIL,
  employee_code: 'A001', department: 'Operations', position_id: pos.id, is_active: true,
});
await sb.from('user_roles').insert({ user_id: uid, role: 'admin' });
console.log('admin ready:', EMAIL);
"
```

The admin can now sign in at `https://<your-domain>/login` and use **/admin/employees** to provision the rest of the team.

---

## 6. Wire email notifications (optional, gated)

See `supabase/functions/send-notification-email/README.md` for the full checklist. Summary:

1. `supabase secrets set RESEND_API_KEY=… NOTIFICATION_FROM_EMAIL=… NOTIFICATION_WEBHOOK_SECRET=… APP_BASE_URL=…`
2. `supabase functions deploy send-notification-email --no-verify-jwt`
3. ```sql
   alter database postgres set app.notification_webhook_url =
     'https://<project-ref>.supabase.co/functions/v1/send-notification-email';
   alter database postgres set app.notification_webhook_secret = '<same secret>';
   ```
4. Users toggle on at `/me/notifications`.

---

## 7. Enable the historical importer (optional)

`/admin/import` shells out to a Python CLI. Vercel can't run Python, so the surface is feature-flagged off by default.

To enable it in production you need a Python worker reachable from Vercel:

1. **Deploy a worker** (Fly.io / Railway / Render Docker) running the `scripts/import/` package with the CLI on `PATH`.
2. **Replace the `runDryRun` shell-out** in `web/lib/admin/import-runner.ts` with an HTTPS call to that worker (currently uses `execFile`).
3. Set `NEXT_PUBLIC_IMPORTER_ENABLED=true` in Vercel env.
4. Redeploy.

Until then, run imports against your local Supabase project via the CLI directly (`sre-import balances <csv> --commit --actor-email ...` pointed at the prod URL + service-role key) — same result, no UI.

---

## 8. Post-deploy verification checklist

- [ ] `GET https://<your-domain>/login` returns the split-panel sign-in page.
- [ ] Sign in as the admin from §5 → land on `/week/YYYY-MM-DD`.
- [ ] Click TIL bank / Vacation — hero balance renders (0/0 is fine).
- [ ] Visit `/admin` → 0 pending + 0/0/0 in stat cards.
- [ ] Visit `/admin/reports/payroll` → "No approved weeks in this range" empty state.
- [ ] Visit `/admin/employees/new` → create a test employee → sign in as them.
- [ ] Create a draft week → submit → admin sees the bell badge.
- [ ] Approve → employee sees the bell badge with "approved" notification.
- [ ] If §6 ran: a real email lands in the inbox (Resend dashboard shows the send).

If any step fails, check Vercel Function logs first, then the Supabase logs explorer.

---

## 9. Continuous deploy

Every push to `main` triggers a Vercel deploy. Pull requests get preview deploys automatically.

**For DB changes:**

```bash
# Author the migration locally + test it
supabase db push --local
# Then to production:
supabase db push        # uses the linked project
```

Migrations apply BEFORE the matching code lands on Vercel only if you push the migration first. Standard practice: push the DB migration, wait for it to apply, then merge the PR with the matching code.

---

## 10. Rollback

- **Web:** Vercel → Deployments → pick a previous green deploy → Promote.
- **DB:** there's no automatic rollback. Either write a forward-compensating migration, or restore the Supabase backup (Project Settings → Database → Backups → Point-in-Time-Recovery, requires paid tier).

Test all reversible-looking RPCs (`unlock_timesheet`, `decline_timesheet`) before relying on them as production rollbacks — they mark downstream ledgers stale but don't delete data.
