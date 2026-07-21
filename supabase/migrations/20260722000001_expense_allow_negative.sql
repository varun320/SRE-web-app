-- Allow negative expense amounts to represent refunds as itemized lines.
alter table public.expense_line_items      drop constraint if exists expense_line_items_amount_cad_check;
alter table public.expense_line_items      drop constraint if exists expense_line_items_gst_cad_check;
alter table public.expense_line_favourites drop constraint if exists expense_line_favourites_amount_cad_check;
alter table public.expense_line_favourites drop constraint if exists expense_line_favourites_gst_cad_check;
