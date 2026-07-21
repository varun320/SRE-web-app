-- Remove email-notification feature: in-app notifications only.
drop trigger if exists notifications_email_dispatch on public.notifications;
drop function if exists public.notify_email_webhook();
drop policy if exists users_self_email_pref on public.users;
alter table public.users drop column if exists email_notifications;
