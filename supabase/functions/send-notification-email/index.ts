/**
 * Supabase Edge Function — send-notification-email
 *
 * Called by an AFTER INSERT trigger on `notifications` (via pg_net).
 * Reads the notification, joins to users for email + opt-in, and dispatches
 * a templated message through Resend. Silently no-ops if the recipient
 * disabled emails or RESEND_API_KEY is unset.
 *
 * Env (set via `supabase secrets set` for prod, .env for local):
 *   RESEND_API_KEY                 — required for actual send
 *   NOTIFICATION_FROM_EMAIL        — e.g. "SRE Timesheet <noreply@sulfurrecovery.com>"
 *   NOTIFICATION_WEBHOOK_SECRET    — optional shared secret; matches DB setting
 *   APP_BASE_URL                   — e.g. "https://timesheet.sulfurrecovery.com"
 *   SUPABASE_URL                   — auto-provided in hosted Edge Functions
 *   SUPABASE_SERVICE_ROLE_KEY      — auto-provided
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  timesheet_id: string | null;
  payload: Record<string, unknown>;
  users: { email: string; full_name: string; email_notifications: boolean } | null;
  timesheets: { week_start: string } | null;
}

const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'http://localhost:3000';
const FROM = Deno.env.get('NOTIFICATION_FROM_EMAIL') ?? 'SRE Timesheet <noreply@example.com>';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const WEBHOOK_SECRET = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET') ?? '';

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET) {
    const got = req.headers.get('x-webhook-secret') ?? '';
    if (got !== WEBHOOK_SECRET) {
      return json({ error: 'unauthorized' }, 401);
    }
  }

  let body: { notification_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  if (!body.notification_id) return json({ error: 'notification_id required' }, 400);

  const { data, error } = await sb
    .from('notifications')
    .select(
      `id, user_id, kind, timesheet_id, payload,
       users:user_id ( email, full_name, email_notifications ),
       timesheets:timesheet_id ( week_start )`,
    )
    .eq('id', body.notification_id)
    .single();

  if (error || !data) return json({ error: error?.message ?? 'not found' }, 404);

  const row = data as unknown as NotificationRow;
  const user = row.users;
  if (!user) return json({ skipped: 'user vanished' });
  if (!user.email_notifications) return json({ skipped: 'opted out' });
  if (!RESEND_KEY) return json({ skipped: 'RESEND_API_KEY not set (dry-run)' });

  const tmpl = template(row);
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [user.email],
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return json({ error: `resend ${resp.status}`, body: text }, 502);
  }
  return json({ sent: true, to: user.email });
});

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function template(n: NotificationRow): EmailTemplate {
  const payload = n.payload as {
    week_start?: string;
    employee_name?: string;
    actor_name?: string;
    reason?: string;
  };
  const week = payload.week_start ?? n.timesheets?.week_start ?? '';
  const employee = payload.employee_name ?? 'an employee';
  const actor = payload.actor_name ?? 'an admin';
  const reason = payload.reason ?? '';

  const linkSelf = `${APP_BASE}/week/${week || 'current'}`;
  const linkAdmin = n.timesheet_id
    ? `${APP_BASE}/admin/employees/${n.user_id}/week/${week}`
    : `${APP_BASE}/admin`;

  switch (n.kind) {
    case 'timesheet_submitted':
      return wrap(
        `${employee} submitted the week of ${week}`,
        `<p><strong>${esc(employee)}</strong> just submitted their timesheet for the week of <strong>${esc(week)}</strong>.</p>
         <p>Open the queue to review and approve.</p>`,
        linkAdmin,
        'Review timesheet',
      );
    case 'timesheet_approved':
      return wrap(
        `Your week of ${week} was approved`,
        `<p><strong>${esc(actor)}</strong> approved your week of <strong>${esc(week)}</strong>.</p>
         <p>It's now locked. TIL and vacation balances are updated.</p>`,
        linkSelf,
        'View your week',
      );
    case 'timesheet_declined':
      return wrap(
        `Your week of ${week} was declined`,
        `<p><strong>${esc(actor)}</strong> declined your week of <strong>${esc(week)}</strong>.</p>
         ${reason ? `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;">${esc(reason)}</blockquote>` : ''}
         <p>You can edit the week and resubmit.</p>`,
        linkSelf,
        'Open your week',
      );
    case 'timesheet_unlocked':
      return wrap(
        `Your week of ${week} was unlocked`,
        `<p><strong>${esc(actor)}</strong> unlocked your previously-approved week of <strong>${esc(week)}</strong>.</p>
         ${reason ? `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;">${esc(reason)}</blockquote>` : ''}
         <p>Subsequent approved weeks will recompute on re-approval.</p>`,
        linkSelf,
        'Open your week',
      );
    case 'timesheet_force_submitted':
      return wrap(
        `Your week of ${week} was submitted on your behalf`,
        `<p><strong>${esc(actor)}</strong> submitted your week of <strong>${esc(week)}</strong> on your behalf.</p>
         ${reason ? `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;">${esc(reason)}</blockquote>` : ''}
         <p>Check it over and let your admin know if anything needs fixing.</p>`,
        linkSelf,
        'View your week',
      );
    default:
      return wrap('SRE Timesheet notification', '<p>You have a new notification.</p>', APP_BASE, 'Open app');
  }
}

function wrap(subject: string, bodyHtml: string, ctaUrl: string, ctaLabel: string): EmailTemplate {
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8f7f4;font-family:-apple-system,Segoe UI,sans-serif;color:#222;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="padding-bottom:16px;font-weight:600;color:#444;">SRE Timesheet</td></tr>
        <tr><td style="font-size:15px;line-height:1.55;">
          ${bodyHtml}
          <p style="margin-top:24px;">
            <a href="${esc(ctaUrl)}" style="display:inline-block;background:#3a6dd4;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:500;">${esc(ctaLabel)}</a>
          </p>
        </td></tr>
        <tr><td style="padding-top:24px;font-size:11px;color:#888;">
          You're receiving this because email notifications are enabled on your account.
          <a href="${esc(APP_BASE)}/me/notifications" style="color:#888;">Manage preferences</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = subject + '\n\n' + bodyHtml.replace(/<[^>]+>/g, '').trim() + '\n\n' + ctaLabel + ': ' + ctaUrl;
  return { subject, html, text };
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
