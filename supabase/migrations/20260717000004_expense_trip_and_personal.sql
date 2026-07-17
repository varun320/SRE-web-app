-- Two small additions Utsav asked for:
--
-- 1) trip_label on the report — free-text like "Czech Republic Aug 2026" so
--    admins can cluster 20+ related lines by trip.
--
-- 2) is_personal on each line item. When true, the line stays visible to
--    the employee (useful when scanning an Amex statement) but is
--    excluded from report totals + hidden from admin view. Recompute
--    trigger updated to skip personal lines.

alter table public.expense_reports
  add column trip_label text
    check (trip_label is null or length(trim(trip_label)) between 1 and 120);

alter table public.expense_line_items
  add column is_personal boolean not null default false;

create index on public.expense_line_items (expense_id, is_personal);

-- Recompute skips personal lines so submitted totals only reflect company spend.
create or replace function public.expense_report_recompute(p_expense_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_amount numeric(12,2);
  v_gst    numeric(12,2);
begin
  select coalesce(sum(amount_cad), 0), coalesce(sum(gst_cad), 0)
    into v_amount, v_gst
    from public.expense_line_items
   where expense_id = p_expense_id and is_personal = false;

  perform set_config('app.allow_status_change', 'on', true);
  update public.expense_reports
     set amount_cad = v_amount, gst_cad = v_gst
   where id = p_expense_id;
end$$;

-- Line-replace RPC now writes is_personal; everything else unchanged from v3.
create or replace function public.expense_lines_replace(p_expense_id uuid, p_lines jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := auth.uid();
  v_r       record;
  v_line    jsonb;
  v_pos     int := 0;
  v_card_id uuid;
  v_proj_id uuid;
  v_native_amt numeric(12,2);
  v_native_cur text;
begin
  if v_user is null then raise exception 'not authenticated' using errcode='42501'; end if;
  select * into v_r from public.expense_reports where id = p_expense_id for update;
  if not found then raise exception 'expense not found' using errcode='22023'; end if;
  if v_r.user_id <> v_user then raise exception 'not owner' using errcode='42501'; end if;
  if v_r.locked or v_r.status not in ('draft','declined') then
    raise exception 'cannot edit lines in status % (locked=%)', v_r.status, v_r.locked
      using errcode='22023';
  end if;

  delete from public.expense_line_items where expense_id = p_expense_id;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_card_id := nullif(v_line->>'credit_card_id','')::uuid;
    if v_card_id is not null then
      if not exists (
        select 1 from public.user_credit_cards
         where id = v_card_id and user_id = v_user
      ) then
        raise exception 'credit_card_id % is not yours', v_card_id using errcode='42501';
      end if;
    end if;

    v_proj_id := nullif(v_line->>'project_id','')::uuid;
    if v_proj_id is not null then
      if not exists (
        select 1 from public.projects p where p.id = v_proj_id and p.org_id = v_r.org_id
      ) then
        raise exception 'project_id % not in org', v_proj_id using errcode='42501';
      end if;
    end if;

    v_native_amt := nullif(v_line->>'native_amount','')::numeric;
    v_native_cur := nullif(upper(trim(v_line->>'native_currency')), '');
    if (v_native_amt is null) <> (v_native_cur is null) then
      raise exception 'native_amount and native_currency must both be set or both empty'
        using errcode='22023';
    end if;

    insert into public.expense_line_items
      (expense_id, line_date, category, description, amount_cad, gst_cad,
       credit_card_id, receipt_url, project_id,
       native_amount, native_currency, is_personal, position)
    values (
      p_expense_id,
      (v_line->>'line_date')::date,
      coalesce((v_line->>'category')::public.expense_category, 'Other'),
      trim(v_line->>'description'),
      coalesce(nullif(v_line->>'amount_cad','')::numeric, 0),
      coalesce(nullif(v_line->>'gst_cad','')::numeric, 0),
      v_card_id,
      nullif(v_line->>'receipt_url', ''),
      v_proj_id,
      v_native_amt,
      v_native_cur,
      coalesce((v_line->>'is_personal')::boolean, false),
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  perform public.expense_report_recompute(p_expense_id);
end$$;

grant execute on function public.expense_lines_replace(uuid, jsonb) to authenticated;

-- Extend upsert_draft to persist trip_label. Preserves the prior
-- invoice-lookup + declined->draft transition logic; only adds the
-- trip_label field.
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
  v_trip       text := nullif(trim(payload->>'trip_label'), '');
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
      trip_label      = v_trip,
      status          = case when v_existing.status = 'declined' then 'draft'::expense_status
                             else v_existing.status end,
      decline_reason  = null
    where id = v_id;
    return v_id;
  else
    insert into public.expense_reports
      (user_id, org_id, invoice_no, period_from, period_to, submission_date,
       amount_cad, gst_cad, notes, trip_label, status)
    values
      (v_user, v_org, v_invoice, v_pfrom, v_pto, v_sub,
       v_amount, v_gst, v_notes, v_trip, 'draft')
    returning id into v_id;
    return v_id;
  end if;
end$$;

grant execute on function public.expense_upsert_draft(jsonb) to authenticated;
