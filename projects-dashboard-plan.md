# Projects Dashboard — Implementation Plan

**Reference design:** [`design_handoff_sre_projects/`](./design_handoff_sre_projects/) — open `SRE Projects.dc.html` in a browser for interactive prototype. Screenshots in `screenshots/` (01–11).

**Scope:** Lean project-management module for SRE field ops, living as a new nav tab inside SRE Nexus. Recreates the design faithfully — do **not** copy the prototype's HTML/runtime. Rebuild in the app's stack (Next.js + Supabase, matching existing pages like `/clients`).

**Dependencies:**
- Part A bug fixes shipped (see [`next-steps.md`](./next-steps.md)).
- Reuses `clients` table (already exists). Adds `contacts`, `sites`, projects, tasks, templates.
- Independent of Part B (CRM) — but CRM's `Approved → Projects` handoff writes into this module. Design tables so CRM can insert into `projects` cleanly.

---

## Data model (Supabase)

```sql
team_members
  id, user_id (auth.users), name, initials, role, avatar_color
  -- most fields derived from existing employees table; add role + avatar_color here

contacts
  id, client_id (fk clients), name, role, email, phone

sites
  id, client_id (fk clients), name, address, lat, lng
  -- lat/lng already on clients table for map; migrate to sites if a client has >1 location

project_templates
  id, name, description, task_count (computed)

template_sections
  id, template_id (fk), phase (pre|during|post), name, sort_order

template_tasks
  id, section_id (fk), title, default_priority, day_offset (relative to deadline), sort_order

projects
  id, number (SRE-26NN, unique), client_id, site_id, contact_id,
  scope_title, template_id, phase (pre|during|post),
  progress (0-100, computed from tasks),
  deadline, lead_id (fk team_members), accent_color,
  created_at, updated_at
  -- ponytail: progress computed on read; if slow at scale, cache on task update

project_team_members
  project_id, member_id      -- many-to-many

tasks
  id, project_id (fk), section_name, phase, title,
  assignee_id (fk team_members), due_date, priority (high|med|low),
  status (todo|doing|done), sort_order

task_subitems
  id, task_id (fk), title, done, sort_order

task_files
  id, task_id (fk), storage_path, name, uploaded_by, uploaded_at

task_comments
  id, task_id (fk), author_id, body, created_at
```

**RLS:** all authenticated employees can read all rows (shared library). Write access on tasks/projects requires membership on `project_team_members` OR role=admin. Templates: admin-only write, all-read.

**Seed:** import the 4 templates from prototype (Field Sampling Survey with 36 tasks, Amine Unit Study, Desktop Performance Review, Turnaround Support) via a migration + seed script. Team members from existing employees table.

---

## Views (build in this order)

### Phase 1 — foundation (read-only)
1. **Route scaffolding:** `/projects` (dashboard), `/projects/[number]` (detail). New nav tab "Projects".
2. **Design tokens:** add SRE gold/charcoal palette + Arial stack + 2px gold rule utility to global CSS. Match tokens listed in `design_handoff_sre_projects/README.md` §Design Tokens exactly.
3. **Dashboard** (`01-dashboard.png`): KPI strip, week rail, my priorities, team workload, active jobs table. All reads.
4. **Job Detail** (`09-job-detail.png`): header card with progress ring, meta row, tasks grouped by phase. Read-only.

### Phase 2 — task interactions
5. **Task Drawer** (`10-task-drawer.png`): right slide-over on any task click. Reassign, re-date, re-prioritize, tick subitems, add comments, upload files (Supabase Storage).
6. **My Tasks** (`02-my-tasks.png`): bucketed by overdue/today/week/later/completed.
7. **Task List** (`03-task-list.png`): grouped by phase, filter chips per job.
8. **Board** (`04-board.png`): Kanban 3-column (To Do / In Progress / Done). **Add drag-to-change-status** (prototype has none — use `@dnd-kit/core`).
9. **Calendar** (`05-calendar.png`): month grid, tasks as chips per day, click → drawer.

### Phase 3 — create/edit flows
10. **New Job modal** (`11-new-job-modal.png`): server action generates project + all template tasks (assignee=lead, due dates staggered by `day_offset` relative to deadline). Inline "+ Add client/site/contact" writes to Directory.
11. **Edit Job** inline panel on Job Detail: lead, deadline, team chips, contact. Invariant: lead must stay in team; removing lead-member reassigns lead to first remaining.

### Phase 4 — shared libraries
12. **Directory** (`07-directory.png`): shared company/contact library (CRM base). Reuses `clients` table + new `contacts`/`sites`. Inline add forms. **This is the same data CRM Part B will read** — build here first.
13. **Templates** (`08-templates.png`): admin-only edit; all-user read. "Start job from this" → opens New Job modal preset.
14. **Team Workload** (`06-team-workload.png`): per-member card with load bar + task list.

---

## Component reuse

- Existing `ClientsTable`, `ClientForm` patterns → reference for `ProjectsTable`, `ProjectForm`.
- Existing role-based rendering (admin vs employee) — reuse `canEdit` prop pattern from clients page.
- Existing Supabase server-action pattern (`app/(app)/clients/actions.ts`) → mirror for projects.

---

## Deviations from prototype (intentional)

- Prototype uses `dueDay` (integer day-of-July). **Use real ISO dates** + derive labels/urgency.
- Prototype has no drag on Board. **Add drag-to-change-status.**
- Prototype comments/files are visual placeholders. **Implement real** (Supabase Storage for files).
- Prototype search is placeholder. **Wire it** — server-side ILIKE on project number, client name, scope title.
- Prototype in-memory state → Supabase + React Query (or Next.js server components + revalidatePath, matching how `/clients` is built).

---

## CRM handoff contract (for Part B)

When CRM Part B lands, it will call:
```ts
createProjectFromApprovedLead(leadId): Promise<{ projectNumber: string }>
```
This function:
1. Reads lead + client + site + contact + PO doc.
2. Inserts `projects` row with `template_id` chosen by scope (default: `field_sampling_survey`).
3. Generates tasks from template.
4. Bundles emails (via Claude MCP) into `Emails` SharePoint folder.
5. Returns project number for CRM to link.

Build this stub as no-op in Phase 3; wire live in Part B step 6.

---

## Open questions (surface with Maaz + Utsav before Phase 3)

- Project number format: `SRE-26NN` in prototype, `SRE-2601` in Utsav's actual folders. Confirm.
- Site vs Client: prototype has sites nested under clients. Current `clients` table has one lat/lng per client. Migration path needed — either add `sites` and keep `clients.lat/lng` as "primary site" pointer, or split fully.
- Who can create templates? Admin only, or any engineer?
- Deadline urgency threshold: prototype uses ≤2 days for ⚠. Keep or make configurable?
