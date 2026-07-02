-- Phase 1 / Task 3 — RLS for expense tables. Employees see and mutate only
-- their own drafts. Admins in the same org can read everything and mutate
-- through RPCs. Status/locked transitions are gated by the guard trigger
-- from 20260702000001.

alter table public.expense_settings      enable row level security;
alter table public.expense_reports       enable row level security;
alter table public.expense_payouts       enable row level security;
alter table public.expense_approval_log  enable row level security;

------------------------------------------------------------------------------
-- expense_settings — user owns their row; admins read the org.
------------------------------------------------------------------------------
create policy exp_settings_read on public.expense_settings for select to authenticated
  using (
    user_id = auth.uid()
    or (public.is_admin(auth.uid()) and exists (
          select 1 from public.users u
          where u.id = expense_settings.user_id
            and u.org_id = public.current_user_org()))
  );

create policy exp_settings_upsert on public.expense_settings for insert to authenticated
  with check (user_id = auth.uid());

create policy exp_settings_update on public.expense_settings for update to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

------------------------------------------------------------------------------
-- expense_reports — draft mutability mirrors timesheets.
------------------------------------------------------------------------------
create policy exp_read on public.expense_reports for select to authenticated
  using (
    user_id = auth.uid()
    or (public.is_admin(auth.uid()) and org_id = public.current_user_org())
  );

create policy exp_insert_own on public.expense_reports for insert to authenticated
  with check (user_id = auth.uid() and status = 'draft' and not locked);

create policy exp_update_own on public.expense_reports for update to authenticated
  using  (user_id = auth.uid() and status in ('draft','declined') and not locked)
  with check (user_id = auth.uid());

create policy exp_delete_own on public.expense_reports for delete to authenticated
  using (user_id = auth.uid() and status = 'draft');

------------------------------------------------------------------------------
-- expense_payouts — only admins mutate; employee reads own; admin reads org.
------------------------------------------------------------------------------
create policy exp_payouts_read on public.expense_payouts for select to authenticated
  using (
    user_id = auth.uid()
    or (public.is_admin(auth.uid()) and org_id = public.current_user_org())
  );

-- Mutations flow through RPCs only; no direct table policy.

------------------------------------------------------------------------------
-- expense_approval_log — read-only from client, written by RPCs.
------------------------------------------------------------------------------
create policy exp_log_read on public.expense_approval_log for select to authenticated
  using (
    exists (select 1 from public.expense_reports r
             where r.id = expense_approval_log.expense_id
               and (r.user_id = auth.uid()
                    or (public.is_admin(auth.uid())
                        and r.org_id = public.current_user_org())))
  );
