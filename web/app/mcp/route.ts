// Remote MCP endpoint — Streamable HTTP transport (MCP spec 2025-03-26).
//
// Each POST is one JSON-RPC message: initialize, tools/list, or tools/call.
// We bind a Supabase session per-request from the Authorization header, so
// RLS resolves auth.uid() to the caller and admin tools stay gated.
//
// The stdio server at scripts/mcp-expense/ uses the same tool registry — this
// file is transport-only.

import type { NextRequest } from 'next/server';
import { extractBearer, sessionFromBearer } from '@/lib/expenses/mcp/auth';
import { buildToolRegistry } from '@/lib/expenses/mcp/registry';
import { zodToMcpJsonSchema } from '@/lib/expenses/mcp/schema';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const PROTOCOL_VERSION = '2025-03-26';
const SERVER_INFO = { name: 'sre-expense-mcp', version: '0.2.0' } as const;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, WWW-Authenticate',
  'Access-Control-Max-Age': '86400',
};

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function rpcError(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...(init.headers ?? {}),
    },
  });
}

function unauthorized(reason: string, req?: Request): Response {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  let origin = configured;
  if (!origin && req) {
    try {
      origin = new URL(req.url).origin;
    } catch {
      origin = undefined;
    }
  }
  const resourceMetadata = origin
    ? `${origin}/.well-known/oauth-protected-resource`
    : '/.well-known/oauth-protected-resource';
  return json(
    { error: 'unauthorized', reason },
    {
      status: 401,
      headers: {
        // RFC 9728 §5.1: point clients at our protected-resource metadata so
        // Claude can auto-discover the OAuth authorization server.
        'WWW-Authenticate':
          `Bearer realm="sre-expense-mcp", error="invalid_token", ` +
          `error_description="${reason}", resource_metadata="${resourceMetadata}"`,
      },
    },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  // Remote MCP clients sometimes probe GET for capability discovery. Reply
  // with a small hint pointing at the correct method.
  return json({
    protocol: 'mcp',
    transport: 'streamable-http',
    version: PROTOCOL_VERSION,
    hint: 'POST JSON-RPC requests to this URL with an Authorization: Bearer <supabase-jwt> header.',
  });
}

export async function POST(req: NextRequest) {
  const bearer = extractBearer(req.headers.get('authorization'));
  if (!bearer) return unauthorized('missing bearer token', req);

  let session;
  try {
    session = await sessionFromBearer(bearer);
  } catch (err) {
    return unauthorized(err instanceof Error ? err.message : 'auth failed', req);
  }
  if (!session) return unauthorized('invalid bearer token', req);

  let body: JsonRpcRequest;
  try {
    body = (await req.json()) as JsonRpcRequest;
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), { status: 400 });
  }

  if (body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return json(rpcError(body.id ?? null, -32600, 'Invalid Request'), { status: 400 });
  }

  // Notifications (no id) get 202 with an empty body.
  const isNotification = body.id === undefined || body.id === null;

  const tools = buildToolRegistry({
    sb: session.sb,
    userId: session.userId,
    isAdmin: session.isAdmin,
  });

  try {
    switch (body.method) {
      case 'initialize': {
        return json({
          jsonrpc: '2.0',
          id: body.id ?? null,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: SERVER_INFO,
          },
        } satisfies JsonRpcResponse);
      }

      case 'notifications/initialized':
      case 'notifications/cancelled':
      case 'notifications/progress': {
        return new Response(null, { status: 202, headers: CORS_HEADERS });
      }

      case 'ping': {
        return json({ jsonrpc: '2.0', id: body.id ?? null, result: {} } satisfies JsonRpcResponse);
      }

      case 'tools/list': {
        return json({
          jsonrpc: '2.0',
          id: body.id ?? null,
          result: {
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: zodToMcpJsonSchema(t.input),
            })),
          },
        } satisfies JsonRpcResponse);
      }

      case 'tools/call': {
        const { name, arguments: args } = (body.params ?? {}) as {
          name?: string;
          arguments?: unknown;
        };
        if (!name) {
          return json(rpcError(body.id ?? null, -32602, 'tools/call requires name'));
        }
        const tool = tools.find((t) => t.name === name);
        if (!tool) {
          return json(rpcError(body.id ?? null, -32601, `Unknown tool: ${name}`));
        }
        try {
          const result = await tool.handler(args ?? {});
          return json({
            jsonrpc: '2.0',
            id: body.id ?? null,
            result: {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            },
          } satisfies JsonRpcResponse);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return json({
            jsonrpc: '2.0',
            id: body.id ?? null,
            result: {
              isError: true,
              content: [{ type: 'text', text: `Error: ${message}` }],
            },
          } satisfies JsonRpcResponse);
        }
      }

      default: {
        if (isNotification) {
          return new Response(null, { status: 202, headers: CORS_HEADERS });
        }
        return json(rpcError(body.id ?? null, -32601, `Method not found: ${body.method}`));
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(rpcError(body.id ?? null, -32603, `Internal error: ${message}`), { status: 500 });
  }
}
