"""Parity tests for compute_totals — must match web/lib/totals.ts behavior."""

from decimal import Decimal

from sre_import.rules import SubCategoryRules, compute_totals
from sre_import.schema import WeekEntryRow


def _entry(sub: str, main: str = "Project", **hours) -> WeekEntryRow:
    base = {k: Decimal("0") for k in ("mon_hrs", "tue_hrs", "wed_hrs", "thu_hrs", "fri_hrs", "sat_hrs", "sun_hrs")}
    base.update({k: Decimal(str(v)) for k, v in hours.items()})
    return WeekEntryRow(
        main_category=main,  # type: ignore[arg-type]
        sub_category_name=sub,
        project_number=2026001 if main == "Project" else None,
        description="x",
        position=0,
        **base,
    )


RULES = {
    "Site Work":         SubCategoryRules("Site Work",        consumes_til=False, consumes_vacation=False),
    "Overtime Taken":    SubCategoryRules("Overtime Taken",   consumes_til=True,  consumes_vacation=False),
    "TIL Payout":        SubCategoryRules("TIL Payout",       consumes_til=True,  consumes_vacation=False),
    "Vacation Hours":    SubCategoryRules("Vacation Hours",   consumes_til=False, consumes_vacation=True),
}


def test_basic_40h_week_no_overtime():
    entries = [_entry("Site Work", mon_hrs=8, tue_hrs=8, wed_hrs=8, thu_hrs=8, fri_hrs=8)]
    t = compute_totals(entries, RULES)
    assert t.total_hrs == Decimal("40")
    assert t.overtime_earned == Decimal("0")
    assert t.til_used == Decimal("0")
    assert t.vacation_used == Decimal("0")


def test_overtime_per_day_over_8():
    entries = [_entry("Site Work", mon_hrs=10, tue_hrs=12)]  # 2 + 4 = 6 OT
    t = compute_totals(entries, RULES)
    assert t.overtime_earned == Decimal("6")


def test_til_payout_excluded_from_overtime_base():
    # TIL Payout 20h on Tue should NOT count toward Tue's daily base.
    # Site Work 8h Mon — no OT. TIL Payout 20h Tue — excluded.
    entries = [
        _entry("Site Work", mon_hrs=8),
        _entry("TIL Payout", main="Admin", tue_hrs=20),
    ]
    t = compute_totals(entries, RULES)
    assert t.overtime_earned == Decimal("0")
    assert t.til_used == Decimal("20")
    assert t.total_hrs == Decimal("28")


def test_consumes_vacation_increments_vacation_used():
    entries = [_entry("Vacation Hours", main="Admin", mon_hrs=8, tue_hrs=8)]
    t = compute_totals(entries, RULES)
    assert t.vacation_used == Decimal("16")


def test_unknown_sub_raises():
    entries = [_entry("Bogus", mon_hrs=4)]
    import pytest
    with pytest.raises(KeyError, match="unknown sub-category"):
        compute_totals(entries, RULES)
