import { describe, it, expect } from 'vitest';
import { toCsv } from '@/lib/admin/reports/csv';

const BOM = '﻿';

describe('toCsv', () => {
  it('writes header + rows with a UTF-8 BOM', () => {
    const out = toCsv([{ a: 1, b: 'x' }, { a: 2, b: 'y' }]);
    expect(out.startsWith(BOM)).toBe(true);
    expect(out.slice(1)).toBe('a,b\n1,x\n2,y\n');
  });

  it('quotes commas and newlines', () => {
    const out = toCsv([{ note: 'hello, world' }, { note: 'line1\nline2' }]);
    expect(out).toContain('"hello, world"');
    expect(out).toContain('"line1\nline2"');
  });

  it('doubles embedded quotes per RFC 4180', () => {
    const out = toCsv([{ s: 'she said "hi"' }]);
    expect(out).toContain('"she said ""hi"""');
  });

  it('respects explicit column order', () => {
    const out = toCsv([{ a: 1, b: 2 }], { columns: ['b', 'a'] });
    expect(out).toContain('b,a\n2,1\n');
  });

  it('renders empty input as just the BOM', () => {
    expect(toCsv([])).toBe(BOM);
  });

  it('renders null / undefined as empty strings', () => {
    const out = toCsv([{ a: null, b: undefined, c: 0 }]);
    expect(out.slice(1)).toBe('a,b,c\n,,0\n');
  });
});
