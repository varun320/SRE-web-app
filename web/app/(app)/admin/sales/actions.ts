'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { patchStage, postNote } from '@/features/sales/client';
import { OPPORTUNITY_STAGES } from '@/features/sales/types';

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
  const result = await patchStage(parsed.data.id, parsed.data.stage);
  revalidatePath('/admin/sales');
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
  const result = await postNote(parsed.data.id, parsed.data.body);
  revalidatePath('/admin/sales');
  return result;
}
