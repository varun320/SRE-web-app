-- Admin: delete any expense report regardless of status/lock.
-- Cascade drops line items + payouts (payouts already reference invoice_no,
-- so delete those explicitly to keep the payout log clean).
create or replace function public.expense_admin_delete(p_expense_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_r    record;
begin
  if not public.is_admin(v_user) then raise exception 'admin required' using errcode='42501'; end if;
  select * into v_r from public.expense_reports where id = p_expense_id for update;
  if not found then raise exception 'expense not found' using errcode='22023'; end if;
  if v_r.org_id <> public.current_user_org() then
    raise exception 'cross-org' using errcode='42501';
  end if;

  delete from public.expense_payouts where user_id = v_r.user_id and invoice_no = v_r.invoice_no;
  delete from public.expense_reports where id = p_expense_id;
end$$;

grant execute on function public.expense_admin_delete(uuid) to authenticated;
