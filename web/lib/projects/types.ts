export type ProjectPhase = 'pre' | 'during' | 'post';
export type TaskPriority = 'low' | 'med' | 'high';
export type TaskStatus = 'todo' | 'doing' | 'done';

export interface ProjectRow {
  id: string;
  org_id: string;
  project_number: number;
  name: string;
  status: 'active' | 'closed';
  client_id: string | null;
  scope_title: string | null;
  phase: ProjectPhase;
  deadline: string | null;
  lead_id: string | null;
  accent_color: string | null;
  contact_name: string | null;
  contact_email: string | null;
}

export interface TaskRow {
  id: string;
  project_id: string;
  section_name: string | null;
  phase: ProjectPhase;
  title: string;
  assignee_id: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  sort_order: number;
}

export const PHASE_LABEL: Record<ProjectPhase, string> = {
  pre: 'Pre-Job',
  during: 'During Job',
  post: 'Post-Job',
};
