export const SALES_NOTIFICATION_CATEGORIES = [
  'follow_up_due',
  'approval_needed',
  'declined',
  'lost',
  'won',
  'stage_changed',
  'assigned',
  'note_added',
] as const;

export type SalesNotificationCategory =
  (typeof SALES_NOTIFICATION_CATEGORIES)[number];

export interface SalesNotificationRow {
  id: string;
  engineer_id: string;
  category: SalesNotificationCategory;
  opportunity_id: string;
  title: string;
  body: string | null;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
}

export function isSalesNotificationCategory(
  value: unknown,
): value is SalesNotificationCategory {
  return (
    typeof value === 'string' &&
    (SALES_NOTIFICATION_CATEGORIES as readonly string[]).includes(value)
  );
}

export const CATEGORY_LABEL: Record<SalesNotificationCategory, string> = {
  follow_up_due: 'Follow-up due',
  approval_needed: 'Approval needed',
  declined: 'Declined',
  lost: 'Lost',
  won: 'Won',
  stage_changed: 'Stage changed',
  assigned: 'Assigned',
  note_added: 'New note',
};

export const CATEGORY_TONE: Record<
  SalesNotificationCategory,
  'info' | 'success' | 'danger' | 'warning' | 'neutral'
> = {
  follow_up_due: 'warning',
  approval_needed: 'info',
  declined: 'danger',
  lost: 'danger',
  won: 'success',
  stage_changed: 'info',
  assigned: 'info',
  note_added: 'neutral',
};
