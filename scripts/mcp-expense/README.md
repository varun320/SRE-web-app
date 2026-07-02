# sre-expense-mcp

Model Context Protocol (MCP) server that exposes the SRE expense tracker
to a Claude Code / Claude Desktop instance. All calls go through the same
RLS-guarded Supabase RPCs the web app uses — the server has **no** elevated
privilege beyond the user's own access token.

## Available tools

Employee (always available):

- `list_expenses(status?, from?, to?)` — signed-in user's reports, newest first
- `get_expense(invoice_no)` — one report + balance + payouts
- `upsert_expense_draft({invoice_no, period_from, period_to, amount_cad, gst_cad?, notes?})`
- `submit_expense(invoice_no)`
- `list_payouts(invoice_no?)`
- `get_balance_summary()` — matches the Summary tab of the Excel template

Admin (only exposed if the token belongs to an admin user):

- `approve_expense({user_id, invoice_no})`
- `decline_expense({user_id, invoice_no, reason})`
- `unlock_expense({user_id, invoice_no, reason})`
- `record_payout({user_id, invoice_no, payout_date, amount_cad, reference?, notes?})`

## Setup

```bash
cd scripts/mcp-expense
npm install
npm run build
```

Environment variables:

| Var                       | Notes                                             |
| ------------------------- | ------------------------------------------------- |
| `SRE_SUPABASE_URL`        | Same as `NEXT_PUBLIC_SUPABASE_URL` in the web app |
| `SRE_SUPABASE_ANON_KEY`   | Same as `NEXT_PUBLIC_SUPABASE_ANON_KEY`           |
| `SRE_ACCESS_TOKEN`        | JWT for the user (via `supabase auth`, or grab from the browser session) |
| `SRE_REFRESH_TOKEN`       | Optional — needed for long-running sessions       |

## Wire it into Claude Code

Add to your `~/.claude.json` (or the project-local `.mcp.json`):

```json
{
  "mcpServers": {
    "sre-expense": {
      "command": "node",
      "args": ["D:\\projects\\prodigy-ai\\projects\\SRE-app\\scripts\\mcp-expense\\dist\\index.js"],
      "env": {
        "SRE_SUPABASE_URL": "https://<project>.supabase.co",
        "SRE_SUPABASE_ANON_KEY": "eyJ…",
        "SRE_ACCESS_TOKEN": "eyJ…"
      }
    }
  }
}
```

Restart Claude and ask something like *"list my open expense reports"* or
*"draft an expense report for UC2026005 covering 2026-04-01 to 2026-04-30
for $6,500 CAD + $325 GST"*.
