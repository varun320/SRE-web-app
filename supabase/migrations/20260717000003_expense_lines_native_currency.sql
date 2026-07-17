-- Record the original foreign-currency amount alongside the CAD figure
-- so admin can see, e.g., "USD 234.56 → CAD 320.10" for Utsav's Amex
-- statements and per-diem entries (2026-07-16 meeting).
--
-- CAD (amount_cad) stays the authoritative number for totals / accounting.
-- native_amount + native_currency are display-only breadcrumbs.

alter table public.expense_line_items
  add column native_amount   numeric(12,2),
  add column native_currency text
    check (native_currency is null or native_currency ~ '^[A-Z]{3}$');

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
    -- Both or neither.
    if (v_native_amt is null) <> (v_native_cur is null) then
      raise exception 'native_amount and native_currency must both be set or both empty'
        using errcode='22023';
    end if;

    insert into public.expense_line_items
      (expense_id, line_date, category, description, amount_cad, gst_cad,
       credit_card_id, receipt_url, project_id,
       native_amount, native_currency, position)
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
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  perform public.expense_report_recompute(p_expense_id);
end$$;

grant execute on function public.expense_lines_replace(uuid, jsonb) to authenticated;
