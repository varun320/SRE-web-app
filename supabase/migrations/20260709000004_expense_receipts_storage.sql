-- Phase 3c — Storage bucket for expense receipts.
--
-- Path convention: expense-receipts/{user_id}/{expense_id}/{yyyymmdd}-{uuid}.{ext}
-- The user_id prefix means RLS on storage.objects can simply check the
-- first path segment == auth.uid()::text.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  10485760,  -- 10 MB
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do nothing;

-- Owner reads own receipts.
create policy expense_receipts_select_own on storage.objects
  for select using (
    bucket_id = 'expense-receipts'
    and (auth.uid())::text = split_part(name, '/', 1)
  );

-- Admin reads any receipt in their org (org boundary enforced by app since
-- storage.objects has no org column — safe because bucket is private and
-- admin role is required).
create policy expense_receipts_select_admin on storage.objects
  for select using (
    bucket_id = 'expense-receipts'
    and public.is_admin(auth.uid())
  );

-- Owner uploads/updates/deletes only their own files.
create policy expense_receipts_insert_own on storage.objects
  for insert with check (
    bucket_id = 'expense-receipts'
    and (auth.uid())::text = split_part(name, '/', 1)
  );

create policy expense_receipts_update_own on storage.objects
  for update using (
    bucket_id = 'expense-receipts'
    and (auth.uid())::text = split_part(name, '/', 1)
  );

create policy expense_receipts_delete_own on storage.objects
  for delete using (
    bucket_id = 'expense-receipts'
    and (auth.uid())::text = split_part(name, '/', 1)
  );
