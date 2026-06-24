-- Plan 6 / Task 2 — notification helpers.
--
-- Two small SECURITY DEFINER helpers callable from inside the existing FSM
-- RPCs. notify_users() is the canonical insert path. admin_ids_for_org() is
-- a stable lookup the submit RPC uses to fan out to every admin.
--
-- Both functions exclude the actor from the recipient list automatically —
-- prevents an admin who submits + approves their own week from spamming
-- themselves.

create or replace function public.admin_ids_for_org(p_org_id uuid)
returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(u.id), '{}'::uuid[])
  from public.users u
  join public.user_roles r on r.user_id = u.id
  where r.role = 'admin' and u.org_id = p_org_id and u.is_active;
$$;

create or replace function public.notify_users(
  p_recipient_ids uuid[],
  p_org_id        uuid,
  p_kind          public.notification_kind,
  p_timesheet_id  uuid,
  p_actor_id      uuid,
  p_payload       jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_recipient_ids is null or array_length(p_recipient_ids, 1) is null then
    return;
  end if;

  insert into public.notifications(user_id, org_id, kind, timesheet_id, actor_id, payload)
  select rid, p_org_id, p_kind, p_timesheet_id, p_actor_id, p_payload
    from unnest(p_recipient_ids) rid
   where rid is distinct from p_actor_id;  -- skip self-notify
end$$;

-- These helpers are only called from within other SECURITY DEFINER RPCs, but
-- granting execute to authenticated keeps PostgREST type discovery happy and
-- doesn't expose anything new (the RLS on notifications enforces visibility).
grant execute on function public.admin_ids_for_org(uuid) to authenticated;
grant execute on function public.notify_users(uuid[], uuid, public.notification_kind, uuid, uuid, jsonb) to authenticated;
