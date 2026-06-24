/**
 * Zero-dep CSV streaming for report downloads.
 *
 * Why not csv-stringify: avoiding a runtime dep for what amounts to ~20 lines
 * of escaping. RFC 4180 quoting is the only thing that matters; Excel-friendly
 * BOM is prepended so UTF-8 strings render correctly on Windows Excel.
 */

const BOM = '﻿';

export interface CsvOptions {
  /** Column order. Falls back to keys of the first row. */
  columns?: string[];
}

export function toCsv(rows: readonly Record<string, unknown>[], opts: CsvOptions = {}): string {
  if (rows.length === 0) return BOM;
  const columns = opts.columns ?? Object.keys(rows[0]);
  const header = columns.map(csvEscape).join(',');
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(',')).join('\n');
  return BOM + header + '\n' + body + '\n';
}

export function csvResponse(
  filename: string,
  rows: readonly Record<string, unknown>[],
  opts: CsvOptions = {},
): Response {
  return new Response(toCsv(rows, opts), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${sanitizeFilename(filename)}"`,
      'cache-control': 'no-store',
    },
  });
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' ? String(value) : String(value);
  // Quote if the value contains anything special.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_');
}
