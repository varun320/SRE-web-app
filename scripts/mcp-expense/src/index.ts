#!/usr/bin/env node
// MCP server that lets Claude read + submit SRE expense reports on behalf of
// the signed-in user. All calls go through the same RLS-guarded RPCs the web
// app uses; the MCP process has no elevated privilege beyond the user's token.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from './zod-to-json.js';
import { connect, currentUser, isAdmin, loadEnv } from './client.js';
import {
  approveExpense,
  approveInput,
  declineExpense,
  declineInput,
  getBalanceSummary,
  getExpense,
  getExpenseInput,
  listExpenses,
  listExpensesInput,
  listPayouts,
  listPayoutsInput,
  recordPayout,
  recordPayoutInput,
  submitExpense,
  submitInput,
  unlockExpense,
  unlockInput,
  upsertDraft,
  upsertDraftInput,
} from './tools.js';

interface ToolDef {
  name: string;
  description: string;
  input: z.ZodTypeAny;
  adminOnly?: boolean;
  handler: (args: unknown) => Promise<unknown>;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const sb = await connect(env);
  const me = await currentUser(sb);
  const admin = await isAdmin(sb, me.id);

  const tools: ToolDef[] = [
    {
      name: 'list_expenses',
      description: 'List the signed-in user\'s expense reports, newest first. Optional status/date range filters.',
      input: listExpensesInput,
      handler: (a) => listExpenses(sb, listExpensesInput.parse(a)),
    },
    {
      name: 'get_expense',
      description: 'Get one expense report by invoice_no, including balance and any recorded payouts.',
      input: getExpenseInput,
      handler: (a) => getExpense(sb, me.id, getExpenseInput.parse(a)),
    },
    {
      name: 'upsert_expense_draft',
      description: 'Create-or-update a draft expense report (yellow cells only). Returns the row id.',
      input: upsertDraftInput,
      handler: (a) => upsertDraft(sb, upsertDraftInput.parse(a)),
    },
    {
      name: 'submit_expense',
      description: 'Submit a draft (or previously declined) expense report to the admin for approval.',
      input: submitInput,
      handler: (a) => submitExpense(sb, me.id, submitInput.parse(a)),
    },
    {
      name: 'list_payouts',
      description: 'List payouts. Filter by invoice_no when you care about a single report.',
      input: listPayoutsInput,
      handler: (a) => listPayouts(sb, listPayoutsInput.parse(a)),
    },
    {
      name: 'get_balance_summary',
      description: 'Get the Summary-sheet totals and the full per-invoice balance & interest table.',
      input: z.object({}),
      handler: () => getBalanceSummary(sb, me.id),
    },
    {
      name: 'approve_expense',
      description: 'Admin only. Approve a submitted expense report and lock it.',
      input: approveInput,
      adminOnly: true,
      handler: (a) => approveExpense(sb, approveInput.parse(a)),
    },
    {
      name: 'decline_expense',
      description: 'Admin only. Decline a submitted expense report with a reason.',
      input: declineInput,
      adminOnly: true,
      handler: (a) => declineExpense(sb, declineInput.parse(a)),
    },
    {
      name: 'unlock_expense',
      description: 'Admin only. Unlock an approved expense so the employee can amend and resubmit.',
      input: unlockInput,
      adminOnly: true,
      handler: (a) => unlockExpense(sb, unlockInput.parse(a)),
    },
    {
      name: 'record_payout',
      description: 'Admin only. Record a payment received against a specific invoice.',
      input: recordPayoutInput,
      adminOnly: true,
      handler: (a) => recordPayout(sb, recordPayoutInput.parse(a)),
    },
  ];

  const activeTools = tools.filter((t) => admin || !t.adminOnly);

  const server = new Server(
    { name: 'sre-expense-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: activeTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.input),
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
  process.stderr.write(`sre-expense-mcp fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
