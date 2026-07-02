// Minimal Zod → JSON Schema converter for the small subset of shapes we
// declare in tools.ts. Avoids pulling in `zod-to-json-schema` as a dep.

import { z } from 'zod';

type JsonSchema = Record<string, unknown>;

export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  return convert(schema);
}

function convert(schema: z.ZodTypeAny): JsonSchema {
  const def = (schema as { _def: { typeName: string } })._def;
  const name = def.typeName;

  if (name === 'ZodString') {
    const d = (schema as unknown as { _def: { checks?: Array<Record<string, unknown>> } })._def;
    const out: JsonSchema = { type: 'string' };
    for (const c of d.checks ?? []) {
      if (c.kind === 'regex') out.pattern = (c.regex as RegExp).source;
      if (c.kind === 'min') out.minLength = c.value;
      if (c.kind === 'max') out.maxLength = c.value;
    }
    return out;
  }
  if (name === 'ZodNumber') {
    const d = (schema as unknown as { _def: { checks?: Array<Record<string, unknown>> } })._def;
    const out: JsonSchema = { type: 'number' };
    for (const c of d.checks ?? []) {
      if (c.kind === 'min') out.minimum = c.value;
      if (c.kind === 'max') out.maximum = c.value;
    }
    return out;
  }
  if (name === 'ZodBoolean') return { type: 'boolean' };
  if (name === 'ZodEnum') {
    const d = (schema as unknown as { _def: { values: string[] } })._def;
    return { type: 'string', enum: d.values };
  }
  if (name === 'ZodObject') {
    const shape = (schema as unknown as { _def: { shape: () => Record<string, z.ZodTypeAny> } })._def.shape();
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      properties[k] = convert(v);
      const inner = (v as { _def: { typeName: string } })._def.typeName;
      if (inner !== 'ZodOptional' && inner !== 'ZodDefault') required.push(k);
    }
    const out: JsonSchema = { type: 'object', properties };
    if (required.length) out.required = required;
    return out;
  }
  if (name === 'ZodOptional') {
    return convert((schema as unknown as { _def: { innerType: z.ZodTypeAny } })._def.innerType);
  }
  if (name === 'ZodDefault') {
    const d = (schema as unknown as { _def: { innerType: z.ZodTypeAny; defaultValue: () => unknown } })._def;
    return { ...convert(d.innerType), default: d.defaultValue() };
  }
  return {};
}
