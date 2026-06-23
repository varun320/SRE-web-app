export type MainCategory = 'Project' | 'Admin' | 'Office & Sales';
export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'declined';

export interface SubCategory {
  id: string;
  main_category: MainCategory;
  name: string;
  requires_project: boolean;
  consumes_til: boolean;
  consumes_vacation: boolean;
  is_overtime_taken: boolean;
  sort_order: number;
}

export interface Project {
  id: string;
  project_number: number;
  name: string;
  status: 'active' | 'closed';
}

export interface TimesheetEntryDraft {
  id?: string;
  main_category: MainCategory | '';
  sub_category_id: string | null;
  project_id: string | null;
  mon_hrs: number;
  tue_hrs: number;
  wed_hrs: number;
  thu_hrs: number;
  fri_hrs: number;
  sat_hrs: number;
  sun_hrs: number;
  description: string;
  position: number;
}

export interface Timesheet {
  id: string;
  user_id: string;
  week_start: string;
  status: TimesheetStatus;
  submitted_at: string | null;
  decided_at: string | null;
  decline_reason: string | null;
  locked: boolean;
}
