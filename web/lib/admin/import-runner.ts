/**
 * Shell out to the Python `sre-import` CLI in --json mode.
 *
 * The CLI is the canonical planner — this wrapper keeps the web layer thin.
 * Requires the importer venv to be installed: see scripts/import/README.md.
 *
 * Configurable env:
 *   SRE_IMPORT_PYTHON  Path to the python binary that has the package installed.
 *                      Defaults to "python".
 *   SRE_IMPORT_DIR     Path to the scripts/import directory (cwd for the CLI).
 *                      Defaults to <repo>/scripts/import resolved from process.cwd().
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const exec = promisify(execFile);

export type ImportMode = 'balances' | 'history';

export interface PlanItem {
  action: 'create' | 'skip' | 'conflict';
  target: string;
  detail: string;
  reason: string;
}

export interface PlanSummary {
  mode: ImportMode;
  source_filename: string;
  counts: { create: number; skip: number; conflict: number };
  warnings: string[];
  total: number;
}

export interface PlanDocument {
  mode: ImportMode;
  source_filename: string;
  source_hash: string;
  items: PlanItem[];
  payload: Record<string, unknown>;
  summary: PlanSummary;
}

export interface RunDryRunArgs {
  mode: ImportMode;
  filename: string;
  bytes: Buffer;
  employeeCode?: string;
}

function importerDir(): string {
  if (process.env.SRE_IMPORT_DIR) return process.env.SRE_IMPORT_DIR;
  // web/ is the Next.js cwd; the python project sits next to it.
  return path.resolve(process.cwd(), '..', 'scripts', 'import');
}

function pythonBin(): string {
  return process.env.SRE_IMPORT_PYTHON ?? 'python';
}

export async function writeTempUpload(filename: string, bytes: Buffer): Promise<string> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sre-import-'));
  const full = path.join(dir, safeName);
  await fs.writeFile(full, bytes);
  return full;
}

export async function runDryRun(args: RunDryRunArgs): Promise<PlanDocument> {
  const tmpPath = await writeTempUpload(args.filename, args.bytes);
  try {
    const cli = ['-m', 'sre_import.cli', args.mode, tmpPath, '--json'];
    if (args.mode === 'history') {
      if (!args.employeeCode) throw new Error('history mode requires employeeCode');
      cli.push('--employee-code', args.employeeCode);
    }
    const env = {
      ...process.env,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      PYTHONIOENCODING: 'utf-8',
    };
    const { stdout } = await exec(pythonBin(), cli, {
      cwd: importerDir(),
      env,
      maxBuffer: 16 * 1024 * 1024,
    });
    return JSON.parse(stdout) as PlanDocument;
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    const detail = err.stderr || err.stdout || err.message;
    throw new Error(`importer failed: ${detail.slice(0, 1000)}`);
  } finally {
    fs.rm(path.dirname(tmpPath), { recursive: true, force: true }).catch(() => {});
  }
}

export function sha256(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
