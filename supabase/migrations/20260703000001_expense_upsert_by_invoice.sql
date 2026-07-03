-- Fix expense_upsert_draft: when called without an explicit id but with an
-- invoice_no that already exists for this user, update in place instead of
-- crashing on the unique(user_id, invoice_no) constraint. This makes the RPC
-- actually idempotent on (user_id, invoice_no) — matching the MCP contract
-- and mirroring the Excel workflow where the invoice_no is the natural key.

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

  -- If no id supplied but invoice_no already exists for this user, treat as update.
  if v_id is null then
    select id into v_id from public.expense_reports
      where user_id = v_user and invoice_no = v_invoice;
  end if;

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
