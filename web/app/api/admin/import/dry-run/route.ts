import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseServiceRole } from '@/lib/supabase/service';
import { fetchIsAdmin } from '@/lib/role';
import { runDryRun, sha256, type ImportMode } from '@/lib/admin/import-runner';

export const runtime = 'nodejs'; // need fs + child_process; not Edge

export async function POST(req: Request) {
  const userSb = await getSupabaseServer();
  if (!(await fetchIsAdmin(userSb))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });

  const file = form.get('file');
  const mode = form.get('mode') as ImportMode | null;
  const employeeCode = (form.get('employee_code') as string | null) ?? undefined;

  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
  if (mode !== 'balances' && mode !== 'history') {
    return NextResponse.json({ error: 'mode must be balances|history' }, { status: 400 });
  }
  if (mode === 'history' && !employeeCode) {
    return NextResponse.json({ error: 'employee_code required for history mode' }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = sha256(bytes);
  const service = getSupabaseServiceRole();

  // Reuse existing batch if this file was already analyzed (cheap idempotency).
  const { data: existing } = await service
    .from('import_batches')
    .select('id, summary, plan_payload, source_filename, source_hash, mode')
    .eq('source_hash', hash)
    .eq('mode', mode)
    .maybeSingle();

  if (existing) {
    const items = (existing.plan_payload as { items?: unknown[] }).items ?? [];
    return NextResponse.json({
      batch_id: existing.id,
      items,
      summary: existing.summary,
    });
  }

  let plan;
  try {
    plan = await runDryRun({ mode, filename: file.name, bytes, employeeCode });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }

  // Persist a pending batch row so the commit step can replay the plan.
  const {
    data: { user },
  } = await userSb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { data: actor, error: actorErr } = await service
    .from('users')
    .select('id, org_id')
    .eq('id', user.id)
    .single();
  if (actorErr || !actor) {
    return NextResponse.json({ error: 'actor not found in users table' }, { status: 500 });
  }

  const { data: inserted, error: insertErr } = await service
    .from('import_batches')
    .insert({
      org_id: actor.org_id,
      imported_by: actor.id,
      mode,
      source_filename: plan.source_filename,
      source_hash: plan.source_hash,
      summary: plan.summary,
      plan_payload: { ...plan.payload, items: plan.items },
    })
    .select('id')
    .single();
  if (insertErr || !inserted) {
    return NextResponse.json({ error: insertErr?.message ?? 'insert failed' }, { status: 500 });
  }

  return NextResponse.json({
    batch_id: inserted.id,
    items: plan.items,
    summary: plan.summary,
  });
}
