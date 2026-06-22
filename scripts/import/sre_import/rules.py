"""Per-week totals math, ported from web/lib/totals.ts.

Keep behavior identical to the TypeScript version so the import RPC produces
the same `overtime_earned` / `til_used` / `vacation_used` values that
`approve_timesheet` would compute live. Test parity by comparing fixtures.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable

from .schema import WeekEntryRow


# Match DAY_KEYS in web/lib/dates.ts
DAY_FIELDS: tuple[str, ...] = (
    "mon_hrs", "tue_hrs", "wed_hrs", "thu_hrs", "fri_hrs", "sat_hrs", "sun_hrs",
)

# Hours per workday before overtime kicks in.
REGULAR_HOURS_PER_DAY = Decimal("8")

# Sub-categories that do not count toward the daily base from which overtime
# is calculated. Mirrors the `sub?.name !== 'TIL Payout'` exception in totals.ts.
NON_BASE_SUBS: frozenset[str] = frozenset({"TIL Payout"})


@dataclass(frozen=True)
class SubCategoryRules:
    """Just the fields totals math needs — name + ledger-consumption flags."""

    name: str
    consumes_til: bool
    consumes_vacation: bool


@dataclass(frozen=True)
class WeekTotals:
    total_hrs: Decimal
    overtime_earned: Decimal
    til_used: Decimal
    vacation_used: Decimal


def compute_totals(
    entries: Iterable[WeekEntryRow],
    sub_rules: dict[str, SubCategoryRules],
) -> WeekTotals:
    """Replicate computeTotals from web/lib/totals.ts.

    `sub_rules` is keyed by sub-category NAME (the workbook gives us names,
    not ids). Unknown names raise — the planner should pre-validate.
    """
    total_hrs = Decimal("0")
    til_used = Decimal("0")
    vacation_used = Decimal("0")
    day_base: dict[str, Decimal] = {k: Decimal("0") for k in DAY_FIELDS}

    for row in entries:
        rule = sub_rules.get(row.sub_category_name)
        if rule is None:
            raise KeyError(
                f"unknown sub-category {row.sub_category_name!r}; "
                "planner must resolve all names before calling compute_totals"
            )

        row_total = sum((getattr(row, k) for k in DAY_FIELDS), Decimal("0"))
        total_hrs += row_total
        if rule.consumes_til:
            til_used += row_total
        if rule.consumes_vacation:
            vacation_used += row_total

        if rule.name not in NON_BASE_SUBS:
            for k in DAY_FIELDS:
                day_base[k] += getattr(row, k)

    overtime_earned = sum(
        (max(Decimal("0"), day_base[k] - REGULAR_HOURS_PER_DAY) for k in DAY_FIELDS),
        Decimal("0"),
    )

    return WeekTotals(
        total_hrs=total_hrs,
        overtime_earned=overtime_earned,
        til_used=til_used,
        vacation_used=vacation_used,
    )
