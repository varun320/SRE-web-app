alter table public.til_ledger      enable row level security;
alter table public.vacation_ledger enable row level security;
alter table public.approval_log    enable row level security;

create policy til_read on public.til_ledger for select to authenticated
  using (user_id = auth.uid() or (public.is_admin(auth.uid()) and public.same_org(user_id)));
create policy vac_read on public.vacation_ledger for select to authenticated
  using (user_id = auth.uid() or (public.is_admin(auth.uid()) and public.same_org(user_id)));

create policy log_read on public.approval_log for select to authenticated
  using (exists (select 1 from public.timesheets t where t.id = timesheet_id
                  and (t.user_id = auth.uid()
                       or (public.is_admin(auth.uid()) and t.org_id = public.current_user_org()))));
