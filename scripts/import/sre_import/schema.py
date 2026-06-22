"""Pydantic models for parsed input and planned writes."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field, field_validator

MainCategory = Literal["Project", "Admin", "Office & Sales"]
PlanAction = Literal["create", "skip", "conflict"]
ImportMode = Literal["balances", "history"]


class BalanceRow(BaseModel):
    """One row of the opening-balances CSV."""

    employee_code: str = Field(min_length=1)
    position: str = Field(min_length=1)
    til_opening_hrs: Decimal = Field(ge=0)
    vacation_opening_hrs: Decimal = Field(ge=0)
    as_of_date: date


class WeekEntryRow(BaseModel):
    """One row inside a weekly timesheet block from the workbook."""

    main_category: MainCategory
    sub_category_name: str
    project_number: int | None = None
    mon_hrs: Decimal = Field(default=Decimal("0"), ge=0)
    tue_hrs: Decimal = Field(default=Decimal("0"), ge=0)
    wed_hrs: Decimal = Field(default=Decimal("0"), ge=0)
    thu_hrs: Decimal = Field(default=Decimal("0"), ge=0)
    fri_hrs: Decimal = Field(default=Decimal("0"), ge=0)
    sat_hrs: Decimal = Field(default=Decimal("0"), ge=0)
    sun_hrs: Decimal = Field(default=Decimal("0"), ge=0)
    description: str = Field(min_length=1)
    position: int = 0


class WeekRow(BaseModel):
    """A full week's worth of entries pulled from one workbook."""

    week_start: date
    entries: list[WeekEntryRow]

    @field_validator("week_start")
    @classmethod
    def must_be_monday(cls, v: date) -> date:
        if v.weekday() != 0:
            raise ValueError(f"week_start {v.isoformat()} is not a Monday")
        return v


class PlanItem(BaseModel):
    """One planned change in the import plan."""

    action: PlanAction
    target: str  # human-readable target (e.g. "E001 / 2026-01-05")
    detail: str = ""
    reason: str = ""


class ImportPlan(BaseModel):
    """A dry-run plan, ready for the UI to render or the RPC to apply."""

    mode: ImportMode
    source_filename: str
    source_hash: str
    items: list[PlanItem]
    payload: dict  # RPC-ready payload (matches apply_import_batch shape)

    @property
    def counts(self) -> dict[str, int]:
        c: dict[str, int] = {"create": 0, "skip": 0, "conflict": 0}
        for it in self.items:
            c[it.action] += 1
        return c
