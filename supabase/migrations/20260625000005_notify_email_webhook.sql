-- Plan 6 / Task 6 — fire an HTTP webhook on every notification insert.
--
-- The webhook URL is read from `app.notification_webhook_url` (set per-env
-- via `alter database ... set app.notification_webhook_url = '...'`).
-- The Edge Function on the other side reads the notification row, joins to
-- users.email, respects email_notifications, and sends via Resend.
--
-- The trigger never raises — a failed webhook MUST NOT roll back the
-- transactional notification insert. pg_net is async/fire-and-forget anyway.

create or replace function public.notify_email_webhook()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text;
  v_secret text;
begin
  -- Webhook disabled if URL not configured. Local dev without an Edge Function: no-op.
  v_url := current_setting('app.notification_webhook_url', true);
  if v_url is null or length(v_url) = 0 then
    return new;
  end if;

  v_secret := coalesce(current_setting('app.notification_webhook_secret', true), '');

  -- Async POST — pg_net queues and returns immediately.
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'X-Webhook-Secret', v_secret
               ),
    body    := jsonb_build_object('notification_id', new.id)
  );
  return new;
exception when others then
  -- Never fail the insert because of a webhook hiccup.
  raise warning 'notify_email_webhook failed: %', sqlerrm;
  return new;
end$$;

drop trigger if exists notifications_email_dispatch on public.notifications;
create trigger notifications_email_dispatch
  after insert on public.notifications
  for each row execute function public.notify_email_webhook();
