-- Allow the employee to pull a submitted report back to draft within 24 h,
-- provided admin hasn't already approved/declined/paid it. Removes the
-- 'ping admin to decline so I can edit' round-trip.

alter table public.expense_approval_log
  drop constraint expense_approval_log_action_check;

alter table public.expense_approval_log
  add constraint expense_approval_log_action_check check (action in
    ('submit','unsubmit','approve','decline','unlock','admin_edit','payout_add','payout_delete'));

create or replace function public.expense_unsubmit(p_expense_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_r    record;
begin
  if v_user is null then raise exception 'not authenticated' using errcode='42501'; end if;
  select * into v_r from public.expense_reports where id = p_expense_id for update;
  if not found then raise exception 'expense not found' using errcode='22023'; end if;
  if v_r.user_id <> v_user then raise exception 'not owner' using errcode='42501'; end if;
  if v_r.status <> 'submitted' then
    raise exception 'can only pull back a submitted report (status is %)', v_r.status using errcode='22023';
  end if;
  if v_r.submitted_at is null or v_r.submitted_at < now() - interval '24 hours' then
    raise exception 'unsubmit window has closed — ask admin to decline instead' using errcode='22023';
  end if;

  perform set_config('app.allow_status_change', 'on', true);
  update public.expense_reports
     set status = 'draft', submitted_at = null
   where id = p_expense_id;

  insert into public.expense_approval_log(expense_id, actor_id, action)
  values (p_expense_id, v_user, 'unsubmit');
end$$;

grant execute on function public.expense_unsubmit(uuid) to authenticated;
