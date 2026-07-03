# Remote MCP Server — Implementation Plan (2026-07-03)

Companion to `2026-07-03-remote-mcp-design.md`. Each phase is a
self-contained commit with tests that must pass before moving to the next.

## Phase 1 — Extract shared tool registry into `web/lib/expenses/mcp/`

**Motivation:** Both transports need the same 10 tool handlers. Right now they
live under `scripts/mcp-expense/src/`. Move them into the web package (no Next
deps), have the stdio server import from the new location, prove no regression
with the existing e2e.

**Files:**
- `web/lib/expenses/mcp/tools.ts` — moved verbatim from
  `scripts/mcp-expense/src/tools.ts`.
- `web/lib/expenses/mcp/zod-to-json.ts` — moved verbatim.
- `web/lib/expenses/mcp/registry.ts` — new. Exports
  `buildToolRegistry({ sb, userId, isAdmin }) : ToolDef[]` — the array
  currently inlined in `scripts/mcp-expense/src/index.ts` lines 51–116.
- `scripts/mcp-expense/tsconfig.json` — add rootDirs so imports from
  `../../web/lib/expenses/mcp/` resolve.
- `scripts/mcp-expense/src/index.ts` — replace inline `tools` array with
  `buildToolRegistry(...)`.
- Delete `scripts/mcp-expense/src/tools.ts` and `zod-to-json.ts` (or make them
  1-line re-exports for backwards compat — cleaner to delete).

**Tests to pass:**
- `pnpm -C scripts/mcp-expense build` succeeds.
- `SRE_E2E_*=... pnpm -C scripts/mcp-expense test` (existing e2e) passes
  against cloud Supabase.

**Commit:** `refactor(mcp-expense): move tool registry into web/lib/expenses/mcp for reuse`

---

## Phase 2 — Streamable HTTP MCP at `POST /mcp` with bearer auth

**Motivation:** The transport that Claude web + mobile speak. Wired to per-
request Supabase JWT; RLS binds naturally.

**Dependencies:**
- `pnpm -C web add @vercel/mcp-adapter@latest @modelcontextprotocol/sdk@latest`

**Files:**
- `web/lib/expenses/mcp/auth.ts` — new.
  ```
  bearerToSupabase(authHeader: string | null) →
    Promise<{ sb: SupabaseClient; userId: string; isAdmin: boolean } | null>
  ```
  Returns null if the header is missing or the JWT is invalid.

- `web/app/mcp/route.ts` — new. Streamable HTTP handler.
  - `POST` — reads Authorization header, builds session, hands off to
    `createMcpHandler` (from `@vercel/mcp-adapter`) with the filtered tool
    registry from Phase 1.
  - `OPTIONS` — CORS preflight for `https://claude.ai`.
  - `export const runtime = 'nodejs'` (Supabase JS needs Node).
  - `export const maxDuration = 300`.

- `web/app/mcp/token/page.tsx` — new. Signed-in Supabase users see their
  current access token, a copy-to-clipboard button, and a code-block with the
  Claude connector setup instructions (URL + header). Guarded by
  `getSupabaseServer()` — anonymous users get redirected to `/login`.

- `web/app/mcp/route.test.ts` — new Vitest suite. Signs the dev user in via
  supabase-js against cloud Supabase (skips if env not set — same pattern as
  `scripts/mcp-expense/src/e2e.test.ts`), then calls the route handler
  function directly with:
  - `initialize` → returns protocol version + capabilities.
  - `tools/list` with valid bearer → 10 tools.
  - `tools/list` with no bearer → 401.
  - `tools/list` with bogus bearer → 401.
  - `tools/call list_expenses` → array.
  - `tools/call upsert_expense_draft` with test invoice → id.
  - Idempotent upsert by invoice_no (second call updates same row).
  - `tools/call submit_expense` → status flips to submitted.
  - Cannot submit twice.

**Manual smoke:**
1. `pnpm -C web dev`
2. Sign in as `dev@sulfurrecovery.com`, open `/mcp/token`, copy JWT.
3. In claude.ai → Settings → Connectors → Add custom connector →
   URL `http://localhost:3000/mcp`, header `Authorization: Bearer <jwt>`.
4. Ask Claude "list my expenses" — verify tool call succeeds.

**Commit:** `feat(mcp): remote MCP server at POST /mcp with bearer-auth`

---

## Phase 3 — OAuth 2.1 authorization server (production Claude UX)

**Motivation:** Users shouldn't have to hand-copy a bearer token. Claude
custom connectors do OAuth 2.1 with PKCE; we proxy that to Supabase Auth.

**Files:**
- `web/app/.well-known/oauth-authorization-server/route.ts` — AS metadata.
- `web/app/.well-known/oauth-protected-resource/route.ts` — resource metadata.
- `web/app/oauth/register/route.ts` — DCR endpoint, returns a fixed
  client_id/secret pair (Supabase does the real auth; DCR is ceremonial).
- `web/app/oauth/authorize/route.ts` — 302s to Supabase-hosted login with a
  proxied `redirect_uri` back to `/oauth/callback`.
- `web/app/oauth/callback/route.ts` — exchanges the Supabase auth code for a
  session, mints an MCP-shaped `code` for Claude, redirects to Claude's
  `redirect_uri`.
- `web/app/oauth/token/route.ts` — swaps `code` → `{ access_token,
  refresh_token, expires_in }` (Supabase JWT). Supports the `refresh_token`
  grant by proxying to Supabase.
- `web/lib/oauth/store.ts` — in-memory (dev) or Supabase-backed (prod) map of
  `code → supabaseSession`. TTL 10 min.

**Tests to pass:**
- `web/app/oauth/oauth-flow.test.ts` — msw-mocked Supabase; drives the entire
  Claude-shaped OAuth dance end-to-end and asserts the final access token
  works against `POST /mcp`.

**Manual smoke:**
1. In claude.ai → Add custom connector → URL
   `https://sre-web-app.vercel.app/mcp` (no bearer paste).
2. Claude discovers `/.well-known/oauth-authorization-server`, does DCR,
   redirects the browser to Supabase login.
3. After login, connector shows "Connected" and lists 10 tools.

**Commit:** `feat(mcp): OAuth 2.1 authorization server for remote MCP connector`

---

## Phase 4 — Legacy SSE alias + docs

**Motivation:** A few Claude clients still speak the 2024-11-05 SSE transport;
give them an alias.

**Files:**
- `web/app/mcp/sse/route.ts` — thin adapter that runs the legacy SSE
  transport against the same registry.
- `scripts/mcp-expense/README.md` — update with:
  - Remote URL for Claude web/mobile.
  - Screenshot of the connector settings.
  - Stdio remains available for Claude Desktop / Claude Code.
- `docs/plans/2026-07-02-expense-tracker-design.md` — append a "Remote MCP"
  paragraph pointing to this plan.

**Tests to pass:**
- Manual: add connector using the SSE URL on a legacy client (Claude Desktop
  Beta channel).

**Commit:** `feat(mcp): legacy SSE alias + connector docs`

---

## Rollback

Each phase is one commit. If phase N breaks, `git revert <sha>` restores the
prior working state; earlier phases stay live because they're independently
useful (phase 1 is pure refactor, phase 2 stands alone if we skip 3).

## Definition of done

- [ ] All four commits merged to `main` and deployed on Vercel.
- [ ] `https://sre-web-app.vercel.app/mcp` reachable and returns MCP JSON-RPC.
- [ ] A user with only the "employee" role sees 6 tools; a dev/admin user
      sees 10.
- [ ] `scripts/mcp-expense/src/e2e.test.ts` still passes (stdio unbroken).
- [ ] `web/app/mcp/route.test.ts` passes against cloud Supabase.
- [ ] Claude iOS app can connect to `/mcp`, list tools, and submit an expense.
