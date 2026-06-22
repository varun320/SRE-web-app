"""Build an ImportPlan from parsed input + current DB state."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Iterable

from .client import Client
from .rules import SubCategoryRules, compute_totals
from .schema import BalanceRow, ImportPlan, PlanItem, WeekRow


def build_balances_plan(
    rows: list[BalanceRow],
    source_filename: str,
    source_hash: str,
    client: Client,
) -> ImportPlan:
    """Resolve each CSV row against the users + ledger tables.

    Each balance row produces ONE plan item (create | skip | conflict). The
    RPC creates two ledger rows per accepted item (TIL + vacation) — those
    are not listed individually here; the per-row counts are returned by
    apply_import_batch as `applied / 2`.
    """
    items: list[PlanItem] = []
    payload_rows: list[dict] = []

    # Pre-fetch all users referenced by the CSV in one round-trip.
    codes = sorted({r.employee_code for r in rows})
    codes_csv = ",".join(f'"{c}"' for c in codes)
    user_lookup: dict[str, str] = {}
    if codes:
        existing = client.select(
            "users",
            f"select=id,employee_code&employee_code=in.({codes_csv})",
        )
        user_lookup = {u["employee_code"]: u["id"] for u in existing}

    for r in rows:
        user_id = user_lookup.get(r.employee_code)
        target = f"{r.employee_code} / as_of {r.as_of_date.isoformat()}"

        if not user_id:
            items.append(
                PlanItem(
                    action="conflict",
                    target=target,
                    reason=f"unknown employee_code {r.employee_code!r}",
                )
            )
            continue

        synthetic_week = (r.as_of_date - timedelta(days=7)).isoformat()

        # Skip if either ledger already has a row at/before the synthetic week.
        existing_til = client.select(
            "til_ledger",
            f"select=week_start&user_id=eq.{user_id}&week_start=eq.{synthetic_week}",
        )
        existing_vac = client.select(
            "vacation_ledger",
            f"select=week_start&user_id=eq.{user_id}&week_start=eq.{synthetic_week}",
        )
        if existing_til or existing_vac:
            items.append(
                PlanItem(
                    action="skip",
                    target=target,
                    reason="opening ledger row already exists",
                )
            )
            continue

        items.append(
            PlanItem(
                action="create",
                target=target,
                detail=(
                    f"TIL {r.til_opening_hrs}h, "
                    f"vacation {r.vacation_opening_hrs}h "
                    f"at {synthetic_week}"
                ),
            )
        )
        payload_rows.append(
            {
                "user_id": user_id,
                "as_of_date": r.as_of_date.isoformat(),
                "til_opening": _decimal_str(r.til_opening_hrs),
                "vacation_opening": _decimal_str(r.vacation_opening_hrs),
            }
        )

    return ImportPlan(
        mode="balances",
        source_filename=source_filename,
        source_hash=source_hash,
        items=items,
        payload={"rows": payload_rows},
    )


def _decimal_str(d: Decimal) -> str:
    """Render Decimal as a plain string the RPC's JSON parser can re-cast."""
    return format(d.normalize(), "f")


def build_history_plan(
    employee_code: str,
    weeks: list[WeekRow],
    source_filename: str,
    source_hash: str,
    client: Client,
) -> ImportPlan:
    """Resolve workbook weeks against users/projects/sub_categories and replay
    ledger balances chronologically.

    One file = one employee = potentially many weeks (the workbook template
    holds one, but the CLI calls this with all parsed weeks merged together).

    Per-week plan items:
        - conflict: unknown employee, unknown sub-category, unknown project,
          OR a non-imported timesheet already exists for that week.
        - skip: a timesheet with the same week_start already exists AND was
          previously imported (idempotent re-run).
        - create: brand new week.
    """
    items: list[PlanItem] = []
    payload_weeks: list[dict] = []

    # --- Resolve user ---
    users = client.select(
        "users",
        f"select=id,org_id&employee_code=eq.{employee_code}&limit=1",
    )
    if not users:
        for w in weeks:
            items.append(
                PlanItem(
                    action="conflict",
                    target=f"{employee_code} / {w.week_start.isoformat()}",
                    reason=f"unknown employee_code {employee_code!r}",
                )
            )
        return ImportPlan(
            mode="history",
            source_filename=source_filename,
            source_hash=source_hash,
            items=items,
            payload={"weeks": []},
        )
    user_id = users[0]["id"]

    # --- Lookup tables (one round-trip each) ---
    sub_rows = client.select(
        "sub_categories",
        "select=id,name,main_category,requires_project,consumes_til,consumes_vacation&is_active=eq.true",
    )
    sub_by_name: dict[str, dict] = {s["name"]: s for s in sub_rows}
    sub_rules: dict[str, SubCategoryRules] = {
        s["name"]: SubCategoryRules(
            name=s["name"],
            consumes_til=bool(s["consumes_til"]),
            consumes_vacation=bool(s["consumes_vacation"]),
        )
        for s in sub_rows
    }

    needed_project_nums = sorted(
        {e.project_number for w in weeks for e in w.entries if e.project_number is not None}
    )
    project_by_num: dict[int, str] = {}
    if needed_project_nums:
        nums_csv = ",".join(str(n) for n in needed_project_nums)
        proj_rows = client.select(
            "projects",
            f"select=id,project_number&project_number=in.({nums_csv})",
        )
        project_by_num = {p["project_number"]: p["id"] for p in proj_rows}

    # --- Existing timesheets (idempotency / conflict detection) ---
    week_starts = sorted({w.week_start.isoformat() for w in weeks})
    if week_starts:
        ws_csv = ",".join(week_starts)
        existing_ts = client.select(
            "timesheets",
            f"select=week_start,status&user_id=eq.{user_id}&week_start=in.({ws_csv})",
        )
    else:
        existing_ts = []
    existing_by_week: dict[str, str] = {t["week_start"]: t["status"] for t in existing_ts}

    # --- Initial opening balances (carry forward from any prior frozen ledger) ---
    earliest = weeks[0].week_start.isoformat() if weeks else None
    opening_til = _prior_balance(client, "til_ledger", user_id, earliest)
    opening_vac = _prior_balance(client, "vacation_ledger", user_id, earliest)

    # --- Walk weeks chronologically ---
    for w in sorted(weeks, key=lambda x: x.week_start):
        target = f"{employee_code} / {w.week_start.isoformat()}"

        if w.week_start.isoformat() in existing_by_week:
            items.append(
                PlanItem(
                    action="skip",
                    target=target,
                    reason=f"timesheet already exists (status={existing_by_week[w.week_start.isoformat()]})",
                )
            )
            continue

        # Validate all entry references first; collect conflicts for the whole week.
        entry_payload: list[dict] = []
        week_conflicts: list[str] = []
        for e in w.entries:
            sub_row = sub_by_name.get(e.sub_category_name)
            if sub_row is None:
                week_conflicts.append(f"unknown sub-category {e.sub_category_name!r}")
                continue
            project_id: str | None = None
            if e.project_number is not None:
                project_id = project_by_num.get(e.project_number)
                if project_id is None:
                    week_conflicts.append(f"unknown project_number {e.project_number}")
                    continue
            entry_payload.append(
                {
                    "main_category": e.main_category,
                    "sub_category_id": sub_row["id"],
                    "project_id": project_id,
                    "mon_hrs": _decimal_str(e.mon_hrs),
                    "tue_hrs": _decimal_str(e.tue_hrs),
                    "wed_hrs": _decimal_str(e.wed_hrs),
                    "thu_hrs": _decimal_str(e.thu_hrs),
                    "fri_hrs": _decimal_str(e.fri_hrs),
                    "sat_hrs": _decimal_str(e.sat_hrs),
                    "sun_hrs": _decimal_str(e.sun_hrs),
                    "description": e.description,
                    "position": e.position,
                }
            )

        if week_conflicts:
            items.append(
                PlanItem(
                    action="conflict",
                    target=target,
                    reason="; ".join(week_conflicts),
                )
            )
            continue

        totals = compute_totals(w.entries, sub_rules)

        items.append(
            PlanItem(
                action="create",
                target=target,
                detail=(
                    f"{len(entry_payload)} entries, "
                    f"total {totals.total_hrs}h, "
                    f"OT {totals.overtime_earned}h"
                ),
            )
        )
        payload_weeks.append(
            {
                "user_id": user_id,
                "week_start": w.week_start.isoformat(),
                "opening_til": _decimal_str(opening_til),
                "opening_vacation": _decimal_str(opening_vac),
                "til_earned": _decimal_str(totals.overtime_earned),
                "til_used": _decimal_str(totals.til_used),
                "vacation_used": _decimal_str(totals.vacation_used),
                "entries": entry_payload,
            }
        )

        # Project next week's opening (closing of this one).
        opening_til = opening_til + totals.overtime_earned - totals.til_used
        opening_vac = opening_vac - totals.vacation_used

    return ImportPlan(
        mode="history",
        source_filename=source_filename,
        source_hash=source_hash,
        items=items,
        payload={"weeks": payload_weeks},
    )


def _prior_balance(client: Client, table: str, user_id: str, before_iso: str | None) -> Decimal:
    """Most-recent closing_balance for user, strictly before `before_iso`. Zero if none."""
    if not before_iso:
        return Decimal("0")
    rows = client.select(
        table,
        (
            f"select=closing_balance&user_id=eq.{user_id}"
            f"&week_start=lt.{before_iso}&stale=eq.false"
            f"&order=week_start.desc&limit=1"
        ),
    )
    if not rows:
        return Decimal("0")
    val = rows[0].get("closing_balance")
    return Decimal(str(val)) if val is not None else Decimal("0")


def has_conflicts(plan: ImportPlan) -> bool:
    return any(it.action == "conflict" for it in plan.items)


def summarize(plan: ImportPlan) -> dict:
    """Compact summary safe to embed in import_batches.summary."""
    counts = plan.counts
    warnings: list[str] = [it.reason for it in plan.items if it.action == "conflict" and it.reason]
    return {
        "mode": plan.mode,
        "source_filename": plan.source_filename,
        "counts": counts,
        "warnings": warnings[:20],
        "total": len(plan.items),
    }


def plan_to_dict(plan: ImportPlan) -> dict:
    return {
        "mode": plan.mode,
        "source_filename": plan.source_filename,
        "source_hash": plan.source_hash,
        "items": [it.model_dump() for it in plan.items],
        "payload": plan.payload,
        "summary": summarize(plan),
    }


__all__ = [
    "build_balances_plan",
    "build_history_plan",
    "has_conflicts",
    "summarize",
    "plan_to_dict",
]


# Silence unused import warning for type hints
_ = Iterable
