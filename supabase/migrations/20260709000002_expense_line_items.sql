-- Phase 3a — Line items for expense reports.
--
-- Per Utsav 2026-07-08: one expense report should break down into
-- individual line items (date, category, description, amount, GST, and
-- eventually which credit card was used + receipt image). Report-level
-- amount_cad and gst_cad become derived from SUM(line_items) — kept in
-- sync via trigger so existing views and payout math don't change.

------------------------------------------------------------------------------
-- expense_category — simple enum. Promote to a table if the org wants CRUD.
------------------------------------------------------------------------------
create type public.expense_category as enum (
  'Meals',
  'Fuel',
  'Transport',
  'Hotel',
  'Office Supplies',
  'Communications',
  'Client Entertainment',
  'Other'
);

------------------------------------------------------------------------------
-- expense_line_items — one row per receipt / claim inside a report.
------------------------------------------------------------------------------
create table public.expense_line_items (
  id             uuid primary key default gen_random_uuid(),
  expense_id     uuid not null references public.expense_reports(id) on delete cascade,
  line_date      date not null,
  category       public.expense_category not null default 'Other',
  description    text not null check (length(trim(description)) between 1 and 500),
  amount_cad     numeric(12,2) not null check (amount_cad >= 0),
  gst_cad        numeric(12,2) not null default 0 check (gst_cad >= 0),
  credit_card_id uuid,   -- FK added in Phase 3b once user_credit_cards exists
  receipt_url    text,   -- populated in Phase 3c
  position       int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on public.expense_line_items (expense_id, position);
create index on public.expense_line_items (line_date desc);

------------------------------------------------------------------------------
-- Keep expense_reports.amount_cad + gst_cad in lockstep with the sum of
-- the report's line items. Uses set_config to bypass the status guard
-- when it's the trigger performing the update.
------------------------------------------------------------------------------
create or replace function public.expense_report_recompute(p_expense_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_amount numeric(12,2);
  v_gst    numeric(12,2);
begin
  select coalesce(sum(amount_cad), 0), coalesce(sum(gst_cad), 0)
    into v_amount, v_gst
    from public.expense_line_items where expense_id = p_expense_id;

  perform set_config('app.allow_status_change', 'on', true);
  update public.expense_reports
     set amount_cad = v_amount, gst_cad = v_gst
   where id = p_expense_id;
end$$;

create or replace function public.trg_line_item_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_target uuid;
begin
  v_target := coalesce(new.expense_id, old.expense_id);
  perform public.expense_report_recompute(v_target);
  return null;
end$$;

create trigger trg_line_item_sync_ins_upd
after insert or update on public.expense_line_items
for each row execute function public.trg_line_item_sync();

create trigger trg_line_item_sync_del
after delete on public.expense_line_items
for each row execute function public.trg_line_item_sync();

create trigger trg_touch_expense_line
before update on public.expense_line_items
for each row execute function public.touch_expense();  -- reuse existing touch fn

------------------------------------------------------------------------------
-- RLS — same rules as expense_reports: employee sees own lines, admin sees
-- everyone's in their org.
------------------------------------------------------------------------------
alter table public.expense_line_items enable row level security;

create policy expense_lines_select on public.expense_line_items
  for select using (
    exists (
      select 1 from public.expense_reports r
       where r.id = expense_line_items.expense_id
         and (r.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

create policy expense_lines_write on public.expense_line_items
  for all using (
    exists (
      select 1 from public.expense_reports r
       where r.id = expense_line_items.expense_id
         and r.user_id = auth.uid()
         and not r.locked
         and r.status in ('draft','declined')
    )
  ) with check (
    exists (
      select 1 from public.expense_reports r
       where r.id = expense_line_items.expense_id
         and r.user_id = auth.uid()
         and not r.locked
         and r.status in ('draft','declined')
    )
  );

grant select, insert, update, delete on public.expense_line_items to authenticated;

------------------------------------------------------------------------------
-- RPC: expense_lines_replace — atomic replace-all-lines-for-a-draft. Takes
-- the report id + a jsonb array of line rows. Deletes existing lines,
-- inserts the new set. Report totals recompute via trigger.
------------------------------------------------------------------------------
create or replace function public.expense_lines_replace(p_expense_id uuid, p_lines jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_r    record;
  v_line jsonb;
  v_pos  int := 0;
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
    insert into public.expense_line_items
      (expense_id, line_date, category, description, amount_cad, gst_cad, position)
    values (
      p_expense_id,
      (v_line->>'line_date')::date,
      coalesce((v_line->>'category')::public.expense_category, 'Other'),
      trim(v_line->>'description'),
      coalesce(nullif(v_line->>'amount_cad','')::numeric, 0),
      coalesce(nullif(v_line->>'gst_cad','')::numeric, 0),
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  perform public.expense_report_recompute(p_expense_id);
end$$;

grant execute on function public.expense_lines_replace(uuid, jsonb) to authenticated;
