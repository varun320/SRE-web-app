#!/usr/bin/env node
// MCP server that lets Claude read + submit SRE expense reports on behalf of
// the signed-in user. All calls go through the same RLS-guarded RPCs the web
// app uses; the MCP process has no elevated privilege beyond the user's token.
//
// Tool handlers live under web/lib/expenses/mcp/ — that's the single source of
// truth shared with the remote (HTTP) MCP server. This file is just the stdio
// transport binding.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { connect, currentUser, isAdmin, loadEnv } from './client.js';
import { buildToolRegistry } from '../../../web/lib/expenses/mcp/registry.js';
import { zodToMcpJsonSchema } from '../../../web/lib/expenses/mcp/schema.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const sb = await connect(env);
  const me = await currentUser(sb);
  const admin = await isAdmin(sb, me.id);

  // Cast across the package boundary: stdio and web each bundle their own
  // copy of @supabase/supabase-js, so TS sees the classes as distinct even
  // though they're identical at runtime.
  const activeTools = buildToolRegistry({
    sb: sb as unknown as Parameters<typeof buildToolRegistry>[0]['sb'],
    userId: me.id,
    isAdmin: admin,
  });

  const server = new Server(
    { name: 'sre-expense-mcp', version: '0.2.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: activeTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToMcpJsonSchema(t.input),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = activeTools.find((t) => t.name === req.params.name);
    if (!tool) throw new Error(`Unknown tool: ${req.params.name}`);
    try {
      const result = await tool.handler(req.params.arguments ?? {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${message}` }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `sre-expense-mcp connected as ${me.email ?? me.id} (${admin ? 'admin' : 'employee'}); ` +
      `${activeTools.length} tools available.\n`,
  );
}

main().catch((err) => {
  process.stderr.write(
    `sre-expense-mcp fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
