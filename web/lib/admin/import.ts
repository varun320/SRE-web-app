export type ImportMode = 'balances' | 'history';
export type ImportAction = 'create' | 'skip' | 'conflict';

export interface ImportPlanItem {
  action: ImportAction;
  target: string;
  detail: string;
  reason: string;
}

export interface ImportPlanSummary {
  mode: ImportMode;
  source_filename: string;
  counts: { create: number; skip: number; conflict: number };
  warnings: string[];
  total: number;
}

export interface ImportDryRunResponse {
  batch_id: string;
  items: ImportPlanItem[];
  summary: ImportPlanSummary;
}

export interface ImportCommitResponse {
  batch_id: string;
  applied: number;
  skipped: number;
  committed_at: string | null;
  replayed: boolean;
}

export interface DryRunArgs {
  file: File;
  mode: ImportMode;
  employee_code?: string;
}

export async function postDryRun(args: DryRunArgs): Promise<ImportDryRunResponse> {
  const fd = new FormData();
  fd.append('file', args.file);
  fd.append('mode', args.mode);
  if (args.employee_code) fd.append('employee_code', args.employee_code);

  const res = await fetch('/api/admin/import/dry-run', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(await safeError(res));
  return res.json();
}

export async function postCommit(batchId: string): Promise<ImportCommitResponse> {
  const res = await fetch('/api/admin/import/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch_id: batchId }),
  });
  if (!res.ok) throw new Error(await safeError(res));
  return res.json();
}

async function safeError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error ?? `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}
