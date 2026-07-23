-- Segment-based interest accrual.
--
-- Prior view charged interest only while principal remained unpaid and used
-- the *current* outstanding balance × days-since-due. Two bugs:
--   1) A fully paid invoice that cleared *after* the due date accrued zero
--      interest — the late-payment period vanished the instant balance hit 0.
--   2) With partial payments, interest for the pre-payment window was
--      computed against the reduced balance, undercharging.
--
-- New model: walk payouts in date order. For each segment [prev, next] use
-- the balance that was outstanding during that segment. Payouts on/before the
-- due date reduce the starting principal. Accrual stops when the balance hits
-- 0 (final payout date) or continues to today if any balance remains.

create or replace function public.expense_interest_for(
  p_user      uuid,
  p_invoice   text,
  p_claimed   numeric,
  p_due_date  date,
  p_apr       numeric
) returns numeric
language plpgsql stable as $$
declare
  v_pre_due_paid numeric;
  v_balance      numeric;
  v_prev_date    date := p_due_date;
  v_interest     numeric := 0;
  rec            record;
begin
  select coalesce(sum(amount_cad), 0) into v_pre_due_paid
  from public.expense_payouts
  where user_id = p_user
    and invoice_no = p_invoice
    and payout_date <= p_due_date;

  v_balance := p_claimed - v_pre_due_paid;
  if v_balance <= 0 then
    return 0;
  end if;

  for rec in
    select payout_date, amount_cad
    from public.expense_payouts
    where user_id = p_user
      and invoice_no = p_invoice
      and payout_date > p_due_date
    order by payout_date, id
  loop
    v_interest := v_interest
      + v_balance * (rec.payout_date - v_prev_date)::numeric * p_apr / 365.0;
    v_balance  := v_balance - rec.amount_cad;
    v_prev_date := rec.payout_date;
    if v_balance <= 0 then
      return round(v_interest, 2);
    end if;
  end loop;

  if current_date > v_prev_date then
    v_interest := v_interest
      + v_balance * (current_date - v_prev_date)::numeric * p_apr / 365.0;
  end if;

  return round(v_interest, 2);
end$$;

grant execute on function public.expense_interest_for(uuid, text, numeric, date, numeric)
  to authenticated;

create or replace view public.v_expense_balance as
with s as (
  select
    r.id,
    r.user_id,
    r.org_id,
    r.invoice_no,
    r.submission_date,
    r.total_cad                                         as claimed,
    (public.expense_settings_for(r.user_id)).apr        as apr,
    (public.expense_settings_for(r.user_id)).grace_days as grace_days,
    coalesce(p.paid_to_date, 0)::numeric(14,2)          as paid,
    p.last_payment_date,
    r.status                                            as report_status,
    r.locked
  from public.expense_reports r
  left join public.v_expense_payout_agg p
    on p.user_id = r.user_id and p.invoice_no = r.invoice_no
  where r.status in ('submitted','approved','paid')
)
select
  s.id,
  s.user_id,
  s.org_id,
  s.invoice_no,
  s.submission_date,
  (s.submission_date + s.grace_days) as due_date,
  s.claimed,
  s.paid,
  greatest(s.claimed - s.paid, 0)::numeric(14,2) as outstanding,
  case
    when s.claimed - s.paid <= 0 then 0
    else greatest(current_date - (s.submission_date + s.grace_days), 0)
  end::int as days_overdue,
  public.expense_interest_for(
    s.user_id,
    s.invoice_no,
    s.claimed,
    (s.submission_date + s.grace_days)::date,
    s.apr
  )::numeric(14,2) as interest_owing,
  s.report_status,
  s.locked
from s;

create or replace view public.v_expense_balance_full as
select
  b.*,
  (b.outstanding + b.interest_owing)::numeric(14,2) as total_owing,
  case
    when b.outstanding <= 0 and b.interest_owing <= 0 then 'paid'
    when b.outstanding <= 0 and b.interest_owing >  0 then 'interest_owing'
    when b.days_overdue > 0                           then 'overdue'
    else                                                   'outstanding'
  end as balance_status
from public.v_expense_balance b;

create or replace view public.v_expense_summary as
select
  u.id                                              as user_id,
  u.org_id,
  coalesce(sum(b.claimed), 0)::numeric(14,2)        as total_submitted,
  coalesce(sum(b.paid), 0)::numeric(14,2)           as total_received,
  coalesce(sum(b.outstanding), 0)::numeric(14,2)    as outstanding_principal,
  coalesce(sum(b.interest_owing), 0)::numeric(14,2) as interest_accrued,
  coalesce(sum(b.total_owing), 0)::numeric(14,2)    as total_owing
from public.users u
left join public.v_expense_balance_full b on b.user_id = u.id
group by u.id, u.org_id;

grant select on public.v_expense_balance      to authenticated;
grant select on public.v_expense_balance_full to authenticated;
grant select on public.v_expense_summary      to authenticated;

-- ponytail: plpgsql loop per report; if this becomes a hot path across
-- thousands of reports, move to a set-based window-function version.

do $$
declare
  v_i numeric;
begin
  -- pure sanity: no payouts, balance stays outstanding
  v_i := public.expense_interest_for(
    '00000000-0000-0000-0000-000000000000'::uuid, '__test__', 0, current_date, 0.2199);
  assert v_i = 0, 'expected 0 for zero principal';
end $$;
