'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getOpportunity, patchStage, postNote } from '@/features/sales/client';
import { OPPORTUNITY_STAGES } from '@/features/sales/types';
import { getSupabaseServer } from '@/shared/supabase/server';
import { fetchIsAdmin } from '@/shared/lib/role';

// Sales pipeline is visible to every engineer, but only admins and the
// assigned engineer can mutate an opportunity. Fixture mode maps auth uid
// through the same "u_maaz"-style ids used in the fixture opps.
async function canEdit(opportunityId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = await getSupabaseServer();
  const { data } = await sb.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return { ok: false, error: 'Not signed in' };
  const isAdmin = await fetchIsAdmin(sb);
  if (isAdmin) return { ok: true };
  const opp = await getOpportunity(opportunityId);
  const ownerId = opp.data?.customFields?.sre_engineer_user_id;
  const effectiveUid = process.env.SRE_SALES_FIXTURES === '1' || !process.env.SRE_AUTOMATIONS_URL
    ? 'u_maaz'  // matches home page fixture default
    : uid;
  if (ownerId && ownerId === effectiveUid) return { ok: true };
  return { ok: false, error: 'You can only edit opportunities assigned to you' };
}

const stageSchema = z.object({
  id: z.string().min(1),
  stage: z.enum(OPPORTUNITY_STAGES),
});

export async function changeStageAction(input: {
  id: string;
  stage: string;
}): Promise<{ ok: boolean; stale: boolean; error?: string }> {
  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, stale: false, error: 'Invalid stage input' };
  }
  const gate = await canEdit(parsed.data.id);
  if (!gate.ok) return { ok: false, stale: false, error: gate.error };
  const result = await patchStage(parsed.data.id, parsed.data.stage);
  revalidatePath('/sales');
  return result;
}

const noteSchema = z.object({
  id: z.string().min(1),
  body: z.string().min(1).max(4000),
});

export async function addNoteAction(input: {
  id: string;
  body: string;
}): Promise<{ ok: boolean; stale: boolean; error?: string }> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, stale: false, error: 'Note cannot be empty' };
  }
  const gate = await canEdit(parsed.data.id);
  if (!gate.ok) return { ok: false, stale: false, error: gate.error };
  const result = await postNote(parsed.data.id, parsed.data.body);
  revalidatePath('/sales');
  return result;
}
