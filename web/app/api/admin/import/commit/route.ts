import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseServiceRole } from '@/lib/supabase/service';
import { fetchIsAdmin } from '@/lib/role';

export const runtime = 'nodejs';

interface CommitBody {
  batch_id?: string;
}

export async function POST(req: Request) {
  const userSb = await getSupabaseServer();
  if (!(await fetchIsAdmin(userSb))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CommitBody | null;
  if (!body?.batch_id) return NextResponse.json({ error: 'batch_id required' }, { status: 400 });

  const service = getSupabaseServiceRole();

  // Refuse to commit a plan with conflicts (defense in depth — UI also blocks).
  const { data: batch, error: loadErr } = await service
    .from('import_batches')
    .select('id, summary, committed_at')
    .eq('id', body.batch_id)
    .single();
  if (loadErr || !batch) {
    return NextResponse.json({ error: 'batch not found' }, { status: 404 });
  }
  const conflicts = (batch.summary as { counts?: { conflict?: number } })?.counts?.conflict ?? 0;
  if (conflicts > 0 && !batch.committed_at) {
    return NextResponse.json(
      { error: `plan has ${conflicts} conflict(s); resolve before commit` },
      { status: 422 }
    );
  }

  const { data, error } = await service.rpc('apply_import_batch', { p_batch_id: body.batch_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ batch_id: body.batch_id, ...(data as Record<string, unknown>) });
}
