from decimal import Decimal
from datetime import date
from pathlib import Path

import pytest

from sre_import.parse.balances_csv import parse_balances_csv, BalancesCsvError

FIXTURE = Path(__file__).parent / "fixtures" / "balances_sample.csv"


def test_parses_valid_csv():
    rows = parse_balances_csv(FIXTURE)
    assert len(rows) == 2
    assert rows[0].employee_code == "E001"
    assert rows[0].til_opening_hrs == Decimal("40.00")
    assert rows[0].vacation_opening_hrs == Decimal("200.00")
    assert rows[0].as_of_date == date(2026, 1, 5)


def test_missing_column(tmp_path):
    bad = tmp_path / "missing_col.csv"
    bad.write_text("employee_code,position\nE001,Engineer\n", encoding="utf-8")
    with pytest.raises(BalancesCsvError, match="Missing required column"):
        parse_balances_csv(bad)


def test_negative_hours_rejected(tmp_path):
    bad = tmp_path / "neg.csv"
    bad.write_text(
        "employee_code,position,til_opening_hrs,vacation_opening_hrs,as_of_date\n"
        "E001,Engineer,-1,200,2026-01-05\n",
        encoding="utf-8",
    )
    with pytest.raises(BalancesCsvError, match="row 2"):
        parse_balances_csv(bad)


def test_bad_date_rejected(tmp_path):
    bad = tmp_path / "baddate.csv"
    bad.write_text(
        "employee_code,position,til_opening_hrs,vacation_opening_hrs,as_of_date\n"
        "E001,Engineer,40,200,01/05/2026\n",
        encoding="utf-8",
    )
    with pytest.raises(BalancesCsvError, match="ISO"):
        parse_balances_csv(bad)


def test_empty_csv_rejected(tmp_path):
    bad = tmp_path / "empty.csv"
    bad.write_text(
        "employee_code,position,til_opening_hrs,vacation_opening_hrs,as_of_date\n",
        encoding="utf-8",
    )
    with pytest.raises(BalancesCsvError, match="no data rows"):
        parse_balances_csv(bad)
