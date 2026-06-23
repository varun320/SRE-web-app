create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = uid and role = 'admin');
$$;

create or replace function public.current_user_org()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.users where id = auth.uid();
$$;

create or replace function public.same_org(target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1
    from public.users me, public.users t
    where me.id = auth.uid() and t.id = target_user and me.org_id = t.org_id
  );
$$;

grant execute on function public.is_admin(uuid)         to authenticated;
grant execute on function public.current_user_org()     to authenticated;
grant execute on function public.same_org(uuid)         to authenticated;
