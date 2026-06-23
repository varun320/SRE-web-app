alter table public.organizations  enable row level security;
alter table public.users          enable row level security;
alter table public.user_roles     enable row level security;
alter table public.positions      enable row level security;
alter table public.sub_categories enable row level security;
alter table public.projects       enable row level security;

create policy org_read on public.organizations for select to authenticated
  using (id = public.current_user_org());

create policy users_read on public.users for select to authenticated
  using (id = auth.uid() or (public.is_admin(auth.uid()) and org_id = public.current_user_org()));
create policy users_write_admin on public.users for all to authenticated
  using  (public.is_admin(auth.uid()) and org_id = public.current_user_org())
  with check (public.is_admin(auth.uid()) and org_id = public.current_user_org());

create policy roles_read on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy roles_write on public.user_roles for all to authenticated
  using  (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy positions_read on public.positions for select to authenticated
  using (org_id = public.current_user_org());
create policy positions_write on public.positions for all to authenticated
  using  (public.is_admin(auth.uid()) and org_id = public.current_user_org())
  with check (public.is_admin(auth.uid()) and org_id = public.current_user_org());

create policy subcats_read on public.sub_categories for select to authenticated using (true);
create policy subcats_write on public.sub_categories for all to authenticated
  using  (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy projects_read on public.projects for select to authenticated
  using (org_id = public.current_user_org());
create policy projects_write on public.projects for all to authenticated
  using  (public.is_admin(auth.uid()) and org_id = public.current_user_org())
  with check (public.is_admin(auth.uid()) and org_id = public.current_user_org());
