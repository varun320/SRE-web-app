import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServiceRole } from '@/shared/supabase/service';
import { verifySignature } from '@/features/sales/notifications/hmac';
import { SALES_NOTIFICATION_CATEGORIES } from '@/features/sales/notifications/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  engineerId: z.string().uuid(),
  category: z.enum(SALES_NOTIFICATION_CATEGORIES),
  opportunityId: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional(),
  actionUrl: z.string().url().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.SRE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'SRE_WEBHOOK_SECRET not configured' },
      { status: 500 },
    );
  }

  const raw = await req.text();
  const signature = req.headers.get('x-sre-signature');
  if (!verifySignature(raw, signature, secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const p = parsed.data;

  const sb = getSupabaseServiceRole();

  // Idempotency: skip if the same (engineer, category, opportunity) already has
  // an unread row from today. Matches the partial unique index on the table.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data: existing } = await sb
    .from('sales_notifications')
    .select('id')
    .eq('engineer_id', p.engineerId)
    .eq('category', p.category)
    .eq('opportunity_id', p.opportunityId)
    .is('read_at', null)
    .gte('created_at', dayStart.toISOString())
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { ok: true, id: existing.id, deduped: true },
      { status: 200 },
    );
  }

  const { data: inserted, error } = await sb
    .from('sales_notifications')
    .insert({
      engineer_id: p.engineerId,
      category: p.category,
      opportunity_id: p.opportunityId,
      title: p.title,
      body: p.body ?? null,
      action_url: p.actionUrl ?? null,
    })
    .select('id')
    .single();

  if (error) {
    // Unique-index race: another concurrent request won. Treat as dedup.
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: inserted.id }, { status: 201 });
}
