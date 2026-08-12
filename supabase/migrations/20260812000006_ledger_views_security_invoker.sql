-- v_til_balance and v_vacation_balance were created without security_invoker,
-- so they run as the view owner and bypass RLS on til_ledger / vacation_ledger.
-- Result: any authenticated user could SELECT every user's balance, and
-- .maybeSingle() calls on the client failed with "multiple rows" because 8
-- users' rows came back to each caller — silently returning 0 to the KPI strip.
--
-- Flipping to security_invoker delegates permissions to the caller, at which
-- point the underlying til_read / vac_read policies scope rows correctly.

alter view public.v_til_balance      set (security_invoker = on);
alter view public.v_vacation_balance set (security_invoker = on);
