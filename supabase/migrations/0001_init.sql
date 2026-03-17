-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  AURIA — Schema v2 (Redesigned)                                    ║
-- ║  Follows Codd's relational rules, 3NF+, CHECK constraints on all   ║
-- ║  enum-like columns, proper FK cascades, composite indexes for hot   ║
-- ║  query paths, RLS-ready, and auto-updated timestamps.              ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ─── Extensions ─────────────────────────────────────────────────────────
create extension if not exists pgcrypto;
create extension if not exists vector;

-- ─── Helper: auto-update updated_at on every UPDATE ─────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. IDENTITY & ACCESS
-- ═══════════════════════════════════════════════════════════════════════

-- La contraseña NO se almacena aquí: Supabase Auth (auth.users) la gestiona
-- internamente con bcrypt. Esta tabla extiende el perfil público del usuario.
create table public.users (
  id              uuid primary key references auth.users (id) on delete cascade,

  -- ─── Contacto & autenticación ─────────────────────────────────────
  email           text not null unique,
  phone           text unique,
  phone_verified  boolean not null default false,

  -- ─── Identidad personal ───────────────────────────────────────────
  first_name      text not null default '',
  last_name       text not null default '',
  display_name    text,  -- computed via trigger (see trg_users_display_name)
  avatar_url      text,
  date_of_birth   date check (
    date_of_birth is null
    or date_of_birth <= '2013-01-01'::date  -- minimum 13 years; updated by scheduled job
  ),
  gender          text check (gender is null or gender in (
    'male', 'female', 'non_binary', 'prefer_not_to_say'
  )),

  -- ─── Ubicación & regionalización ──────────────────────────────────
  country_code    text check (country_code is null or length(country_code) = 2),
  city            text,
  locale          text not null default 'es',
  timezone        text not null default 'America/Mexico_City',

  -- ─── Profesional ──────────────────────────────────────────────────
  company_name    text,
  job_title       text,
  industry        text,
  github_username text,
  linkedin_url    text,
  website_url     text,

  -- ─── Plataforma ───────────────────────────────────────────────────
  onboarding_completed boolean not null default false,
  marketing_consent    boolean not null default false,
  terms_accepted_at    timestamptz,
  last_login_at        timestamptz,
  login_count          integer not null default 0 check (login_count >= 0),
  referral_source      text check (referral_source is null or referral_source in (
    'organic', 'referral', 'social', 'ad', 'event', 'other'
  )),
  referred_by          uuid references public.users (id) on delete set null,
  bio                  text check (bio is null or length(bio) <= 500),
  is_active            boolean not null default true,
  deactivated_at       timestamptz,

  -- ─── Preferencias de notificación ─────────────────────────────────
  notify_email         boolean not null default true,
  notify_push          boolean not null default true,
  notify_sms           boolean not null default false,

  -- ─── Timestamps ───────────────────────────────────────────────────
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- Auto-compute display_name from first_name, last_name, email
create or replace function public.compute_display_name()
returns trigger as $$
begin
  if new.first_name = '' and new.last_name = '' then
    new.display_name := split_part(new.email, '@', 1);
  elsif new.last_name = '' then
    new.display_name := new.first_name;
  else
    new.display_name := new.first_name || ' ' || new.last_name;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_users_display_name before insert or update on public.users
  for each row execute function public.compute_display_name();

create index idx_users_phone on public.users (phone) where phone is not null;
create index idx_users_active on public.users (is_active) where is_active = true;
create index idx_users_country on public.users (country_code) where country_code is not null;
create index idx_users_referred_by on public.users (referred_by) where referred_by is not null;

-- API keys for external service integration (Gemini, GitHub, etc.)
create table public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  provider      text not null check (provider in (
    'gemini', 'openai', 'anthropic', 'github', 'custom'
  )),
  label         text not null default 'default',
  encrypted_key text not null,
  is_active     boolean not null default true,
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, provider, label)
);

create trigger trg_api_keys_updated_at before update on public.api_keys
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 2. BILLING & SUBSCRIPTIONS
-- ═══════════════════════════════════════════════════════════════════════

create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.users (id) on delete cascade,
  provider_customer_id      text,
  provider_subscription_id  text,
  plan_code                 text not null check (plan_code in (
    'free', 'starter', 'pro', 'enterprise'
  )),
  status                    text not null check (status in (
    'trialing', 'active', 'past_due', 'canceled', 'paused', 'unpaid'
  )),
  billing_cycle             text not null check (billing_cycle in (
    'monthly', 'yearly'
  )),
  max_repositories          integer not null default 1
    check (max_repositories >= 1),
  max_agents                integer not null default 5
    check (max_agents >= 1 and max_agents <= 50),
  budget_limit_usd          numeric(12, 2) not null default 0
    check (budget_limit_usd >= 0),
  trial_ends_at             timestamptz,
  current_period_start      timestamptz not null default now(),
  current_period_end        timestamptz not null default (now() + interval '30 days'),
  canceled_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger trg_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create index idx_subscriptions_user on public.subscriptions (user_id);
create index idx_subscriptions_status on public.subscriptions (status);

create table public.billing_events (
  id                  uuid primary key default gen_random_uuid(),
  subscription_id     uuid not null references public.subscriptions (id) on delete cascade,
  event_type          text not null check (event_type in (
    'payment_succeeded', 'payment_failed', 'subscription_created',
    'subscription_updated', 'subscription_canceled', 'refund',
    'trial_started', 'trial_ended', 'invoice_created'
  )),
  provider_event_id   text unique,
  amount_usd          numeric(12, 2)
    check (amount_usd is null or amount_usd >= 0),
  currency            text not null default 'usd',
  payload             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index idx_billing_events_subscription on public.billing_events (subscription_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. WORKSPACES & TEAM
-- ═══════════════════════════════════════════════════════════════════════

create table public.workspaces (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.users (id) on delete cascade,
  subscription_id       uuid references public.subscriptions (id) on delete set null,
  name                  text not null,
  slug                  text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]$'),
  mode                  text not null check (mode in ('cloud', 'local', 'hybrid')),
  vision                text not null default '',
  max_concurrent_agents integer not null default 5
    check (max_concurrent_agents >= 1 and max_concurrent_agents <= 50),
  is_archived           boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger trg_workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

create index idx_workspaces_owner on public.workspaces (owner_id);
create index idx_workspaces_active on public.workspaces (owner_id)
  where is_archived = false;

-- Team collaboration: workspace members beyond the owner
create table public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  role         text not null check (role in ('admin', 'editor', 'viewer')),
  invited_by   uuid references public.users (id) on delete set null,
  joined_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index idx_workspace_members_user on public.workspace_members (user_id);

-- Workspace-level objectives configuration (normalized from snapshot JSONB)
create table public.workspace_objectives (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  objective    text not null check (objective in (
    'quality', 'security', 'technicalDebt', 'dependencies',
    'coverage', 'documentation', 'performance', 'innovation', 'research'
  )),
  enabled      boolean not null default true,
  intensity    integer not null default 50
    check (intensity >= 0 and intensity <= 100),
  target       text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, objective)
);

create trigger trg_workspace_objectives_updated_at before update on public.workspace_objectives
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 4. REPOSITORIES & POLICIES
-- ═══════════════════════════════════════════════════════════════════════

create table public.repositories (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  provider        text not null check (provider in (
    'github', 'gitlab', 'bitbucket', 'local'
  )),
  external_id     text not null,
  full_name       text not null,
  default_branch  text not null default 'main',
  primary_branch  text not null default 'main',
  local_path      text,
  language        text,
  is_monorepo     boolean not null default false,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, external_id)
);

create trigger trg_repositories_updated_at before update on public.repositories
  for each row execute function public.set_updated_at();

create index idx_repositories_workspace on public.repositories (workspace_id);

create table public.repository_connections (
  id              uuid primary key default gen_random_uuid(),
  repository_id   uuid not null unique references public.repositories (id) on delete cascade,
  connection_mode text not null check (connection_mode in (
    'clone', 'mount', 'api_only'
  )),
  sync_state      text not null default 'pending' check (sync_state in (
    'pending', 'syncing', 'synced', 'error'
  )),
  last_synced_at  timestamptz,
  error_message   text,
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_repository_connections_updated_at before update on public.repository_connections
  for each row execute function public.set_updated_at();

create table public.repository_policies (
  id                          uuid primary key default gen_random_uuid(),
  repository_id               uuid not null unique references public.repositories (id) on delete cascade,
  autonomy_mode               text not null check (autonomy_mode in (
    'proposal', 'pull_request', 'guarded_autonomy'
  )),
  require_human_review_above  text not null check (require_human_review_above in (
    'low', 'moderate', 'high', 'critical'
  )),
  max_lines_per_mission       integer not null default 500
    check (max_lines_per_mission > 0),
  max_lines_per_file          integer not null default 300
    check (max_lines_per_file > 0),
  max_files_touched           integer not null default 20
    check (max_files_touched > 0),
  max_concurrent_agents       integer not null default 5
    check (max_concurrent_agents >= 1 and max_concurrent_agents <= 50),
  monthly_budget_usd          numeric(12, 2) not null default 50.00
    check (monthly_budget_usd >= 0),
  execution_window            text not null default '24/7',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger trg_repository_policies_updated_at before update on public.repository_policies
  for each row execute function public.set_updated_at();

create table public.repository_paths (
  id            uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories (id) on delete cascade,
  path          text not null,
  path_type     text not null check (path_type in ('allowed', 'blocked', 'critical')),
  created_at    timestamptz not null default now(),
  unique (repository_id, path, path_type)
);

create index idx_repository_paths_repo on public.repository_paths (repository_id, path_type);

create table public.repository_blocked_file_types (
  id            uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories (id) on delete cascade,
  extension     text not null,
  created_at    timestamptz not null default now(),
  unique (repository_id, extension)
);

-- ═══════════════════════════════════════════════════════════════════════
-- 5. KNOWLEDGE BASE & DOCUMENTS
-- ═══════════════════════════════════════════════════════════════════════

create table public.repository_memory_profiles (
  id                  uuid primary key default gen_random_uuid(),
  repository_id       uuid not null unique references public.repositories (id) on delete cascade,
  semantic_model      text not null default 'text-embedding-3-small',
  chunking_strategy   text not null default 'recursive' check (chunking_strategy in (
    'recursive', 'fixed', 'semantic', 'code_aware'
  )),
  memory_depth        text not null default 'layered' check (memory_depth in (
    'shallow', 'layered', 'deep'
  )),
  graph_enabled       boolean not null default true,
  cold_storage_bucket text not null default 'cold-memory',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger trg_repository_memory_profiles_updated_at before update on public.repository_memory_profiles
  for each row execute function public.set_updated_at();

create table public.uploaded_documents (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  repository_id       uuid references public.repositories (id) on delete cascade,
  name                text not null,
  document_type       text not null check (document_type in (
    'product', 'technical', 'operations', 'architecture', 'runbook', 'roadmap'
  )),
  status              text not null default 'processing' check (status in (
    'processing', 'ready', 'stale', 'error'
  )),
  storage_path        text not null,
  version             text not null default '1.0',
  use_for_analysis    boolean not null default true,
  use_for_innovation  boolean not null default false,
  size_bytes          bigint not null default 0
    check (size_bytes >= 0),
  token_count         integer not null default 0
    check (token_count >= 0),
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger trg_uploaded_documents_updated_at before update on public.uploaded_documents
  for each row execute function public.set_updated_at();

create index idx_uploaded_documents_workspace on public.uploaded_documents (workspace_id);
create index idx_uploaded_documents_analysis on public.uploaded_documents (workspace_id, status, use_for_analysis);

create table public.document_chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.uploaded_documents (id) on delete cascade,
  chunk_index   integer not null check (chunk_index >= 0),
  token_count   integer not null default 0 check (token_count >= 0),
  content       text not null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index idx_document_chunks_document on public.document_chunks (document_id, chunk_index);

create table public.document_embeddings (
  id                uuid primary key default gen_random_uuid(),
  document_chunk_id uuid not null unique references public.document_chunks (id) on delete cascade,
  embedding         vector(1536) not null,
  created_at        timestamptz not null default now()
);

create table public.document_links (
  id                  uuid primary key default gen_random_uuid(),
  document_id         uuid not null references public.uploaded_documents (id) on delete cascade,
  linked_entity_type  text not null check (linked_entity_type in (
    'mission', 'finding', 'memory_entry', 'research_session'
  )),
  linked_entity_id    uuid not null,
  relationship        text not null check (relationship in (
    'references', 'derived_from', 'supports', 'contradicts'
  )),
  created_at          timestamptz not null default now()
);

create index idx_document_links_document on public.document_links (document_id);
create index idx_document_links_entity on public.document_links (linked_entity_type, linked_entity_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 6. AGENTS & MODEL ROUTING
-- ═══════════════════════════════════════════════════════════════════════

create table public.agent_profiles (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  role                  text not null check (role in (
    'planner', 'risk', 'research', 'review', 'test', 'debt',
    'security', 'dependency', 'coverage', 'docs', 'performance',
    'refactor', 'innovation', 'verification', 'memory'
  )),
  primary_model         text not null,
  fallback_model        text,
  external_tools_enabled boolean not null default false,
  depth                 text not null default 'balanced' check (depth in (
    'focused', 'balanced', 'deep'
  )),
  cost_policy           text not null default 'balanced' check (cost_policy in (
    'efficient', 'balanced', 'premium'
  )),
  latency_policy        text not null default 'balanced' check (latency_policy in (
    'fast', 'balanced', 'deliberate'
  )),
  parallelism           integer not null default 1
    check (parallelism >= 1 and parallelism <= 15),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (workspace_id, role)
);

create trigger trg_agent_profiles_updated_at before update on public.agent_profiles
  for each row execute function public.set_updated_at();

-- Model router: per-workspace settings for how each role maps to models
create table public.model_router_configs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  role_key        text not null check (role_key in (
    'planning', 'implementation', 'research', 'review', 'risk', 'memory'
  )),
  primary_model   text not null,
  fallback_model  text not null,
  external_tools  boolean not null default false,
  depth           text not null default 'balanced' check (depth in (
    'focused', 'balanced', 'deep'
  )),
  parallelism     integer not null default 1
    check (parallelism >= 1 and parallelism <= 15),
  cost_policy     text not null default 'balanced' check (cost_policy in (
    'efficient', 'balanced', 'premium'
  )),
  latency_policy  text not null default 'balanced' check (latency_policy in (
    'fast', 'balanced', 'deliberate'
  )),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, role_key)
);

create trigger trg_model_router_configs_updated_at before update on public.model_router_configs
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 7. MISSIONS & EXECUTION
-- ═══════════════════════════════════════════════════════════════════════

create table public.missions (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  repository_id     uuid not null references public.repositories (id) on delete cascade,
  objective         text not null check (objective in (
    'quality', 'security', 'technicalDebt', 'dependencies',
    'coverage', 'documentation', 'performance', 'innovation', 'research'
  )),
  title             text not null,
  summary           text,
  status            text not null default 'discovered' check (status in (
    'discovered', 'analyzing', 'researching', 'executing',
    'validating', 'review', 'blocked', 'completed'
  )),
  risk_level        text not null default 'low' check (risk_level in (
    'low', 'moderate', 'high', 'critical'
  )),
  autonomy_mode     text not null default 'proposal' check (autonomy_mode in (
    'proposal', 'pull_request', 'guarded_autonomy'
  )),
  changed_lines     integer not null default 0
    check (changed_lines >= 0),
  estimated_cost_usd numeric(12, 2) not null default 0
    check (estimated_cost_usd >= 0),
  actual_cost_usd   numeric(12, 2)
    check (actual_cost_usd is null or actual_cost_usd >= 0),
  blocked_reason    text,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_missions_updated_at before update on public.missions
  for each row execute function public.set_updated_at();

create index idx_missions_workspace_status on public.missions (workspace_id, status);
create index idx_missions_active on public.missions (workspace_id, status);
create index idx_missions_repository on public.missions (repository_id, status);

-- Files touched by a mission (normalized from integer counter)
create table public.mission_files (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.missions (id) on delete cascade,
  file_path   text not null,
  operation   text not null default 'modified' check (operation in (
    'added', 'modified', 'deleted', 'renamed'
  )),
  lines_added   integer not null default 0 check (lines_added >= 0),
  lines_removed integer not null default 0 check (lines_removed >= 0),
  created_at  timestamptz not null default now(),
  unique (mission_id, file_path)
);

create index idx_mission_files_mission on public.mission_files (mission_id);

create table public.mission_tasks (
  id                      uuid primary key default gen_random_uuid(),
  mission_id              uuid not null references public.missions (id) on delete cascade,
  assigned_agent_profile_id uuid references public.agent_profiles (id) on delete set null,
  title                   text not null,
  status                  text not null default 'pending' check (status in (
    'pending', 'running', 'completed', 'failed', 'skipped'
  )),
  priority                integer not null default 0
    check (priority >= 0),
  payload                 jsonb not null default '{}'::jsonb,
  started_at              timestamptz,
  completed_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger trg_mission_tasks_updated_at before update on public.mission_tasks
  for each row execute function public.set_updated_at();

create index idx_mission_tasks_mission on public.mission_tasks (mission_id, status);

create table public.mission_events (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.missions (id) on delete cascade,
  task_id     uuid references public.mission_tasks (id) on delete set null,
  event_type  text not null check (event_type in (
    'status_change', 'phase_change', 'agent_assigned', 'agent_released',
    'guard_passed', 'guard_failed', 'build_started', 'build_passed',
    'build_failed', 'review_requested', 'review_completed',
    'pr_created', 'pr_merged', 'error', 'notification',
    'user_feedback', 'micro_fix_triggered'
  )),
  message     text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index idx_mission_events_mission on public.mission_events (mission_id, created_at desc);
create index idx_mission_events_type on public.mission_events (event_type, created_at desc);

create table public.mission_artifacts (
  id            uuid primary key default gen_random_uuid(),
  mission_id    uuid not null references public.missions (id) on delete cascade,
  artifact_type text not null check (artifact_type in (
    'diff', 'log', 'screenshot', 'report', 'code_snippet'
  )),
  storage_path  text not null,
  size_bytes    bigint not null default 0
    check (size_bytes >= 0),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index idx_mission_artifacts_mission on public.mission_artifacts (mission_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 8. PR & REVIEW PIPELINE
-- ═══════════════════════════════════════════════════════════════════════

create table public.pull_request_candidates (
  id              uuid primary key default gen_random_uuid(),
  mission_id      uuid not null unique references public.missions (id) on delete cascade,
  branch_name     text not null,
  base_branch     text not null default 'main',
  title           text not null,
  description     text,
  review_state    text not null default 'pending' check (review_state in (
    'pending', 'approved', 'needs_changes', 'merged', 'closed'
  )),
  external_pr_url text,
  external_pr_number integer,
  mergeable       boolean,
  reviewed_by     uuid references public.users (id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_pull_request_candidates_updated_at before update on public.pull_request_candidates
  for each row execute function public.set_updated_at();

create index idx_pr_candidates_review on public.pull_request_candidates (review_state);

-- ═══════════════════════════════════════════════════════════════════════
-- 9. QUALITY: FINDINGS & VALIDATIONS
-- ═══════════════════════════════════════════════════════════════════════

create table public.findings (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.missions (id) on delete cascade,
  severity    text not null check (severity in (
    'info', 'low', 'moderate', 'high', 'critical'
  )),
  category    text not null check (category in (
    'security', 'quality', 'performance', 'dependencies',
    'tests', 'documentation', 'accessibility'
  )),
  title       text not null,
  description text,
  file_path   text,
  line_start  integer check (line_start is null or line_start > 0),
  line_end    integer check (line_end is null or line_end >= line_start),
  evidence    jsonb not null default '{}'::jsonb,
  resolved    boolean not null default false,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_findings_mission on public.findings (mission_id);
create index idx_findings_unresolved on public.findings (mission_id)
  where resolved = false;

create table public.validations (
  id                uuid primary key default gen_random_uuid(),
  mission_id        uuid not null references public.missions (id) on delete cascade,
  validation_type   text not null check (validation_type in (
    'typecheck', 'lint', 'test', 'build', 'security_scan',
    'dependency_audit', 'custom'
  )),
  status            text not null check (status in (
    'pending', 'running', 'passed', 'failed', 'skipped'
  )),
  exit_code         integer,
  output            text,
  duration_ms       integer check (duration_ms is null or duration_ms >= 0),
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index idx_validations_mission on public.validations (mission_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 10. RESEARCH & EXTERNAL INTELLIGENCE
-- ═══════════════════════════════════════════════════════════════════════

create table public.research_sessions (
  id            uuid primary key default gen_random_uuid(),
  mission_id    uuid references public.missions (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  agent_role    text check (agent_role is null or agent_role in (
    'planner', 'risk', 'research', 'review', 'test', 'debt',
    'security', 'dependency', 'coverage', 'docs', 'performance',
    'refactor', 'innovation', 'verification', 'memory'
  )),
  query         text not null,
  tool_name     text not null check (tool_name in (
    'web_search', 'npm_audit', 'npm_outdated', 'npm_verify',
    'read_webpage', 'code_search', 'custom'
  )),
  summary       text,
  actionable    boolean not null default false,
  tokens_used   integer not null default 0 check (tokens_used >= 0),
  created_at    timestamptz not null default now()
);

create index idx_research_sessions_mission on public.research_sessions (mission_id);
create index idx_research_sessions_workspace on public.research_sessions (workspace_id, created_at desc);

create table public.external_sources (
  id                    uuid primary key default gen_random_uuid(),
  research_session_id   uuid not null references public.research_sessions (id) on delete cascade,
  title                 text not null,
  url                   text not null,
  source_type           text check (source_type is null or source_type in (
    'documentation', 'stackoverflow', 'github_issue', 'blog',
    'npm_registry', 'security_advisory', 'other'
  )),
  snippet               text,
  relevance_score       numeric(3, 2) check (
    relevance_score is null or (relevance_score >= 0 and relevance_score <= 1)
  ),
  created_at            timestamptz not null default now()
);

create index idx_external_sources_session on public.external_sources (research_session_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 11. LEARNING & MEMORY
-- ═══════════════════════════════════════════════════════════════════════

create table public.error_lessons (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  mission_id    uuid references public.missions (id) on delete set null,
  pattern_key   text not null,
  lesson        text not null,
  mitigation    text,
  severity      text not null check (severity in (
    'low', 'moderate', 'high', 'critical'
  )),
  occurrences   integer not null default 1 check (occurrences >= 1),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_error_lessons_updated_at before update on public.error_lessons
  for each row execute function public.set_updated_at();

create index idx_error_lessons_workspace on public.error_lessons (workspace_id);
create unique index idx_error_lessons_pattern on public.error_lessons (workspace_id, pattern_key);

create table public.memory_entries (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  repository_id uuid references public.repositories (id) on delete cascade,
  source_type   text not null check (source_type in (
    'mission', 'retrospective', 'self_learning', 'user_feedback',
    'error_lesson', 'strategy', 'system'
  )),
  source_id     uuid,
  memory_kind   text not null check (memory_kind in (
    'errors', 'patterns', 'decisions', 'hotspots', 'recommendations',
    'roadmap_goal', 'capability', 'retrospective', 'user_pattern',
    'rejected_idea', 'hotspot'
  )),
  title         text not null,
  summary       text not null,
  strength      text not null check (strength in (
    'emerging', 'stable', 'fragile', 'critical'
  )),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_memory_entries_updated_at before update on public.memory_entries
  for each row execute function public.set_updated_at();

create index idx_memory_entries_workspace on public.memory_entries (workspace_id, memory_kind);
create index idx_memory_entries_active on public.memory_entries (workspace_id)
  where is_active = true;

create table public.memory_embeddings (
  id              uuid primary key default gen_random_uuid(),
  memory_entry_id uuid not null unique references public.memory_entries (id) on delete cascade,
  embedding       vector(1536) not null,
  created_at      timestamptz not null default now()
);

create table public.memory_links (
  id                  uuid primary key default gen_random_uuid(),
  memory_entry_id     uuid not null references public.memory_entries (id) on delete cascade,
  related_entity_type text not null check (related_entity_type in (
    'mission', 'finding', 'document', 'research_session',
    'worker_run', 'error_lesson', 'memory_entry'
  )),
  related_entity_id   uuid not null,
  relationship        text not null check (relationship in (
    'caused_by', 'resolved_by', 'relates_to', 'derived_from',
    'contradicts', 'supersedes'
  )),
  created_at          timestamptz not null default now()
);

create index idx_memory_links_entry on public.memory_links (memory_entry_id);
create index idx_memory_links_related on public.memory_links (related_entity_type, related_entity_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 12. STRATEGIC MEMORY (Strategy Selector inputs)
-- ═══════════════════════════════════════════════════════════════════════

-- Roadmap goals that guide strategy selection
create table public.strategic_goals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  title         text not null,
  description   text not null,
  area          text not null check (area in (
    'whatsapp', 'automation', 'computer-use', 'integrations',
    'infrastructure', 'ux', 'security', 'autodev'
  )),
  priority      text not null default 'medium' check (priority in (
    'critical', 'high', 'medium', 'low'
  )),
  status        text not null default 'pending' check (status in (
    'pending', 'in_progress', 'completed', 'abandoned'
  )),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_strategic_goals_updated_at before update on public.strategic_goals
  for each row execute function public.set_updated_at();

create index idx_strategic_goals_workspace on public.strategic_goals (workspace_id, status);
create index idx_strategic_goals_active on public.strategic_goals (workspace_id, status);

-- NOTE: strategic_goal_runs is defined after worker_runs (section 13)
-- to satisfy FK dependency ordering.

-- Capabilities tracked by the system
create table public.capability_entries (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null,
  description   text not null,
  status        text not null default 'missing' check (status in (
    'functional', 'partial', 'broken', 'missing'
  )),
  files         text[] not null default '{}',
  gaps          text[] not null default '{}',
  last_verified timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, name)
);

create trigger trg_capability_entries_updated_at before update on public.capability_entries
  for each row execute function public.set_updated_at();

create index idx_capability_entries_workspace on public.capability_entries (workspace_id, status);

-- User patterns detected by self-learning
create table public.user_patterns (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  pattern       text not null,
  category      text not null check (category in (
    'complaint', 'request', 'suggestion', 'praise'
  )),
  frequency     integer not null default 1 check (frequency >= 1),
  addressed     boolean not null default false,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_user_patterns_updated_at before update on public.user_patterns
  for each row execute function public.set_updated_at();

create index idx_user_patterns_workspace on public.user_patterns (workspace_id);
create index idx_user_patterns_unaddressed on public.user_patterns (workspace_id)
  where addressed = false and frequency >= 2;

-- ═══════════════════════════════════════════════════════════════════════
-- 13. WORKER ENGINE (Autonomous pipeline)
-- ═══════════════════════════════════════════════════════════════════════

create table public.worker_configs (
  id                          uuid primary key default gen_random_uuid(),
  workspace_id                uuid not null unique references public.workspaces (id) on delete cascade,
  enabled                     boolean not null default false,
  cron_schedule               text not null default '0 3 * * *',
  max_daily_runs              integer not null default 3
    check (max_daily_runs >= 1 and max_daily_runs <= 50),
  max_daily_micro_runs        integer not null default 5
    check (max_daily_micro_runs >= 1 and max_daily_micro_runs <= 100),
  micro_fix_enabled           boolean not null default true,
  micro_fix_debounce_minutes  integer not null default 3
    check (micro_fix_debounce_minutes >= 0),
  work_branch_prefix          text not null default 'auria/',
  auto_merge                  boolean not null default false,
  require_build_pass          boolean not null default true,
  max_files_per_run           integer not null default 30
    check (max_files_per_run >= 1),
  max_lines_changed           integer not null default 2000
    check (max_lines_changed >= 1),
  max_research_queries        integer not null default 30
    check (max_research_queries >= 1),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger trg_worker_configs_updated_at before update on public.worker_configs
  for each row execute function public.set_updated_at();

create table public.worker_runs (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  mission_id          uuid references public.missions (id) on delete set null,
  mode                text not null check (mode in ('full', 'micro')),
  strategy            text check (strategy is null or strategy in (
    'innovation', 'deep-improvement', 'user-driven',
    'gap-filling', 'integration', 'resilience'
  )),
  status              text not null default 'running' check (status in (
    'running', 'completed', 'failed', 'aborted'
  )),
  current_phase       text,
  branch_name         text,
  pr_url              text,
  improvements_count  integer not null default 0
    check (improvements_count >= 0),
  summary             text,
  error               text,
  tokens_used         bigint not null default 0
    check (tokens_used >= 0),
  cost_usd            numeric(12, 2) not null default 0
    check (cost_usd >= 0),
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index idx_worker_runs_workspace_status on public.worker_runs (workspace_id, status);
create index idx_worker_runs_recent on public.worker_runs (workspace_id, started_at desc);
-- Daily limit checks: use range filter (started_at >= date_trunc('day', now()))
-- instead of expression index, because timestamptz→date cast is not immutable.
create index idx_worker_runs_daily on public.worker_runs (workspace_id, mode, started_at);

-- Improvements produced by a worker run
create table public.worker_run_improvements (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references public.worker_runs (id) on delete cascade,
  file_path       text not null,
  category        text not null check (category in (
    'security', 'quality', 'performance', 'dependencies', 'tests', 'features'
  )),
  description     text not null,
  diff            text,
  applied         boolean not null default false,
  agent_role      text not null check (agent_role in (
    'planner', 'risk', 'research', 'review', 'test', 'debt',
    'security', 'dependency', 'coverage', 'docs', 'performance',
    'refactor', 'innovation', 'verification', 'memory'
  )),
  created_at      timestamptz not null default now()
);

create index idx_worker_run_improvements_run on public.worker_run_improvements (run_id);

-- Research sources linked to a worker run improvement
create table public.worker_run_improvement_sources (
  improvement_id uuid not null references public.worker_run_improvements (id) on delete cascade,
  source_url     text not null,
  primary key (improvement_id, source_url)
);

-- Safety guard results per run
create table public.worker_run_guards (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.worker_runs (id) on delete cascade,
  guard_name  text not null,
  passed      boolean not null,
  reason      text not null,
  phase       text,
  checked_at  timestamptz not null default now()
);

create index idx_worker_run_guards_run on public.worker_run_guards (run_id);
create index idx_worker_run_guards_failed on public.worker_run_guards (run_id)
  where passed = false;

-- Run retrospectives (post-run self-evaluation)
create table public.run_retrospectives (
  id                        uuid primary key default gen_random_uuid(),
  run_id                    uuid not null unique references public.worker_runs (id) on delete cascade,
  workspace_id              uuid not null references public.workspaces (id) on delete cascade,
  strategy                  text not null check (strategy in (
    'innovation', 'deep-improvement', 'user-driven',
    'gap-filling', 'integration', 'resilience'
  )),
  intent                    text not null,
  outcome                   text not null,
  impact_score              integer not null check (impact_score >= 1 and impact_score <= 5),
  lessons                   text[] not null default '{}',
  mistakes                  text[] not null default '{}',
  orphaned_files            text[] not null default '{}',
  real_improvements_count   integer not null default 0
    check (real_improvements_count >= 0),
  duration_minutes          numeric(8, 2) not null default 0
    check (duration_minutes >= 0),
  created_at                timestamptz not null default now()
);

create index idx_run_retrospectives_workspace on public.run_retrospectives (workspace_id, created_at desc);

-- Self-learning events (classified user messages & system observations)
create table public.self_learn_events (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  category          text not null check (category in (
    'user_complaint', 'user_suggestion', 'tool_failure',
    'computer_use_fail', 'unverified_action', 'api_limitation',
    'hallucination'
  )),
  matched_pattern   text,
  original_message  text not null,
  classification    jsonb not null default '{}'::jsonb,
  micro_fix_viable  boolean not null default false,
  processed         boolean not null default false,
  created_at        timestamptz not null default now()
);

create index idx_self_learn_events_workspace on public.self_learn_events (workspace_id, created_at desc);
create index idx_self_learn_events_unprocessed on public.self_learn_events (workspace_id)
  where processed = false;

-- Link strategic goals to worker runs (deferred from section 12 for FK ordering)
create table public.strategic_goal_runs (
  goal_id uuid not null references public.strategic_goals (id) on delete cascade,
  run_id  uuid not null references public.worker_runs (id) on delete cascade,
  primary key (goal_id, run_id)
);

-- ═══════════════════════════════════════════════════════════════════════
-- 14. USAGE & ANALYTICS
-- ═══════════════════════════════════════════════════════════════════════

create table public.usage_counters (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  tokens_used     bigint not null default 0 check (tokens_used >= 0),
  spend_usd       numeric(12, 2) not null default 0 check (spend_usd >= 0),
  missions_run    integer not null default 0 check (missions_run >= 0),
  worker_runs_count integer not null default 0 check (worker_runs_count >= 0),
  micro_runs_count integer not null default 0 check (micro_runs_count >= 0),
  validations_run integer not null default 0 check (validations_run >= 0),
  research_queries integer not null default 0 check (research_queries >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, period_start, period_end),
  check (period_end > period_start)
);

create trigger trg_usage_counters_updated_at before update on public.usage_counters
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 15. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.api_keys enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_objectives enable row level security;
alter table public.repositories enable row level security;
alter table public.repository_connections enable row level security;
alter table public.repository_policies enable row level security;
alter table public.repository_paths enable row level security;
alter table public.repository_blocked_file_types enable row level security;
alter table public.repository_memory_profiles enable row level security;
alter table public.uploaded_documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.document_embeddings enable row level security;
alter table public.document_links enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.model_router_configs enable row level security;
alter table public.missions enable row level security;
alter table public.mission_files enable row level security;
alter table public.mission_tasks enable row level security;
alter table public.mission_events enable row level security;
alter table public.mission_artifacts enable row level security;
alter table public.pull_request_candidates enable row level security;
alter table public.findings enable row level security;
alter table public.validations enable row level security;
alter table public.research_sessions enable row level security;
alter table public.external_sources enable row level security;
alter table public.error_lessons enable row level security;
alter table public.memory_entries enable row level security;
alter table public.memory_embeddings enable row level security;
alter table public.memory_links enable row level security;
alter table public.strategic_goals enable row level security;
alter table public.strategic_goal_runs enable row level security;
alter table public.capability_entries enable row level security;
alter table public.user_patterns enable row level security;
alter table public.worker_configs enable row level security;
alter table public.worker_runs enable row level security;
alter table public.worker_run_improvements enable row level security;
alter table public.worker_run_improvement_sources enable row level security;
alter table public.worker_run_guards enable row level security;
alter table public.run_retrospectives enable row level security;
alter table public.self_learn_events enable row level security;
alter table public.usage_counters enable row level security;

-- ─── Helper function: check workspace access ────────────────────────────
create or replace function public.user_has_workspace_access(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspaces where id = ws_id and owner_id = auth.uid()
    union all
    select 1 from public.workspace_members where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- ─── RLS Policies: Users ────────────────────────────────────────────────
create policy "Users can read own profile"
  on public.users for select using (id = auth.uid());
create policy "Users can update own profile"
  on public.users for update using (id = auth.uid());

-- ─── RLS Policies: API Keys ────────────────────────────────────────────
create policy "Users manage own API keys"
  on public.api_keys for all using (user_id = auth.uid());

-- ─── RLS Policies: Subscriptions ────────────────────────────────────────
create policy "Users read own subscriptions"
  on public.subscriptions for select using (user_id = auth.uid());

-- ─── RLS Policies: Workspaces ───────────────────────────────────────────
create policy "Workspace access"
  on public.workspaces for select using (public.user_has_workspace_access(id));
create policy "Workspace owner manages"
  on public.workspaces for all using (owner_id = auth.uid());

-- ─── RLS Policies: Workspace-scoped tables (via workspace_id) ───────────
-- Apply the same pattern to all workspace-scoped tables
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'workspace_members', 'workspace_objectives',
      'error_lessons', 'memory_entries',
      'strategic_goals', 'capability_entries', 'user_patterns',
      'worker_configs', 'worker_runs', 'run_retrospectives',
      'self_learn_events', 'usage_counters', 'research_sessions'
    ])
  loop
    execute format(
      'create policy "Workspace access on %1$s"
        on public.%1$s for all
        using (public.user_has_workspace_access(workspace_id))',
      tbl
    );
  end loop;
end $$;

-- ─── RLS Policies: Repository-scoped tables ─────────────────────────────
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'repository_connections', 'repository_policies',
      'repository_paths', 'repository_blocked_file_types',
      'repository_memory_profiles'
    ])
  loop
    execute format(
      'create policy "Repository access on %1$s"
        on public.%1$s for all
        using (
          public.user_has_workspace_access(
            (select workspace_id from public.repositories where id = repository_id)
          )
        )',
      tbl
    );
  end loop;
end $$;

-- Repositories themselves
create policy "Repository workspace access"
  on public.repositories for all
  using (public.user_has_workspace_access(workspace_id));

-- ─── RLS Policies: Mission-scoped tables ────────────────────────────────
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'mission_files', 'mission_tasks', 'mission_events',
      'mission_artifacts', 'pull_request_candidates',
      'findings', 'validations'
    ])
  loop
    execute format(
      'create policy "Mission access on %1$s"
        on public.%1$s for all
        using (
          public.user_has_workspace_access(
            (select workspace_id from public.missions where id = mission_id)
          )
        )',
      tbl
    );
  end loop;
end $$;

-- Missions themselves
create policy "Mission workspace access"
  on public.missions for all
  using (public.user_has_workspace_access(workspace_id));

-- ─── RLS Policies: Document-scoped tables ───────────────────────────────
create policy "Document workspace access"
  on public.uploaded_documents for all
  using (public.user_has_workspace_access(workspace_id));

create policy "Document chunks access"
  on public.document_chunks for all
  using (
    public.user_has_workspace_access(
      (select workspace_id from public.uploaded_documents where id = document_id)
    )
  );

create policy "Document embeddings access"
  on public.document_embeddings for all
  using (
    public.user_has_workspace_access(
      (select ud.workspace_id
       from public.uploaded_documents ud
       join public.document_chunks dc on dc.document_id = ud.id
       where dc.id = document_chunk_id)
    )
  );

create policy "Document links access"
  on public.document_links for all
  using (
    public.user_has_workspace_access(
      (select workspace_id from public.uploaded_documents where id = document_id)
    )
  );

-- ─── RLS Policies: Agent profiles ───────────────────────────────────────
create policy "Agent profile workspace access"
  on public.agent_profiles for all
  using (public.user_has_workspace_access(workspace_id));

create policy "Model router workspace access"
  on public.model_router_configs for all
  using (public.user_has_workspace_access(workspace_id));

-- ─── RLS Policies: Worker run child tables ──────────────────────────────
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'worker_run_improvements', 'worker_run_guards'
    ])
  loop
    execute format(
      'create policy "Worker run access on %1$s"
        on public.%1$s for all
        using (
          public.user_has_workspace_access(
            (select workspace_id from public.worker_runs where id = run_id)
          )
        )',
      tbl
    );
  end loop;
end $$;

create policy "Worker run improvement sources access"
  on public.worker_run_improvement_sources for all
  using (
    public.user_has_workspace_access(
      (select wr.workspace_id
       from public.worker_runs wr
       join public.worker_run_improvements wri on wri.run_id = wr.id
       where wri.id = improvement_id)
    )
  );

-- ─── RLS Policies: Other linked tables ──────────────────────────────────
create policy "External sources access"
  on public.external_sources for all
  using (
    public.user_has_workspace_access(
      (select workspace_id from public.research_sessions where id = research_session_id)
    )
  );

create policy "Memory embeddings access"
  on public.memory_embeddings for all
  using (
    public.user_has_workspace_access(
      (select workspace_id from public.memory_entries where id = memory_entry_id)
    )
  );

create policy "Memory links access"
  on public.memory_links for all
  using (
    public.user_has_workspace_access(
      (select workspace_id from public.memory_entries where id = memory_entry_id)
    )
  );

create policy "Strategic goal runs access"
  on public.strategic_goal_runs for all
  using (
    public.user_has_workspace_access(
      (select workspace_id from public.strategic_goals where id = goal_id)
    )
  );

create policy "Billing events access"
  on public.billing_events for all
  using (
    (select user_id from public.subscriptions where id = subscription_id) = auth.uid()
  );
