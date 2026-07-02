-- Phase 1 / Task 2 — Balance & Interest and Summary views.
-- Ports the Excel Balance & Interest sheet's formulas: Net-30 grace, simple
-- daily interest at APR on unpaid principal, clock stops on the day the
-- invoice is fully paid.

-- Per-invoice payout aggregates + last payment date.
create or replace view public.v_expense_payout_agg as
  select
    user_id,
    invoice_no,
    coalesce(sum(amount_cad), 0)::numeric(14,2) as paid_to_date,
    max(payout_date)                            as last_payment_date
  from public.expense_payouts
  group by user_id, invoice_no;

-- Balance & Interest — one row per submitted (or later) expense report.
create or replace view public.v_expense_balance as
with s as (
  select
    r.id,
    r.user_id,
    r.org_id,
    r.invoice_no,
    r.submission_date,
    r.total_cad                                 as claimed,
    (public.expense_settings_for(r.user_id)).apr        as apr,
    (public.expense_settings_for(r.user_id)).grace_days as grace_days,
    coalesce(p.paid_to_date, 0)::numeric(14,2)  as paid,
    p.last_payment_date,
    r.status                                    as report_status,
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
    else greatest(
           (case
              when s.last_payment_date is not null
                   and s.paid >= s.claimed
              then s.last_payment_date
              else current_date
            end)
           - (s.submission_date + s.grace_days),
           0)
  end::int as days_overdue,
  round(
    greatest(s.claimed - s.paid, 0)
    * (
        case
          when s.claimed - s.paid <= 0 then 0
          else greatest(
                 (case
                    when s.last_payment_date is not null
                         and s.paid >= s.claimed
                    then s.last_payment_date
                    else current_date
                  end)
                 - (s.submission_date + s.grace_days),
                 0)
        end
      )::numeric
    / 365.0
    * s.apr,
    2)::numeric(14,2) as interest_owing,
  s.report_status,
  s.locked
from s;

-- Total-owing column and derived status flag ("Paid" / "Interest Owing" /
-- "Outstanding" / "Overdue").
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

-- Summary tiles — matches Summary sheet totals.
create or replace view public.v_expense_summary as
select
  u.id                                             as user_id,
  u.org_id,
  coalesce(sum(b.claimed), 0)::numeric(14,2)       as total_submitted,
  coalesce(sum(b.paid), 0)::numeric(14,2)          as total_received,
  coalesce(sum(b.outstanding), 0)::numeric(14,2)   as outstanding_principal,
  coalesce(sum(b.interest_owing), 0)::numeric(14,2) as interest_accrued,
  coalesce(sum(b.total_owing), 0)::numeric(14,2)   as total_owing
from public.users u
left join public.v_expense_balance_full b on b.user_id = u.id
group by u.id, u.org_id;

grant select on public.v_expense_balance      to authenticated;
grant select on public.v_expense_balance_full to authenticated;
grant select on public.v_expense_summary      to authenticated;
grant select on public.v_expense_payout_agg   to authenticated;
