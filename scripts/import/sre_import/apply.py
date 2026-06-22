"""Persist an ImportPlan: write the batch row, then call the RPC."""

from __future__ import annotations

from typing import Any

from .client import Client
from .plan import has_conflicts, plan_to_dict, summarize
from .schema import ImportPlan


class ImportConflictError(RuntimeError):
    """Plan has unresolved conflicts — commit refused."""


def upsert_batch(
    plan: ImportPlan,
    *,
    org_id: str,
    imported_by: str,
    client: Client,
) -> str:
    """Insert an import_batches row (or return the existing one for this hash).

    Returns the batch_id. Idempotency key: (org_id, source_hash, mode).
    """
    existing = client.select(
        "import_batches",
        (
            f"select=id&org_id=eq.{org_id}"
            f"&source_hash=eq.{plan.source_hash}"
            f"&mode=eq.{plan.mode}"
        ),
    )
    if existing:
        return existing[0]["id"]

    rows = client.insert(
        "import_batches",
        [
            {
                "org_id": org_id,
                "imported_by": imported_by,
                "mode": plan.mode,
                "source_filename": plan.source_filename,
                "source_hash": plan.source_hash,
                "summary": summarize(plan),
                "plan_payload": plan.payload,
            }
        ],
    )
    return rows[0]["id"]


def apply_plan(
    plan: ImportPlan,
    *,
    org_id: str,
    imported_by: str,
    client: Client,
) -> dict[str, Any]:
    """Commit a plan via the apply_import_batch RPC. Refuses on conflicts."""
    if has_conflicts(plan):
        raise ImportConflictError(
            f"plan has {plan.counts['conflict']} conflict(s); resolve before commit"
        )
    batch_id = upsert_batch(
        plan, org_id=org_id, imported_by=imported_by, client=client
    )
    result = client.rpc("apply_import_batch", {"p_batch_id": batch_id})
    return {"batch_id": batch_id, **(result or {})}


__all__ = [
    "ImportConflictError",
    "upsert_batch",
    "apply_plan",
    "plan_to_dict",
]
