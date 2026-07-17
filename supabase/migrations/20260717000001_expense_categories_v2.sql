-- Replace expense_category enum with the 16-value list Utsav sent
-- 2026-07-17. Old values are mapped onto the new list where a sensible
-- one exists; anything unmapped falls through to 'Other'.

create type public.expense_category_v2 as enum (
  'Airfare',
  'Airport Cart',
  'Cab',
  'Credit Card fees',
  'Gift for Client / Marketing',
  'Ground Transportation',
  'GYM Membership',
  'Hotel',
  'Meal',
  'Meal with Client',
  'Office/Lab Supplies',
  'SCBA Rental',
  'Software Subscription',
  'Tools',
  'Uber Membership',
  'Other'
);

alter table public.expense_line_items
  alter column category drop default;

alter table public.expense_line_items
  alter column category type public.expense_category_v2
  using (
    case category::text
      when 'Meals'                then 'Meal'
      when 'Fuel'                 then 'Ground Transportation'
      when 'Transport'            then 'Ground Transportation'
      when 'Hotel'                then 'Hotel'
      when 'Office Supplies'      then 'Office/Lab Supplies'
      when 'Client Entertainment' then 'Meal with Client'
      else 'Other'
    end
  )::public.expense_category_v2;

alter table public.expense_line_items
  alter column category set default 'Other'::public.expense_category_v2;

drop type public.expense_category;
alter type public.expense_category_v2 rename to expense_category;

-- Recreate the replace RPC so its default cast targets the new enum.
create or replace function public.expense_lines_replace(p_expense_id uuid, p_lines jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := auth.uid();
  v_r       record;
  v_line    jsonb;
  v_pos     int := 0;
  v_card_id uuid;
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

    insert into public.expense_line_items
      (expense_id, line_date, category, description, amount_cad, gst_cad,
       credit_card_id, receipt_url, position)
    values (
      p_expense_id,
      (v_line->>'line_date')::date,
      coalesce((v_line->>'category')::public.expense_category, 'Other'),
      trim(v_line->>'description'),
      coalesce(nullif(v_line->>'amount_cad','')::numeric, 0),
      coalesce(nullif(v_line->>'gst_cad','')::numeric, 0),
      v_card_id,
      nullif(v_line->>'receipt_url', ''),
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  perform public.expense_report_recompute(p_expense_id);
end$$;

grant execute on function public.expense_lines_replace(uuid, jsonb) to authenticated;
