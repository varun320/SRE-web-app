// End-to-end test for the remote MCP endpoint at POST /mcp.
//
// Signs the dev user in against cloud Supabase, then calls the exported POST
// handler directly with a Web Request. Skips itself unless the same
// SRE_E2E_* env vars used by scripts/mcp-expense/src/e2e.test.ts are set.

import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

const URL_ = process.env.SRE_E2E_URL;
const ANON = process.env.SRE_E2E_ANON;
const EMAIL = process.env.SRE_E2E_EMAIL;
const PASSWORD = process.env.SRE_E2E_PASSWORD;
const runE2e = Boolean(URL_ && ANON && EMAIL && PASSWORD);

interface RpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

interface CallToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

describe.skipIf(!runE2e)('remote /mcp endpoint', () => {
  let bearer: string;
  let POST: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    // Populate the env the route reads at request time.
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_!;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON!;

    const sb = createClient(URL_!, ANON!);
    const { data, error } = await sb.auth.signInWithPassword({
      email: EMAIL!,
      password: PASSWORD!,
    });
    if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`);
    bearer = data.session.access_token;

    // Import after env is set so the route module sees it.
    const mod = await import('@/app/mcp/route');
    POST = mod.POST as unknown as (req: Request) => Promise<Response>;
  }, 30_000);

  async function call(method: string, params: unknown = {}, opts: { auth?: string | null } = {}) {
    const authHeader = opts.auth === null ? undefined : opts.auth ?? `Bearer ${bearer}`;
    const req = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const res = await POST(req);
    return { status: res.status, json: (await res.json()) as RpcResponse | { error: string } };
  }

  it('rejects requests with no Authorization header', async () => {
    const { status, json } = await call('tools/list', {}, { auth: null });
    expect(status).toBe(401);
    expect((json as { error: string }).error).toBe('unauthorized');
  });

  it('rejects requests with an invalid bearer', async () => {
    const { status } = await call('tools/list', {}, { auth: 'Bearer not-a-real-jwt' });
    expect(status).toBe(401);
  });

  it('initialize returns protocol version + serverInfo', async () => {
    const { status, json } = await call('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'remote-e2e', version: '0.0.1' },
    });
    expect(status).toBe(200);
    const result = (json as RpcResponse).result as {
      protocolVersion: string;
      serverInfo: { name: string };
    };
    expect(result.serverInfo.name).toBe('sre-expense-mcp');
    expect(result.protocolVersion).toBe('2025-03-26');
  });

  it('tools/list returns 10 tools for the dev admin+employee user', async () => {
    const { status, json } = await call('tools/list');
    expect(status).toBe(200);
    const { tools } = (json as RpcResponse).result as {
      tools: Array<{ name: string; inputSchema: unknown }>;
    };
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'approve_expense',
        'decline_expense',
        'get_balance_summary',
        'get_expense',
        'list_expenses',
        'list_payouts',
        'record_payout',
        'submit_expense',
        'unlock_expense',
        'upsert_expense_draft',
      ].sort(),
    );
    // Every tool must ship a JSON Schema Claude can render.
    for (const t of tools) expect(t.inputSchema).toBeTypeOf('object');
  });

  it('list_expenses returns own reports (RLS bound)', async () => {
    const { json } = await call('tools/call', { name: 'list_expenses', arguments: {} });
    const result = (json as RpcResponse).result as CallToolResult;
    expect(result.isError).not.toBe(true);
    const payload = JSON.parse(result.content[0].text) as unknown[];
    expect(Array.isArray(payload)).toBe(true);
  });

  const invoice = `E2R${Date.now().toString().slice(-8)}`;

  it('upsert_expense_draft creates then edits by invoice_no (idempotent)', async () => {
    const first = await call('tools/call', {
      name: 'upsert_expense_draft',
      arguments: {
        invoice_no: invoice,
        period_from: '2026-06-01',
        period_to: '2026-06-30',
        amount_cad: 500,
        gst_cad: 25,
        notes: 'remote e2e - initial',
      },
    });
    const firstRes = (first.json as RpcResponse).result as CallToolResult;
    expect(firstRes.isError).not.toBe(true);
    const { id: id1 } = JSON.parse(firstRes.content[0].text) as { id: string };
    expect(id1).toMatch(/^[0-9a-f-]{36}$/);

    const second = await call('tools/call', {
      name: 'upsert_expense_draft',
      arguments: {
        invoice_no: invoice,
        period_from: '2026-06-01',
        period_to: '2026-06-30',
        amount_cad: 999,
        gst_cad: 49.95,
        notes: 'remote e2e - updated',
      },
    });
    const secondRes = (second.json as RpcResponse).result as CallToolResult;
    const { id: id2 } = JSON.parse(secondRes.content[0].text) as { id: string };
    expect(id2).toBe(id1);

    const detail = await call('tools/call', {
      name: 'get_expense',
      arguments: { invoice_no: invoice },
    });
    const detailRes = (detail.json as RpcResponse).result as CallToolResult;
    const body = JSON.parse(detailRes.content[0].text) as {
      report: { amount_cad: string; total_cad: string; status: string };
    };
    expect(Number(body.report.amount_cad)).toBe(999);
    expect(Number(body.report.total_cad)).toBeCloseTo(1048.95, 2);
    expect(body.report.status).toBe('draft');
  });

  it('unknown tool returns a JSON-RPC error', async () => {
    const { json } = await call('tools/call', { name: 'does_not_exist', arguments: {} });
    expect((json as RpcResponse).error?.code).toBe(-32601);
  });

  it('unknown method returns -32601', async () => {
    const { json } = await call('resources/list', {});
    expect((json as RpcResponse).error?.code).toBe(-32601);
  });
});
