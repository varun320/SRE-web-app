-- Add the 16 categories Utsav sent (2026-07-16 meeting) as new enum
-- values. Old values stay valid so existing rows keep working; the UI
-- only offers the new list going forward.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction in older
-- Postgres, and duplicates would error, so each add is guarded.

do $$
declare
  v_new text[] := array[
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
    'Uber Membership'
    -- 'Other' already exists
  ];
  v_val text;
begin
  foreach v_val in array v_new loop
    if not exists (
      select 1 from pg_enum e
       join pg_type t on t.oid = e.enumtypid
       where t.typname = 'expense_category'
         and e.enumlabel = v_val
    ) then
      execute format('alter type public.expense_category add value %L', v_val);
    end if;
  end loop;
end$$;
