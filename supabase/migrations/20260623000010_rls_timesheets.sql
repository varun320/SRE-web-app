alter table public.timesheets        enable row level security;
alter table public.timesheet_entries enable row level security;

create policy ts_read on public.timesheets for select to authenticated
  using (user_id = auth.uid()
      or (public.is_admin(auth.uid()) and org_id = public.current_user_org()));

create policy ts_insert_own on public.timesheets for insert to authenticated
  with check (user_id = auth.uid() and status = 'draft');

create policy ts_update_own on public.timesheets for update to authenticated
  using  (user_id = auth.uid() and status in ('draft','declined') and not locked)
  with check (user_id = auth.uid());

create policy ts_delete_own on public.timesheets for delete to authenticated
  using (user_id = auth.uid() and status = 'draft');

create policy entries_read on public.timesheet_entries for select to authenticated
  using (exists (select 1 from public.timesheets t where t.id = timesheet_id
                  and (t.user_id = auth.uid()
                       or (public.is_admin(auth.uid()) and t.org_id = public.current_user_org()))));

create policy entries_write on public.timesheet_entries for all to authenticated
  using (exists (select 1 from public.timesheets t where t.id = timesheet_id
                  and t.user_id = auth.uid() and t.status in ('draft','declined') and not t.locked))
  with check (exists (select 1 from public.timesheets t where t.id = timesheet_id
                  and t.user_id = auth.uid() and t.status in ('draft','declined') and not t.locked));

create or replace function public.guard_ts_status() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    raise exception 'status may only be changed via RPC' using errcode = '42501';
  end if;
  return new;
end$$;

create trigger trg_guard_ts_status
before update on public.timesheets
for each row execute function public.guard_ts_status();
