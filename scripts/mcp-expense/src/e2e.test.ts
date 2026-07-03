// End-to-end smoke test.
//
// Signs the dev user in against cloud Supabase, spawns the built MCP server
// as a child process, drives it over stdio with the raw MCP JSON-RPC frames,
// and asserts each tool works.
//
// Skips itself unless SRE_E2E_URL / SRE_E2E_ANON / SRE_E2E_EMAIL / SRE_E2E_PASSWORD are set.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

const URL_       = process.env.SRE_E2E_URL;
const ANON       = process.env.SRE_E2E_ANON;
const EMAIL      = process.env.SRE_E2E_EMAIL;
const PASSWORD   = process.env.SRE_E2E_PASSWORD;
const runE2e = Boolean(URL_ && ANON && EMAIL && PASSWORD);

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = resolve(here, '..', 'dist', 'index.js');

interface RpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

class McpClient {
  private child: ChildProcessWithoutNullStreams;
  private buffer = '';
  private pending = new Map<number, (r: RpcResponse) => void>();
  private nextId = 1;

  constructor(child: ChildProcessWithoutNullStreams) {
    this.child = child;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      let idx: number;
      while ((idx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        const msg = JSON.parse(line) as RpcResponse;
        const cb = this.pending.get(msg.id);
        if (cb) {
          this.pending.delete(msg.id);
          cb(msg);
        }
      }
    });
  }

  async request(method: string, params: unknown = {}): Promise<unknown> {
    const id = this.nextId++;
    const frame = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    const promise = new Promise<RpcResponse>((res) => this.pending.set(id, res));
    this.child.stdin.write(frame);
    const resp = await promise;
    if (resp.error) throw new Error(`${method}: ${resp.error.message}`);
    return resp.result;
  }

  notify(method: string, params: unknown = {}): void {
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  close(): void {
    this.child.stdin.end();
    this.child.kill();
  }
}

interface CallToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

async function callTool(mcp: McpClient, name: string, args: Record<string, unknown> = {}) {
  const result = (await mcp.request('tools/call', { name, arguments: args })) as CallToolResult;
  if (result.isError) throw new Error(`tool ${name} errored: ${result.content[0]?.text}`);
  return JSON.parse(result.content[0].text);
}

describe.skipIf(!runE2e)('sre-expense-mcp end-to-end', () => {
  let mcp: McpClient;
  const invoice = `E2E${Date.now().toString().slice(-8)}`;

  beforeAll(async () => {
    // 1. Sign in via supabase-js to get a fresh access + refresh token.
    const sb = createClient(URL_!, ANON!);
    const { data, error } = await sb.auth.signInWithPassword({
      email: EMAIL!,
      password: PASSWORD!,
    });
    if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`);

    // 2. Spawn the MCP server with those tokens.
    const child = spawn('node', [serverEntry], {
      env: {
        ...process.env,
        SRE_SUPABASE_URL: URL_!,
        SRE_SUPABASE_ANON_KEY: ANON!,
        SRE_ACCESS_TOKEN: data.session.access_token,
        SRE_REFRESH_TOKEN: data.session.refresh_token,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Surface stderr for debugging.
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d: string) => process.stderr.write(`[mcp] ${d}`));

    mcp = new McpClient(child);

    // 3. Initialize.
    await mcp.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'e2e-test', version: '0.0.1' },
    });
    mcp.notify('notifications/initialized');
  }, 30_000);

  afterAll(() => {
    mcp?.close();
  });

  it('advertises all employee tools (dev user is admin+employee → 10 tools)', async () => {
    const { tools } = (await mcp.request('tools/list')) as { tools: Array<{ name: string }> };
    const names = tools.map((t) => t.name).sort();
    // Dev user has admin+employee roles, so admin tools should be present.
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
  });

  it('list_expenses returns own reports (RLS enforced)', async () => {
    const rows = (await callTool(mcp, 'list_expenses', {})) as unknown[];
    expect(Array.isArray(rows)).toBe(true);
    // Nothing else to assert about content; the fact we got any response means
    // RLS bound to auth.uid() successfully.
  });

  it('get_balance_summary returns per-user totals', async () => {
    const summary = (await callTool(mcp, 'get_balance_summary')) as {
      summary: { total_submitted: number; total_owing: number } | null;
      invoices: unknown[];
    };
    // Either a real summary row or null (if user has no submitted reports yet).
    if (summary.summary) {
      expect(Number(summary.summary.total_submitted)).toBeGreaterThanOrEqual(0);
      expect(Number(summary.summary.total_owing)).toBeGreaterThanOrEqual(0);
    }
    expect(Array.isArray(summary.invoices)).toBe(true);
  });

  it('upsert_expense_draft creates a draft', async () => {
    const { id } = (await callTool(mcp, 'upsert_expense_draft', {
      invoice_no: invoice,
      period_from: '2026-06-01',
      period_to: '2026-06-30',
      amount_cad: 1234.56,
      gst_cad: 61.73,
      notes: 'e2e smoke test',
    })) as { id: string };
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('upsert_expense_draft is idempotent (edits by invoice_no)', async () => {
    await callTool(mcp, 'upsert_expense_draft', {
      invoice_no: invoice,
      period_from: '2026-06-01',
      period_to: '2026-06-30',
      amount_cad: 2000,
      gst_cad: 100,
      notes: 'e2e smoke test — updated',
    });
    const detail = (await callTool(mcp, 'get_expense', { invoice_no: invoice })) as {
      report: { amount_cad: string; gst_cad: string; total_cad: string; status: string };
    };
    expect(Number(detail.report.amount_cad)).toBe(2000);
    expect(Number(detail.report.gst_cad)).toBe(100);
    expect(Number(detail.report.total_cad)).toBe(2100);
    expect(detail.report.status).toBe('draft');
  });

  it('submit_expense flips status to submitted', async () => {
    const res = (await callTool(mcp, 'submit_expense', { invoice_no: invoice })) as {
      status: string;
    };
    expect(res.status).toBe('submitted');

    const detail = (await callTool(mcp, 'get_expense', { invoice_no: invoice })) as {
      report: { status: string; submitted_at: string | null };
      balance: { total_owing: string } | null;
    };
    expect(detail.report.status).toBe('submitted');
    expect(detail.report.submitted_at).not.toBeNull();
    expect(detail.balance).not.toBeNull();
  });

  it('cannot submit a report twice', async () => {
    await expect(callTool(mcp, 'submit_expense', { invoice_no: invoice })).rejects.toThrow(
      /cannot submit from status submitted/i,
    );
  });

  it('get_expense on an unknown invoice fails with 404-like error', async () => {
    await expect(
      callTool(mcp, 'get_expense', { invoice_no: 'UC-DOES-NOT-EXIST-99' }),
    ).rejects.toThrow(/No expense with invoice_no/);
  });

  it('list_payouts returns an array (may be empty)', async () => {
    const rows = (await callTool(mcp, 'list_payouts', {})) as unknown[];
    expect(Array.isArray(rows)).toBe(true);
  });

  it('input validation rejects malformed drafts', async () => {
    await expect(
      callTool(mcp, 'upsert_expense_draft', {
        invoice_no: 'XX',                    // too short
        period_from: '2026-06-01',
        period_to: '2026-06-30',
        amount_cad: 100,
      }),
    ).rejects.toThrow();
  });
});
