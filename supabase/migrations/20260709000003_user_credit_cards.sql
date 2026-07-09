-- Phase 3b — Per-user credit-card registry so line items can record
-- WHICH card was used for each purchase. Utsav 2026-07-08 asked to see
-- this at a glance when reviewing an expense report.

create table public.user_credit_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  label       text not null check (length(trim(label)) between 1 and 60),
  last_four   text check (last_four ~ '^\d{4}$'),
  is_default  boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, label)
);

create index on public.user_credit_cards (user_id, is_active);

-- Ensure at most one default card per user.
create unique index user_credit_cards_one_default
  on public.user_credit_cards (user_id)
  where is_default;

-- Now wire the FK from expense_line_items.credit_card_id (nullable).
alter table public.expense_line_items
  add constraint expense_line_items_credit_card_fk
  foreign key (credit_card_id) references public.user_credit_cards(id) on delete set null;

------------------------------------------------------------------------------
-- RLS — a user manages their own cards; admins can see all in the org for
-- reviewing expense reports.
------------------------------------------------------------------------------
alter table public.user_credit_cards enable row level security;

create policy user_cards_select on public.user_credit_cards
  for select using (
    user_id = auth.uid() or public.is_admin(auth.uid())
  );

create policy user_cards_insert on public.user_credit_cards
  for insert with check (user_id = auth.uid());

create policy user_cards_update on public.user_credit_cards
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_cards_delete on public.user_credit_cards
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.user_credit_cards to authenticated;

-- Touch trigger.
create trigger trg_touch_user_credit_cards
before update on public.user_credit_cards
for each row execute function public.touch_expense();  -- generic touch fn

------------------------------------------------------------------------------
-- Extend expense_lines_replace so it accepts an optional credit_card_id
-- per line. Non-owner cards are rejected.
------------------------------------------------------------------------------
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
      -- Enforce that the card belongs to this user.
      if not exists (
        select 1 from public.user_credit_cards
         where id = v_card_id and user_id = v_user
      ) then
        raise exception 'credit_card_id % is not yours', v_card_id using errcode='42501';
      end if;
    end if;

    insert into public.expense_line_items
      (expense_id, line_date, category, description, amount_cad, gst_cad,
       credit_card_id, position)
    values (
      p_expense_id,
      (v_line->>'line_date')::date,
      coalesce((v_line->>'category')::public.expense_category, 'Other'),
      trim(v_line->>'description'),
      coalesce(nullif(v_line->>'amount_cad','')::numeric, 0),
      coalesce(nullif(v_line->>'gst_cad','')::numeric, 0),
      v_card_id,
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  perform public.expense_report_recompute(p_expense_id);
end$$;

grant execute on function public.expense_lines_replace(uuid, jsonb) to authenticated;
