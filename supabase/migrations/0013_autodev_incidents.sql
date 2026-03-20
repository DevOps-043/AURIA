-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Migration 0013 — Autodev Incident Tracking System                ║
-- ║                                                                    ║
-- ║  Captures runtime errors from the autonomous agent pipeline:       ║
-- ║    • Model/API failures                                            ║
-- ║    • Git push errors                                               ║
-- ║    • Build/lint/test failures                                      ║
-- ║    • Implementation errors (phantom imports, incomplete code)      ║
-- ║    • Stage-level failures and abort events                         ║
-- ╚══════════════════════════════════════════════════════════════════════╝


-- ═══════════════════════════════════════════════════════════════════════
-- 1. ENUM: incident severity
-- ═══════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.incident_severity as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.incident_status as enum ('open', 'acknowledged', 'resolved', 'dismissed');
exception when duplicate_object then null;
end $$;


-- ═══════════════════════════════════════════════════════════════════════
-- 2. TABLE: autodev_incidents
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.autodev_incidents (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.users(id) on delete cascade,
  run_id        text not null,
  stage_id      text,                                    -- nullable: some errors are run-level
  category      text not null check (category in (
    'model_error',           -- AI model/provider failure (rate limit, timeout, bad response)
    'git_error',             -- Git push/pull/branch failure
    'build_error',           -- Build/compile failure
    'lint_error',            -- Linter failure
    'test_error',            -- Test suite failure
    'implementation_error',  -- Phantom imports, incomplete code, major version bumps
    'runtime_error',         -- Internal runtime exception (unexpected crash)
    'abort',                 -- User or system abort
    'validation_error',      -- QA validation failure
    'permission_error'       -- File access, API permission denied
  )),
  severity      public.incident_severity not null default 'medium',
  title         text not null,
  message       text not null,
  metadata      jsonb not null default '{}'::jsonb,      -- stage context, file paths, stack traces, etc.
  status        public.incident_status not null default 'open',
  resolved_at   timestamptz,
  resolved_by   text,                                    -- 'user' | 'aqelor' | null
  created_at    timestamptz not null default now()
);

-- Indexes for common query patterns
create index if not exists idx_incidents_user_recent
  on public.autodev_incidents (user_id, created_at desc);

create index if not exists idx_incidents_run
  on public.autodev_incidents (run_id);

create index if not exists idx_incidents_status_open
  on public.autodev_incidents (user_id, status)
  where status = 'open';

create index if not exists idx_incidents_category
  on public.autodev_incidents (user_id, category, created_at desc);


-- ═══════════════════════════════════════════════════════════════════════
-- 3. RLS: users can only access their own incidents
-- ═══════════════════════════════════════════════════════════════════════

alter table public.autodev_incidents enable row level security;

create policy "users_read_own_incidents"
  on public.autodev_incidents for select
  using (user_id = auth.uid());

create policy "users_insert_own_incidents"
  on public.autodev_incidents for insert
  with check (user_id = auth.uid());

create policy "users_update_own_incidents"
  on public.autodev_incidents for update
  using (user_id = auth.uid());


-- ═══════════════════════════════════════════════════════════════════════
-- 4. CLEANUP: purge incidents older than 90 days
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.cleanup_old_incidents()
returns void
security definer
set search_path = public
as $$
begin
  delete from public.autodev_incidents
  where created_at < now() - interval '90 days'
    and status in ('resolved', 'dismissed');
end;
$$ language plpgsql;
