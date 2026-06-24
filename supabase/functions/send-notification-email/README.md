# send-notification-email

Supabase Edge Function that emails users about their notifications. Triggered
by the `notifications_email_dispatch` AFTER INSERT trigger via `pg_net`.

## How it fits together

```
RPC writes notifications row
        │
        ▼
AFTER INSERT trigger calls public.notify_email_webhook()
        │
        ▼
pg_net.http_post(url := app.notification_webhook_url, ...)
        │
        ▼
This Edge Function receives { notification_id }
        │   loads the notification + user
        │   checks user.email_notifications opt-in
        ▼
POST https://api.resend.com/emails
```

If the recipient hasn't opted in (`users.email_notifications = false`), the
function returns `{ skipped: 'opted out' }` and no mail is sent.
If `RESEND_API_KEY` is not set, it returns `{ skipped: 'dry-run' }` — useful
for local development.

## One-time setup

### 1. Set env vars (production)

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  NOTIFICATION_FROM_EMAIL="SRE Timesheet <noreply@sulfurrecovery.com>" \
  NOTIFICATION_WEBHOOK_SECRET=$(openssl rand -hex 32) \
  APP_BASE_URL=https://timesheet.sulfurrecovery.com
```

### 2. Deploy the function

```bash
supabase functions deploy send-notification-email --no-verify-jwt
```

`--no-verify-jwt` because the caller is `pg_net` from inside Postgres, not an
authenticated user. The function self-validates with `NOTIFICATION_WEBHOOK_SECRET`.

### 3. Point the database trigger at the function

```sql
alter database postgres set app.notification_webhook_url =
  'https://<project-ref>.supabase.co/functions/v1/send-notification-email';
alter database postgres set app.notification_webhook_secret =
  '<same value as NOTIFICATION_WEBHOOK_SECRET>';
```

(For local dev, use `http://host.docker.internal:54321/functions/v1/send-notification-email`.)

### 4. Verify in Resend

Make sure your sending domain is verified in the Resend dashboard before going
live. Test with one opted-in user; check the Resend log for the delivery
receipt.

## Local development

```bash
# Terminal 1
supabase functions serve send-notification-email --env-file ./supabase/.env.local

# Terminal 2 — submit a timesheet as a user with email_notifications=true.
# pg_net will POST to the local function; check the terminal for the resend
# call (or skipped: 'dry-run' if RESEND_API_KEY isn't set).
```

## Opt-in UX

Users toggle the preference at `/me/notifications` (the `EmailPrefToggle`
component). The column is `users.email_notifications boolean default false`
with an RLS policy that only allows the user to update their own row.
