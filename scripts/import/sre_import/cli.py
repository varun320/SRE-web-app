"""`sre-import` CLI.

Two subcommands — `balances` and `history` — share the same flags:

    --dry-run / --commit    mutually exclusive (--dry-run is the default)
    --actor-email EMAIL     required for --commit; attributes the import_batches row
    --json                  machine-readable plan output (used by the web route handler)

Exit codes:
    0  success (plan rendered, or commit applied)
    1  CLI usage / file / config error
    2  validation failure (bad CSV, bad workbook, unknown employee)
    3  refused to commit because plan has conflicts
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import click

from .apply import ImportConflictError, apply_plan
from .client import Client, SupabaseError
from .config import Settings
from .hash import file_sha256
from .parse.balances_csv import BalancesCsvError, parse_balances_csv
from .parse.workbook import WorkbookParseError, parse_workbook
from .plan import build_balances_plan, build_history_plan, plan_to_dict, summarize
from .schema import ImportPlan


@click.group()
@click.version_option()
def main() -> None:
    """Historical Excel importer for the SRE Timesheet app."""


@main.command()
@click.argument("csv_path", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--commit", "do_commit", is_flag=True, help="Apply the plan (default is dry-run).")
@click.option("--actor-email", help="Admin email to attribute the import to. Required with --commit.")
@click.option("--json", "as_json", is_flag=True, help="Emit plan as JSON on stdout.")
def balances(csv_path: Path, do_commit: bool, actor_email: str | None, as_json: bool) -> None:
    """Import opening TIL + vacation balances from a CSV."""
    try:
        rows = parse_balances_csv(csv_path)
    except BalancesCsvError as e:
        _fail(2, f"CSV parse error: {e}")

    with _client() as c:
        plan = build_balances_plan(rows, csv_path.name, file_sha256(csv_path), c)
        _emit(plan, as_json)

        if do_commit:
            _commit(plan, actor_email, c, as_json)


@main.command()
@click.argument("xlsx_path", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--employee-code", required=True, help="DB employee_code that owns this workbook.")
@click.option("--commit", "do_commit", is_flag=True, help="Apply the plan (default is dry-run).")
@click.option("--actor-email", help="Admin email to attribute the import to. Required with --commit.")
@click.option("--json", "as_json", is_flag=True, help="Emit plan as JSON on stdout.")
def history(
    xlsx_path: Path,
    employee_code: str,
    do_commit: bool,
    actor_email: str | None,
    as_json: bool,
) -> None:
    """Import one employee's historical week from an .xlsx workbook."""
    try:
        _, week = parse_workbook(xlsx_path)
    except WorkbookParseError as e:
        _fail(2, f"Workbook parse error: {e}")

    with _client() as c:
        plan = build_history_plan(
            employee_code, [week], xlsx_path.name, file_sha256(xlsx_path), c
        )
        _emit(plan, as_json)

        if do_commit:
            _commit(plan, actor_email, c, as_json)


# ---------------- shared helpers ----------------


def _client() -> Client:
    try:
        settings = Settings.from_env()
    except RuntimeError as e:
        _fail(1, str(e))
    return Client(settings=settings)


def _emit(plan: ImportPlan, as_json: bool) -> None:
    if as_json:
        click.echo(json.dumps(plan_to_dict(plan), default=str))
        return

    s = summarize(plan)
    click.echo(f"Mode:    {s['mode']}")
    click.echo(f"Source:  {s['source_filename']}")
    click.echo(
        f"Counts:  create={s['counts']['create']}  "
        f"skip={s['counts']['skip']}  conflict={s['counts']['conflict']}"
    )
    click.echo("-" * 72)
    click.echo(f"{'ACTION':10}  {'TARGET':38}  DETAIL / REASON")
    for it in plan.items:
        click.echo(f"{it.action:10}  {it.target:38}  {it.detail or it.reason}")


def _commit(
    plan: ImportPlan,
    actor_email: str | None,
    client: Client,
    as_json: bool,
) -> None:
    if not actor_email:
        _fail(1, "--commit requires --actor-email")

    actors = client.select("users", f"select=id,org_id&email=eq.{actor_email}&limit=1")
    if not actors:
        _fail(1, f"actor email not found in users: {actor_email!r}")
    actor = actors[0]

    try:
        result = apply_plan(
            plan,
            org_id=actor["org_id"],
            imported_by=actor["id"],
            client=client,
        )
    except ImportConflictError as e:
        _fail(3, str(e))
    except SupabaseError as e:
        _fail(1, f"Supabase error: {e}")

    if as_json:
        click.echo(json.dumps({"commit": result}, default=str))
    else:
        click.echo("-" * 72)
        click.echo(f"Committed: batch={result.get('batch_id')}")
        click.echo(f"           applied={result.get('applied')}  skipped={result.get('skipped')}")


def _fail(code: int, msg: str) -> None:
    click.echo(f"error: {msg}", err=True)
    sys.exit(code)


if __name__ == "__main__":
    main()
