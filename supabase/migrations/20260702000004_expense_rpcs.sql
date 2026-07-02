-- Phase 1 / Task 4 — Expense RPCs. All SECURITY DEFINER, all set
-- `app.allow_status_change` so the guard trigger permits the transition.

------------------------------------------------------------------------------
-- expense_upsert_draft — create-or-update a draft (or a declined report the
-- employee is fixing). Returns the row id.
------------------------------------------------------------------------------
create or replace function public.expense_upsert_draft(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user       uuid := auth.uid();
  v_org        uuid;
  v_id         uuid := nullif(payload->>'id','')::uuid;
  v_invoice    text := trim(payload->>'invoice_no');
  v_pfrom      date := (payload->>'period_from')::date;
  v_pto        date := (payload->>'period_to')::date;
  v_sub        date := coalesce(nullif(payload->>'submission_date','')::date, current_date);
  v_amount     numeric(12,2) := coalesce(nullif(payload->>'amount_cad','')::numeric, 0);
  v_gst        numeric(12,2) := coalesce(nullif(payload->>'gst_cad','')::numeric, 0);
  v_notes      text := payload->>'notes';
  v_existing   record;
begin
  if v_user is null then raise exception 'not authenticated' using errcode='42501'; end if;
  if v_invoice is null or length(v_invoice) < 3 then
    raise exception 'invoice_no required' using errcode='22023';
  end if;
  if v_pfrom is null or v_pto is null or v_pto < v_pfrom then
    raise exception 'invalid period' using errcode='22023';
  end if;
  if v_amount < 0 or v_gst < 0 then
    raise exception 'amounts must be non-negative' using errcode='22023';
  end if;

  select org_id into v_org from public.users where id = v_user;
  if v_org is null then raise exception 'org not found' using errcode='42501'; end if;

  perform set_config('app.allow_status_change', 'on', true);

  if v_id is not null then
    select * into v_existing from public.expense_reports where id = v_id for update;
    if not found then raise exception 'expense not found' using errcode='22023'; end if;
    if v_existing.user_id <> v_user then raise exception 'not owner' using errcode='42501'; end if;
    if v_existing.locked or v_existing.status not in ('draft','declined') then
      raise exception 'cannot edit in status % (locked=%)', v_existing.status, v_existing.locked
        using errcode='22023';
    end if;
    update public.expense_reports set
      invoice_no      = v_invoice,
      period_from     = v_pfrom,
      period_to       = v_pto,
      submission_date = v_sub,
      amount_cad      = v_amount,
      gst_cad         = v_gst,
      notes           = v_notes,
      status          = case when v_existing.status = 'declined' then 'draft'::expense_status
                             else v_existing.status end,
      decline_reason  = null
    where id = v_id;
    return v_id;
  else
    insert into public.expense_reports
      (user_id, org_id, invoice_no, period_from, period_to, submission_date,
       amount_cad, gst_cad, notes, status)
    values
      (v_user, v_org, v_invoice, v_pfrom, v_pto, v_sub,
       v_amount, v_gst, v_notes, 'draft')
    returning id into v_id;
    return v_id;
  end if;
end$$;

grant execute on function public.expense_upsert_draft(jsonb) to authenticated;

------------------------------------------------------------------------------
-- expense_submit — draft/declined -> submitted.
------------------------------------------------------------------------------
create or replace function public.expense_submit(p_expense_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_r    record;
begin
  select * into v_r from public.expense_reports where id = p_expense_id for update;
  if not found then raise exception 'expense not found' using errcode='22023'; end if;
  if v_r.user_id <> v_user then raise exception 'not owner' using errcode='42501'; end if;
  if v_r.status not in ('draft','declined') then
    raise exception 'cannot submit from status %', v_r.status using errcode='22023';
  end if;
  if v_r.total_cad <= 0 then
    raise exception 'total must be positive' using errcode='22023';
  end if;

  perform set_config('app.allow_status_change', 'on', true);
  update public.expense_reports
     set status='submitted', submitted_at=now(), decline_reason=null
   where id = p_expense_id;

  insert into public.expense_approval_log(expense_id, actor_id, action)
  values (p_expense_id, v_user, 'submit');
end$$;

grant execute on function public.expense_submit(uuid) to authenticated;

------------------------------------------------------------------------------
-- expense_approve — admin only; submitted -> approved + lock.
------------------------------------------------------------------------------
create or replace function public.expense_approve(p_expense_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_r    record;
begin
  if not public.is_admin(v_user) then
    raise exception 'admin required' using errcode='42501';
  end if;
  select * into v_r from public.expense_reports where id = p_expense_id for update;
  if not found then raise exception 'expense not found' using errcode='22023'; end if;
  if v_r.org_id <> public.current_user_org() then
    raise exception 'cross-org' using errcode='42501';
  end if;
  if v_r.status <> 'submitted' then
    raise exception 'cannot approve from status %', v_r.status using errcode='22023';
  end if;

  perform set_config('app.allow_status_change', 'on', true);
  update public.expense_reports
     set status='approved', locked=true, decided_at=now(), decided_by=v_user,
         decline_reason=null
   where id = p_expense_id;

  insert into public.expense_approval_log(expense_id, actor_id, action)
  values (p_expense_id, v_user, 'approve');
end$$;

grant execute on function public.expense_approve(uuid) to authenticated;

------------------------------------------------------------------------------
-- expense_decline — admin only; submitted -> declined.
------------------------------------------------------------------------------
create or replace function public.expense_decline(p_expense_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_r    record;
begin
  if not public.is_admin(v_user) then raise exception 'admin required' using errcode='42501'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason required' using errcode='22023';
  end if;
  select * into v_r from public.expense_reports where id = p_expense_id for update;
  if not found then raise exception 'expense not found' using errcode='22023'; end if;
  if v_r.org_id <> public.current_user_org() then
    raise exception 'cross-org' using errcode='42501';
  end if;
  if v_r.status <> 'submitted' then
    raise exception 'cannot decline from status %', v_r.status using errcode='22023';
  end if;

  perform set_config('app.allow_status_change', 'on', true);
  update public.expense_reports
     set status='declined', decided_at=now(), decided_by=v_user, decline_reason=p_reason
   where id = p_expense_id;

  insert into public.expense_approval_log(expense_id, actor_id, action, comment)
  values (p_expense_id, v_user, 'decline', p_reason);
end$$;

grant execute on function public.expense_decline(uuid, text) to authenticated;

------------------------------------------------------------------------------
-- expense_unlock — admin only; approved -> declined+unlocked so employee can
-- amend and resubmit. Mirrors timesheet unlock semantics.
------------------------------------------------------------------------------
create or replace function public.expense_unlock(p_expense_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_r    record;
begin
  if not public.is_admin(v_user) then raise exception 'admin required' using errcode='42501'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason required' using errcode='22023';
  end if;
  select * into v_r from public.expense_reports where id = p_expense_id for update;
  if not found then raise exception 'expense not found' using errcode='22023'; end if;
  if v_r.org_id <> public.current_user_org() then
    raise exception 'cross-org' using errcode='42501';
  end if;
  if v_r.status <> 'approved' then
    raise exception 'cannot unlock from status %', v_r.status using errcode='22023';
  end if;

  perform set_config('app.allow_status_change', 'on', true);
  update public.expense_reports
     set status='declined', locked=false, decided_at=now(), decided_by=v_user,
         decline_reason=p_reason
   where id = p_expense_id;

  insert into public.expense_approval_log(expense_id, actor_id, action, comment)
  values (p_expense_id, v_user, 'unlock', p_reason);
end$$;

grant execute on function public.expense_unlock(uuid, text) to authenticated;

------------------------------------------------------------------------------
-- payout_upsert — admin only. Adds/updates a payout row and, if the invoice
-- is fully paid (principal + interest zero), flips the report to 'paid'.
------------------------------------------------------------------------------
create or replace function public.payout_upsert(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user       uuid := auth.uid();
  v_id         uuid := nullif(payload->>'id','')::uuid;
  v_user_tgt   uuid := (payload->>'user_id')::uuid;
  v_invoice    text := trim(payload->>'invoice_no');
  v_date       date := (payload->>'payout_date')::date;
  v_amount     numeric(12,2) := (payload->>'amount_cad')::numeric;
  v_ref        text := payload->>'reference';
  v_notes      text := payload->>'notes';
  v_r          record;
  v_org        uuid;
begin
  if not public.is_admin(v_user) then raise exception 'admin required' using errcode='42501'; end if;
  if v_invoice is null or v_user_tgt is null or v_date is null or v_amount is null then
    raise exception 'invoice_no, user_id, payout_date, amount_cad required' using errcode='22023';
  end if;
  if v_amount <= 0 then raise exception 'amount must be positive' using errcode='22023'; end if;

  select * into v_r from public.expense_reports
   where user_id = v_user_tgt and invoice_no = v_invoice for update;
  if not found then raise exception 'expense not found' using errcode='22023'; end if;
  if v_r.org_id <> public.current_user_org() then
    raise exception 'cross-org' using errcode='42501';
  end if;
  v_org := v_r.org_id;

  if v_id is not null then
    update public.expense_payouts set
      payout_date = v_date,
      amount_cad  = v_amount,
      reference   = v_ref,
      notes       = v_notes
    where id = v_id and org_id = v_org
    returning id into v_id;
    if v_id is null then raise exception 'payout not found' using errcode='22023'; end if;
  else
    insert into public.expense_payouts
      (user_id, org_id, invoice_no, payout_date, amount_cad, reference, notes, created_by)
    values
      (v_user_tgt, v_org, v_invoice, v_date, v_amount, v_ref, v_notes, v_user)
    returning id into v_id;
  end if;

  insert into public.expense_approval_log(expense_id, actor_id, action, comment)
  values (v_r.id, v_user, 'payout_add', v_invoice || ' ' || v_amount::text);

  -- Auto-flip to 'paid' when principal + interest cleared.
  perform set_config('app.allow_status_change', 'on', true);
  update public.expense_reports r
     set status = 'paid'
   where r.id = v_r.id
     and r.status = 'approved'
     and exists (
       select 1 from public.v_expense_balance_full b
        where b.id = r.id and b.total_owing <= 0
     );

  return v_id;
end$$;

grant execute on function public.payout_upsert(jsonb) to authenticated;

------------------------------------------------------------------------------
-- payout_delete — admin only.
------------------------------------------------------------------------------
create or replace function public.payout_delete(p_payout_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_p    record;
begin
  if not public.is_admin(v_user) then raise exception 'admin required' using errcode='42501'; end if;
  select * into v_p from public.expense_payouts where id = p_payout_id for update;
  if not found then raise exception 'payout not found' using errcode='22023'; end if;
  if v_p.org_id <> public.current_user_org() then
    raise exception 'cross-org' using errcode='42501';
  end if;

  delete from public.expense_payouts where id = p_payout_id;

  insert into public.expense_approval_log(expense_id, actor_id, action, comment)
  select r.id, v_user, 'payout_delete', v_p.invoice_no || ' ' || v_p.amount_cad::text
    from public.expense_reports r
   where r.user_id = v_p.user_id and r.invoice_no = v_p.invoice_no;
end$$;

grant execute on function public.payout_delete(uuid) to authenticated;
