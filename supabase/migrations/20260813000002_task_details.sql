-- Task detail model: subitems (checklist), comments, attachments.
-- Reference design (10-task-drawer.png) shows all three below the top-level
-- task fields. Access follows tasks: any team member on the parent project
-- can read/write; admins can read/write everything.

-- Reuse the tasks RLS predicate: team-member OR admin — implemented inline
-- against public.tasks so we don't have to duplicate the check in three
-- policies.

create table if not exists public.task_subitems (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  title        text not null,
  done         boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.users(id)
);
create index if not exists task_subitems_task_idx on public.task_subitems(task_id, sort_order);

create table if not exists public.task_comments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  body         text not null,
  created_at   timestamptz not null default now(),
  created_by   uuid not null references public.users(id)
);
create index if not exists task_comments_task_idx on public.task_comments(task_id, created_at);

create table if not exists public.task_attachments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  storage_path text not null,           -- 'task-attachments/{task_id}/{yyyymmdd}-{uuid}.{ext}'
  filename     text not null,
  mime_type    text,
  size_bytes   bigint,
  uploaded_at  timestamptz not null default now(),
  uploaded_by  uuid not null references public.users(id)
);
create index if not exists task_attachments_task_idx on public.task_attachments(task_id, uploaded_at);

alter table public.task_subitems     enable row level security;
alter table public.task_comments     enable row level security;
alter table public.task_attachments  enable row level security;

-- Shared predicate: allowed when caller is admin or on the parent task's
-- project team. Inlined to keep the migration self-contained.
create or replace function public.can_touch_task(p_task_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and t.org_id = public.current_user_org()
      and (
        public.is_admin(auth.uid())
        or exists (
          select 1 from public.project_team_members m
          where m.project_id = t.project_id and m.user_id = auth.uid()
        )
        or t.assignee_id = auth.uid()
      )
  );
$$;

create policy task_subitems_all on public.task_subitems
  for all to authenticated
  using (public.can_touch_task(task_id))
  with check (public.can_touch_task(task_id) and org_id = public.current_user_org());

create policy task_comments_all on public.task_comments
  for all to authenticated
  using (public.can_touch_task(task_id))
  with check (public.can_touch_task(task_id) and org_id = public.current_user_org());

create policy task_attachments_all on public.task_attachments
  for all to authenticated
  using (public.can_touch_task(task_id))
  with check (public.can_touch_task(task_id) and org_id = public.current_user_org());

-- Storage bucket for attachments. Path: task-attachments/{task_id}/{...}
-- RLS on storage.objects delegates to can_touch_task via the second path
-- segment (the task_id).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  26214400,  -- 25 MB — bigger than receipts because task attachments include PDFs, xlsx, docs
  null       -- accept any mime type; task attachments cover a broader surface
)
on conflict (id) do nothing;

create policy task_attachments_select on storage.objects
  for select to authenticated using (
    bucket_id = 'task-attachments'
    and public.can_touch_task((split_part(name, '/', 1))::uuid)
  );

create policy task_attachments_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'task-attachments'
    and public.can_touch_task((split_part(name, '/', 1))::uuid)
  );

create policy task_attachments_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'task-attachments'
    and public.can_touch_task((split_part(name, '/', 1))::uuid)
  );
