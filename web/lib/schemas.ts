import { z } from 'zod';

export const entryDraftSchema = z.object({
  id: z.string().uuid().optional(),
  main_category: z.enum(['Project', 'Admin', 'Office & Sales']),
  sub_category_id: z.string().uuid(),
  project_id: z.string().uuid().nullable(),
  mon_hrs: z.number().min(0),
  tue_hrs: z.number().min(0),
  wed_hrs: z.number().min(0),
  thu_hrs: z.number().min(0),
  fri_hrs: z.number().min(0),
  sat_hrs: z.number().min(0),
  sun_hrs: z.number().min(0),
  description: z.string().trim().min(1, 'Description required'),
  position: z.number().int().min(0),
});

export type EntryDraftInput = z.input<typeof entryDraftSchema>;
