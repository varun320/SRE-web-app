# sre-import — Historical Excel Importer

One-shot tool that brings legacy per-employee Excel workbooks into the SRE
Timesheet app's Supabase database.

## Install (uv)

```bash
cd scripts/import
uv venv
uv pip install -e ".[dev]"
```

Or with plain pip:

```bash
python -m venv .venv
.venv/Scripts/activate          # Windows
pip install -e ".[dev]"
```

## Environment

```bash
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_SERVICE_ROLE_KEY="<service role from `supabase status`>"
```

**Never commit the service role key.** It bypasses RLS.

## Usage

```bash
# Dry-run an opening-balances CSV (no DB writes)
sre-import balances tests/fixtures/balances_sample.csv --dry-run

# Commit it
sre-import balances tests/fixtures/balances_sample.csv --commit \
    --actor-email maaz@sulfurrecovery.com

# Dry-run one employee's history workbook
sre-import history path/to/employee.xlsx --employee-code E001 --dry-run
```

`--dry-run` parses + plans + prints a diff but writes nothing. `--commit` does
the same and then calls `apply_import_batch` to write inside one transaction.
Re-running with the same file is a no-op (idempotent via `(source_hash, mode)`
unique key on `import_batches`).

## Tests

```bash
pytest
```
