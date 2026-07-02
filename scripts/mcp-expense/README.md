# sre-expense-mcp

Model Context Protocol (MCP) server that exposes the SRE expense tracker to
Claude Code / Claude Desktop. All calls go through the same RLS-guarded
Supabase RPCs the web app uses — the server has **no** elevated privilege
beyond the individual user's access token.

## Security model — each user only sees their own expenses

Isolation is enforced by PostgreSQL, not by the MCP server. Three layers:

1. **RLS** on `expense_reports`, `expense_payouts`, `expense_approval_log`.
   Every `select` is silently rewritten to `where user_id = auth.uid()`
   (admins additionally see their whole org). `auth.uid()` comes from the
   JWT in the request — impossible to spoof from the client.
2. **RPC ownership checks** — `expense_submit`, `expense_upsert_draft`,
   etc. re-verify `user_id = auth.uid()` and raise `not owner` (SQLSTATE
   42501) if the check fails.
3. **Admin gating in the MCP** — `approve_expense`, `decline_expense`,
   `unlock_expense`, `record_payout` are only registered with the MCP
   server if `is_admin(auth.uid())` returns true at startup. An
   employee's MCP process never advertises those tools.

Net result: a compromised token can never reach another user's data. It
can only do what that user could do in the web app.

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

## Where to get each credential

| Env var                   | What it is                     | Where to get it |
| ------------------------- | ------------------------------ | --------------- |
| `SRE_SUPABASE_URL`        | Project REST URL               | https://sre-web-app.vercel.app is fronted by `https://cilptmbwyshcjvbruaqd.supabase.co`. Also in the Vercel dashboard → SRE-app → Settings → Environment Variables → `NEXT_PUBLIC_SUPABASE_URL`. |
| `SRE_SUPABASE_ANON_KEY`   | Public anon key (safe to embed) | Same env-vars page → `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Or Supabase dashboard → Project Settings → API → `anon public`. |
| `SRE_ACCESS_TOKEN`        | **Your** signed-in JWT — impersonates you and only you | See below. Rotates on sign-out; treat like a password. |
| `SRE_REFRESH_TOKEN`       | Optional. Lets the server refresh when the access token expires (~1 h) | Same cookie as above. |

### How to grab `SRE_ACCESS_TOKEN` from the web app

1. Sign in at https://sre-web-app.vercel.app with your normal credentials.
2. Open DevTools → **Application** → **Cookies** → `https://sre-web-app.vercel.app`.
3. Find the cookie starting with `sb-cilptmbwyshcjvbruaqd-auth-token`. It
   holds a URL-encoded JSON blob.
4. Copy the value, `decodeURIComponent()` it, `JSON.parse` it — the
   resulting object has `access_token` and `refresh_token` fields.

   One-liner in the DevTools **Console** while you're on the app:
   ```js
   copy(
     (() => {
       const raw = document.cookie
         .split('; ')
         .find((c) => c.startsWith('sb-cilptmbwyshcjvbruaqd-auth-token'))
         ?.split('=')[1];
       return JSON.parse(decodeURIComponent(raw));
     })()
   );
   ```
   That copies the whole session object; paste it somewhere temporary and
   use its `access_token` + `refresh_token`.
5. Never paste these into a shared config file. Prefer environment
   variables or an OS keychain.

**When the token expires** (default: 1 hour), the MCP will start returning
`JWT expired` errors. Either restart the MCP with a fresh token, or supply
`SRE_REFRESH_TOKEN` too — the server calls `setSession` and will refresh
automatically.

## Setup

```bash
cd scripts/mcp-expense
npm install
npm run build
```

## Wire it into Claude Code

Add to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "sre-expense": {
      "command": "node",
      "args": ["D:\\projects\\prodigy-ai\\projects\\SRE-app\\scripts\\mcp-expense\\dist\\index.js"],
      "env": {
        "SRE_SUPABASE_URL":      "https://cilptmbwyshcjvbruaqd.supabase.co",
        "SRE_SUPABASE_ANON_KEY": "eyJhbGciOi…anon…",
        "SRE_ACCESS_TOKEN":      "eyJhbGciOi…your JWT…",
        "SRE_REFRESH_TOKEN":     "…optional…"
      }
    }
  }
}
```

Or use the CLI:

```bash
claude mcp add sre-expense \
  --command node \
  --args "D:\\projects\\prodigy-ai\\projects\\SRE-app\\scripts\\mcp-expense\\dist\\index.js" \
  --env "SRE_SUPABASE_URL=https://cilptmbwyshcjvbruaqd.supabase.co" \
  --env "SRE_SUPABASE_ANON_KEY=…" \
  --env "SRE_ACCESS_TOKEN=…"
```

Restart Claude Code. On startup you'll see (in stderr):

```
sre-expense-mcp connected as you@sulfurrecovery.com (employee); 6 tools available.
```

Then ask things like:

- *"list my open expense reports"*
- *"draft an expense report UC2026005 for 2026-04-01 to 2026-04-30 for $6,500 CAD + $325 GST"*
- *"what's my current balance and interest owing?"*
- *"submit UC2026005"*

Admin users get 10 tools and can also say:

- *"approve UC2026005 for user \<uuid\>"*
- *"record a payout of $5,000 CAD on 2026-05-10 against UC2026001"*

## Web (claude.ai) support

Not yet — claude.ai only accepts **remote** MCP connectors (HTTP+SSE with
OAuth), not local stdio processes. If we want claude.ai support later, the
same `src/tools.ts` handlers can be re-hosted behind an SSE transport with
Supabase-Google OAuth in front. Ask before starting; it's ~a day of work.
