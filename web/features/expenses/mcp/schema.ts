// Convert a Zod schema to an MCP-shaped JSON Schema for tools/list responses.
//
// zod v4 ships z.toJSONSchema; we strip the $schema key MCP clients don't need.

import { z } from 'zod';

export function zodToMcpJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const out = z.toJSONSchema(schema);
  if ('$schema' in out) {
    const { $schema: _drop, ...rest } = out as { $schema?: string };
    return rest;
  }
  return out;
}
