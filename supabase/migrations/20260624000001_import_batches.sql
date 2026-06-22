-- Plan 4 / Task 1 step 2 — import batch tracking.
-- One row per uploaded file. Used for idempotency (same file = same batch),
-- to store the dry-run plan, and to mark commit time.
create type public.import_mode as enum ('balances', 'history');

create table public.import_batches (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id),
  imported_by     uuid not null references public.users(id),
  mode            public.import_mode not null,
  source_filename text not null,
  source_hash     text not null,
  summary         jsonb not null,            -- counts + warnings rendered in UI
  plan_payload    jsonb not null,            -- full plan reused on commit
  created_at      timestamptz not null default now(),
  committed_at    timestamptz,               -- null until commit RPC runs
  applied_count   int,
  skipped_count   int,
  unique (org_id, source_hash, mode)         -- idempotency key
);

create index on public.import_batches(org_id, created_at desc);

alter table public.import_batches enable row level security;

-- Admin-only read.
create policy import_batches_admin_read on public.import_batches
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- No client-side writes: only service_role / SECURITY DEFINER RPC inserts.
revoke insert, update, delete on public.import_batches from authenticated;
