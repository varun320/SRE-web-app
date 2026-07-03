# Remote MCP Server for SRE Expense Tracker — Design (2026-07-03)

## Goal

Make the existing expense-tracker MCP tool set reachable from **claude.ai on the
web** and the **Claude mobile apps** (iOS/Android) via
Settings → Connectors → Add custom connector. Today only Claude Desktop (which
supports stdio MCP) can use `scripts/mcp-expense/`.

## Non-goals

- No new business logic. Everything routes through the same Supabase RPCs +
  views used by the web app and stdio MCP.
- No new auth database. Supabase Auth remains the identity provider.
- No separate service. The endpoint ships in the existing `web/` Next.js
  deployment on Vercel.

## Constraints (from the kickoff)

1. Reuse `scripts/mcp-expense/src/tools.ts` handlers verbatim — only transport
   changes.
2. Reuse `web/lib/expenses/*` queries/mutations/RPCs.
3. Bind `auth.uid()` **per request** using a Supabase JWT — not a startup token.
4. Preserve isolation: RLS + `adminOnly` gating stay identical.
5. Host under `https://sre-web-app.vercel.app/mcp` (same Vercel project).
6. Ship phase-wise with tests per phase.

## Transport choice

Claude custom connectors accept two remote MCP transports:

| Transport                | Status              | Suits us? |
|--------------------------|---------------------|-----------|
| Legacy SSE (2024-11-05)  | deprecated but live | fallback  |
| Streamable HTTP (2025-03-26) | current spec    | **primary** |

We ship **Streamable HTTP** as the primary transport (single `POST /mcp`
returning JSON or `text/event-stream`) with a `GET /mcp/sse` legacy alias for
clients still stuck on the old transport.

Implementation uses `@vercel/mcp-adapter`, which:
- exposes both transports from one Next.js route
- handles JSON-RPC framing, `initialize`, `tools/list`, `tools/call`
- lets us register tools with a Zod input schema (identical shape to the SDK's
  `Server.setRequestHandler` API we already use)

## Auth model

**Claude connector → Supabase JWT bearer → RLS.**

Claude custom connectors implement OAuth 2.1 Dynamic Client Registration and
attach `Authorization: Bearer <access_token>` to every MCP request. We accept
that JWT and let Supabase verify it.

Per-request flow inside the route handler:

```
1. Read Authorization header → token
2. sb = createClient(url, anon, { global.headers.Authorization: Bearer token })
3. { data: { user } } = await sb.auth.getUser()   ← verifies JWT via Supabase
4. admin = await isAdmin(sb, user.id)             ← same helper as stdio
5. Build tool list (filter adminOnly if !admin)
6. Dispatch tools/call — each handler receives `sb` bound to that JWT, so RLS
   sees the correct auth.uid()
```

This mirrors `scripts/mcp-expense/src/client.ts` but skips `setSession()` —
we don't need to persist anything, we just want the Authorization header on
every REST/RPC call so `auth.uid()` resolves.

### How Claude gets a Supabase JWT

Two supported paths:

**Path A — OAuth 2.1 authorization server (production)**

Add a minimal OAuth AS to the web app that federates to Supabase's hosted
`/authorize` + `/token` endpoints:

- `GET  /.well-known/oauth-authorization-server` — advertises AS metadata
- `GET  /.well-known/oauth-protected-resource` — advertises the MCP resource
- `POST /oauth/register` — Dynamic Client Registration (returns a static
  client_id/secret pair — we accept any registration since Supabase actually
  authenticates the end user)
- `GET  /oauth/authorize` — redirects the user's browser to the Supabase
  hosted login (magic link / password) with a proxied `redirect_uri`
- `POST /oauth/token` — exchanges the code for a Supabase session and returns
  `{ access_token, refresh_token, expires_in }` shaped for MCP clients

Adapted from vercel/mcp-adapter's `@vercel/mcp-adapter/auth` helpers.

**Path B — Static bearer token (phase 1, dev-only)**

The user signs in at `https://sre-web-app.vercel.app/mcp/token`, we mint a
Supabase access token (via `sb.auth.getSession()` on the server) and show it in
the UI. They paste it into the Claude connector as a static header. Simple,
avoids OAuth plumbing, matches the current stdio UX.

**We ship Path B in phase 1 to prove transport + tool wiring, then add Path A
in phase 3 for real users.**

## Isolation guarantees

Identical to today's stdio server:

- All reads/writes go through the RLS-guarded views + `SECURITY DEFINER` RPCs.
- The Supabase client for a given request is instantiated with the caller's
  JWT — never with the service-role key.
- `adminOnly` tools are filtered out of `tools/list` when
  `isAdmin(sb, user.id) === false`. This is defense in depth: even if a
  non-admin invoked one directly, the underlying RPC still rejects them.

Nothing on the wire ever carries a bearer that isn't the caller's own Supabase
JWT.

## Code layout

Shared handlers move into the web package so both transports import from the
same place. The stdio server continues to work because tool code has no
Next-specific deps (just `@supabase/supabase-js` + `zod`).

```
web/
  lib/expenses/
    mcp/
      tools.ts           ← moved from scripts/mcp-expense/src/tools.ts
      zod-to-json.ts     ← moved
      registry.ts        ← array of { name, description, input, adminOnly, handler }
                            (extracted from scripts/mcp-expense/src/index.ts)
      auth.ts            ← bearerToSupabaseClient(headers) → SupabaseClient + user + isAdmin
  app/
    mcp/
      route.ts           ← Streamable HTTP transport (POST /mcp)
      sse/route.ts       ← Legacy SSE alias (GET /mcp/sse)
      token/page.tsx     ← Phase 1: show the user their JWT for pasting

scripts/mcp-expense/
  src/
    index.ts             ← imports registry from '../../web/lib/expenses/mcp/registry'
    client.ts            ← unchanged (stdio still uses env-var token)
    tools.ts             ← DELETED (re-exports from web/lib/expenses/mcp/tools)
    zod-to-json.ts       ← DELETED
    e2e.test.ts          ← unchanged
```

Cross-package import from `scripts/mcp-expense` into `web/lib/expenses/mcp/`
works because the tool code has zero Next.js dependencies. `scripts/mcp-expense`
already has its own `tsconfig.json`; we add
`"paths": { "@expense/mcp/*": ["../../web/lib/expenses/mcp/*"] }` and a
relative import.

## Data & error shape

Every tool response stays exactly what it is today — the handler returns a JS
object, the transport JSON-stringifies it into a text content block:

```json
{ "content": [{ "type": "text", "text": "<JSON string>" }] }
```

Errors set `isError: true` and put the message in a text block. This is what
`scripts/mcp-expense/src/e2e.test.ts` already asserts against; the same helper
functions work for the new transport.

## Phases

### Phase 1 — Move handlers to `web/lib/expenses/mcp/` (no behavior change)

- Move `tools.ts`, `zod-to-json.ts` into `web/lib/expenses/mcp/`.
- Add `registry.ts` that returns the `ToolDef[]` array (extracted from
  `scripts/mcp-expense/src/index.ts`), keyed off a `SupabaseClient` +
  `userId` closure.
- Update `scripts/mcp-expense/src/index.ts` to import registry from the new
  location.
- Existing stdio e2e (`scripts/mcp-expense/src/e2e.test.ts`) MUST pass
  unchanged — this is the regression fence.

### Phase 2 — Ship Streamable HTTP MCP at `POST /mcp` with bearer auth

- Add `@vercel/mcp-adapter` (or hand-roll with `Server` from
  `@modelcontextprotocol/sdk`) at `web/app/mcp/route.ts`.
- Read `Authorization: Bearer <supabase-jwt>` from the request headers on every
  call; build the Supabase client via that JWT; look up user + admin; register
  the filtered tool list.
- Add `web/app/mcp/token/page.tsx` — signed-in users see their current Supabase
  access token + copy-to-clipboard, plus setup instructions for Claude.
- Add `web/app/mcp/route.test.ts` — Vitest test that hits `POST /mcp`
  directly (via Next's test route runner or by invoking the route handler
  function) with a signed-in user's JWT and asserts:
  - `tools/list` returns exactly the 10 tool names for the admin dev user
  - `tools/call list_expenses` returns an array
  - `upsert_expense_draft` is idempotent by `invoice_no` (mirrors stdio e2e)
  - a call with no Authorization header returns 401
  - a call with an invalid JWT returns 401

### Phase 3 — Add OAuth 2.1 authorization server (real Claude connector UX)

- `web/app/.well-known/oauth-authorization-server/route.ts`
- `web/app/.well-known/oauth-protected-resource/route.ts`
- `web/app/oauth/register/route.ts`
- `web/app/oauth/authorize/route.ts`
- `web/app/oauth/token/route.ts`
- End-to-end test with `msw` + a mock Supabase auth server verifying that a
  Claude-shaped OAuth dance ends in a working `tools/list` call.

### Phase 4 — Legacy SSE alias + docs

- `web/app/mcp/sse/route.ts` — thin wrapper that speaks the 2024-11-05 SSE
  transport for clients that need it.
- Update `scripts/mcp-expense/README.md` with the connector URL, OAuth flow
  screenshot, and the URL format for Claude web/mobile
  (`https://sre-web-app.vercel.app/mcp`).

## Testing strategy

| Layer | Test | Runs against |
|-------|------|--------------|
| Handler unit | `web/lib/expenses/mcp/tools.test.ts` (moved) | mocked SupabaseClient |
| Stdio regression | `scripts/mcp-expense/src/e2e.test.ts` (existing) | cloud Supabase |
| Remote transport | `web/app/mcp/route.test.ts` (new) | cloud Supabase, no browser |
| OAuth dance | `web/app/oauth/*.test.ts` (phase 3) | msw + mock Supabase |
| Smoke | manual: add connector in claude.ai, run `list_expenses` | production |

## Risks & mitigations

- **Vercel serverless cold start on SSE:** streams over serverless work but
  have a 30s function budget by default. Set `export const maxDuration = 300`
  on the route to give long-running SSE requests headroom.
- **JWT expiry mid-session:** Claude's OAuth layer handles refresh via
  `/oauth/token` refresh grant — we proxy that to Supabase's `/auth/v1/token`.
- **CORS from claude.ai:** allow-list `https://claude.ai` and
  `https://*.anthropic.com` in the response `Access-Control-Allow-Origin`
  header for the MCP + OAuth routes.
- **Tool naming collision with future features:** the `/mcp` route is
  namespace-locked to expense tools for now; if we add other MCP surfaces we
  put them at `/mcp/timesheets`, `/mcp/reports`, etc.

## Open questions

None blocking. Path B (static token) unblocks phase 1/2 and de-risks phase 3.
