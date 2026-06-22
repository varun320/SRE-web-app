"""Parse the opening-balances CSV."""

from __future__ import annotations

import csv
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

from pydantic import ValidationError

from ..schema import BalanceRow


REQUIRED_COLS = (
    "employee_code",
    "position",
    "til_opening_hrs",
    "vacation_opening_hrs",
    "as_of_date",
)


class BalancesCsvError(ValueError):
    """Raised when the CSV is malformed or invalid."""


def parse_balances_csv(path: Path) -> list[BalanceRow]:
    """Read and validate the balances CSV. Row numbers in errors are 1-based
    (header is row 1, first data row is row 2)."""
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = [c for c in REQUIRED_COLS if c not in (reader.fieldnames or [])]
        if missing:
            raise BalancesCsvError(
                f"Missing required column(s): {', '.join(missing)}. "
                f"Expected: {', '.join(REQUIRED_COLS)}"
            )

        rows: list[BalanceRow] = []
        for line_no, raw in enumerate(reader, start=2):
            try:
                rows.append(
                    BalanceRow(
                        employee_code=(raw["employee_code"] or "").strip(),
                        position=(raw["position"] or "").strip(),
                        til_opening_hrs=_decimal(raw["til_opening_hrs"]),
                        vacation_opening_hrs=_decimal(raw["vacation_opening_hrs"]),
                        as_of_date=_iso_date(raw["as_of_date"]),
                    )
                )
            except (ValidationError, BalancesCsvError) as e:
                raise BalancesCsvError(f"row {line_no}: {e}") from e

    if not rows:
        raise BalancesCsvError("CSV has no data rows")
    return rows


def _decimal(value: str) -> Decimal:
    if value is None or value.strip() == "":
        raise BalancesCsvError("empty numeric cell")
    try:
        return Decimal(value.strip())
    except InvalidOperation as e:
        raise BalancesCsvError(f"not a number: {value!r}") from e


def _iso_date(value: str) -> date:
    if value is None or value.strip() == "":
        raise BalancesCsvError("empty date cell")
    try:
        return date.fromisoformat(value.strip())
    except ValueError as e:
        raise BalancesCsvError(f"date must be ISO YYYY-MM-DD: {value!r}") from e
