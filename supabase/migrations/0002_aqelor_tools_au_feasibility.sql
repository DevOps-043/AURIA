-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  AQELOR — Migration 0002: Tools, AU System, Feasibility & Refunds  ║
-- ║  Adds the credit economy, tool catalog, execution tracking,        ║
-- ║  feasibility checks and autonomous documentation outputs.          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════
-- 1. AU WALLET & ECONOMY
-- ═══════════════════════════════════════════════════════════════════════

-- AU balance per workspace (1 AU = 1000 micro_au internally)
create table public.au_wallets (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null unique references public.workspaces (id) on delete cascade,
  balance_micro   bigint not null default 0 check (balance_micro >= 0),
  reserved_micro  bigint not null default 0 check (reserved_micro >= 0),
  lifetime_earned bigint not null default 0 check (lifetime_earned >= 0),
  lifetime_spent  bigint not null default 0 check (lifetime_spent >= 0),
  lifetime_refund bigint not null default 0 check (lifetime_refund >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Reserved AU cannot exceed balance
  check (reserved_micro <= balance_micro)
);

create trigger trg_au_wallets_updated_at before update on public.au_wallets
  for each row execute function public.set_updated_at();

-- Every AU movement: purchases, consumption, refunds, expirations, adjustments
create table public.au_transactions (
  id              uuid primary key default gen_random_uuid(),
  wallet_id       uuid not null references public.au_wallets (id) on delete cascade,
  transaction_type text not null check (transaction_type in (
    'purchase', 'consumption', 'reservation', 'release',
    'refund', 'expiration', 'adjustment', 'bonus'
  )),
  amount_micro    bigint not null check (amount_micro != 0),
  balance_after   bigint not null check (balance_after >= 0),
  reference_type  text check (reference_type is null or reference_type in (
    'tool_execution', 'mission', 'subscription', 'refund',
    'admin', 'promotion', 'pack_purchase'
  )),
  reference_id    uuid,
  description     text not null default '',
  created_at      timestamptz not null default now()
);

create index idx_au_transactions_wallet on public.au_transactions (wallet_id, created_at desc);
create index idx_au_transactions_type on public.au_transactions (wallet_id, transaction_type);
create index idx_au_transactions_ref on public.au_transactions (reference_type, reference_id)
  where reference_id is not null;

-- AU packs available for purchase
create table public.au_packs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  amount_micro  bigint not null check (amount_micro > 0),
  price_usd     numeric(10, 2) not null check (price_usd > 0),
  bonus_micro   bigint not null default 0 check (bonus_micro >= 0),
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_au_packs_updated_at before update on public.au_packs
  for each row execute function public.set_updated_at();

-- AU included per subscription plan (monthly allocation)
create table public.plan_au_allocations (
  id            uuid primary key default gen_random_uuid(),
  plan_code     text not null unique check (plan_code in (
    'free', 'starter', 'pro', 'enterprise'
  )),
  monthly_micro bigint not null default 0 check (monthly_micro >= 0),
  rollover      boolean not null default false,
  max_rollover_micro bigint not null default 0 check (max_rollover_micro >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_plan_au_allocations_updated_at before update on public.plan_au_allocations
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 2. TOOL CATALOG
-- ═══════════════════════════════════════════════════════════════════════

-- Master catalog of AQELOR tools with costs and execution policies
create table public.tool_definitions (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique check (slug ~ '^[a-z0-9_]+$'),
  name                  text not null,
  description           text not null default '',
  category              text not null check (category in (
    'knowledge', 'documentation', 'research', 'quality',
    'improvement', 'qa_correction', 'security', 'optimization',
    'spaghetti_cleanup', 'implementation'
  )),

  -- ─── AU costs (in micro_au) ───────────────────────────────────────
  cost_minimum_micro    bigint not null default 0 check (cost_minimum_micro >= 0),
  cost_standard_micro   bigint not null default 0 check (cost_standard_micro >= 0),
  cost_full_micro       bigint not null default 0 check (cost_full_micro >= 0),

  -- ─── Execution policies ───────────────────────────────────────────
  allows_partial        boolean not null default false,
  partial_output_type   text check (partial_output_type is null or partial_output_type in (
    'reduced_scope', 'diagnostic_only', 'plan_only', 'analysis_only'
  )),
  is_premium            boolean not null default false,
  risk_level            text not null default 'low' check (risk_level in (
    'low', 'moderate', 'high', 'critical'
  )),

  -- ─── Limits ───────────────────────────────────────────────────────
  max_lines_per_execution   integer check (max_lines_per_execution is null or max_lines_per_execution > 0),
  max_files_per_execution   integer check (max_files_per_execution is null or max_files_per_execution > 0),
  max_agents_required       integer not null default 1 check (max_agents_required >= 1),
  default_model_tier        text not null default 'lite' check (default_model_tier in (
    'lite', 'standard', 'pro'
  )),

  -- ─── Plan restrictions ────────────────────────────────────────────
  min_plan_required     text not null default 'free' check (min_plan_required in (
    'free', 'starter', 'pro', 'enterprise'
  )),
  monthly_limit_free    integer check (monthly_limit_free is null or monthly_limit_free >= 0),
  monthly_limit_starter integer check (monthly_limit_starter is null or monthly_limit_starter >= 0),
  monthly_limit_pro     integer check (monthly_limit_pro is null or monthly_limit_pro >= 0),

  is_active             boolean not null default true,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Standard cost must be between minimum and full
  check (cost_minimum_micro <= cost_standard_micro),
  check (cost_standard_micro <= cost_full_micro)
);

create trigger trg_tool_definitions_updated_at before update on public.tool_definitions
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 3. FEASIBILITY CHECKS
-- ═══════════════════════════════════════════════════════════════════════

-- Pre-execution feasibility assessment for every tool invocation
create table public.feasibility_checks (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  mission_id          uuid references public.missions (id) on delete set null,
  tool_definition_id  uuid not null references public.tool_definitions (id) on delete restrict,
  requested_by        uuid not null references public.users (id) on delete cascade,

  -- ─── AU snapshot at check time ────────────────────────────────────
  au_available_micro  bigint not null check (au_available_micro >= 0),
  cost_minimum_micro  bigint not null check (cost_minimum_micro >= 0),
  cost_standard_micro bigint not null check (cost_standard_micro >= 0),
  cost_full_micro     bigint not null check (cost_full_micro >= 0),

  -- ─── Result ───────────────────────────────────────────────────────
  verdict             text not null check (verdict in (
    'full', 'partial', 'not_feasible'
  )),
  reason              text not null default '',
  partial_scope       text,
  risk_assessment     text,

  -- ─── Policy checks ───────────────────────────────────────────────
  lines_estimated     integer not null default 0 check (lines_estimated >= 0),
  files_estimated     integer not null default 0 check (files_estimated >= 0),
  agents_required     integer not null default 1 check (agents_required >= 1),
  agents_available    integer not null default 0 check (agents_available >= 0),

  approved            boolean not null default false,
  approved_at         timestamptz,
  expired_at          timestamptz,
  created_at          timestamptz not null default now()
);

create index idx_feasibility_checks_workspace on public.feasibility_checks (workspace_id, created_at desc);
create index idx_feasibility_checks_mission on public.feasibility_checks (mission_id)
  where mission_id is not null;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. TOOL EXECUTIONS
-- ═══════════════════════════════════════════════════════════════════════

-- Individual tool execution tracking with AU consumption
create table public.tool_executions (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  mission_id            uuid references public.missions (id) on delete set null,
  worker_run_id         uuid references public.worker_runs (id) on delete set null,
  tool_definition_id    uuid not null references public.tool_definitions (id) on delete restrict,
  feasibility_check_id  uuid references public.feasibility_checks (id) on delete set null,
  executed_by           uuid references public.users (id) on delete set null,

  -- ─── Execution mode ───────────────────────────────────────────────
  execution_mode        text not null check (execution_mode in (
    'full', 'partial', 'diagnostic'
  )),
  model_used            text not null,
  model_tier            text not null check (model_tier in (
    'lite', 'standard', 'pro'
  )),

  -- ─── Status ───────────────────────────────────────────────────────
  status                text not null default 'pending' check (status in (
    'pending', 'running', 'completed', 'failed',
    'cancelled', 'blocked'
  )),
  failure_origin        text check (failure_origin is null or failure_origin in (
    'aqelor_internal', 'provider_external', 'user_repository',
    'policy_block', 'user_cancel', 'timeout'
  )),
  error_message         text,

  -- ─── AU economics ─────────────────────────────────────────────────
  au_reserved_micro     bigint not null default 0 check (au_reserved_micro >= 0),
  au_consumed_micro     bigint not null default 0 check (au_consumed_micro >= 0),
  au_refunded_micro     bigint not null default 0 check (au_refunded_micro >= 0),

  -- ─── Metrics ──────────────────────────────────────────────────────
  tokens_input          bigint not null default 0 check (tokens_input >= 0),
  tokens_output         bigint not null default 0 check (tokens_output >= 0),
  lines_changed         integer not null default 0 check (lines_changed >= 0),
  files_touched         integer not null default 0 check (files_touched >= 0),
  duration_ms           integer check (duration_ms is null or duration_ms >= 0),

  -- ─── Timestamps ───────────────────────────────────────────────────
  started_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger trg_tool_executions_updated_at before update on public.tool_executions
  for each row execute function public.set_updated_at();

create index idx_tool_executions_workspace on public.tool_executions (workspace_id, created_at desc);
create index idx_tool_executions_mission on public.tool_executions (mission_id)
  where mission_id is not null;
create index idx_tool_executions_run on public.tool_executions (worker_run_id)
  where worker_run_id is not null;
create index idx_tool_executions_tool on public.tool_executions (tool_definition_id, status);

-- ═══════════════════════════════════════════════════════════════════════
-- 5. AU REFUNDS
-- ═══════════════════════════════════════════════════════════════════════

-- Refund records with origin classification and percentage applied
create table public.au_refunds (
  id                  uuid primary key default gen_random_uuid(),
  wallet_id           uuid not null references public.au_wallets (id) on delete cascade,
  tool_execution_id   uuid not null references public.tool_executions (id) on delete cascade,
  transaction_id      uuid unique references public.au_transactions (id) on delete set null,

  -- ─── Refund classification ────────────────────────────────────────
  failure_origin      text not null check (failure_origin in (
    'aqelor_internal', 'provider_external', 'partial_value',
    'user_repository', 'policy_block', 'user_cancel'
  )),
  refund_percentage   integer not null check (refund_percentage >= 0 and refund_percentage <= 100),
  au_original_micro   bigint not null check (au_original_micro > 0),
  au_refunded_micro   bigint not null check (au_refunded_micro >= 0),

  -- ─── Audit ────────────────────────────────────────────────────────
  reason              text not null,
  auto_applied        boolean not null default true,
  reviewed_by         uuid references public.users (id) on delete set null,
  reviewed_at         timestamptz,

  created_at          timestamptz not null default now()
);

create index idx_au_refunds_wallet on public.au_refunds (wallet_id, created_at desc);
create index idx_au_refunds_execution on public.au_refunds (tool_execution_id);

-- Refund policy configuration (customizable per plan)
create table public.refund_policies (
  id                  uuid primary key default gen_random_uuid(),
  failure_origin      text not null check (failure_origin in (
    'aqelor_internal', 'provider_external', 'partial_value',
    'user_repository', 'policy_block', 'user_cancel'
  )),
  plan_code           text not null check (plan_code in (
    'free', 'starter', 'pro', 'enterprise'
  )),
  refund_percentage   integer not null check (refund_percentage >= 0 and refund_percentage <= 100),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (failure_origin, plan_code)
);

create trigger trg_refund_policies_updated_at before update on public.refund_policies
  for each row execute function public.set_updated_at();

-- Seed default refund policies per documentation
insert into public.refund_policies (failure_origin, plan_code, refund_percentage) values
  -- aqelor_internal: 70%
  ('aqelor_internal', 'free', 70),
  ('aqelor_internal', 'starter', 70),
  ('aqelor_internal', 'pro', 70),
  ('aqelor_internal', 'enterprise', 70),
  -- provider_external: 60%
  ('provider_external', 'free', 60),
  ('provider_external', 'starter', 60),
  ('provider_external', 'pro', 60),
  ('provider_external', 'enterprise', 60),
  -- partial_value: 40%
  ('partial_value', 'free', 40),
  ('partial_value', 'starter', 40),
  ('partial_value', 'pro', 40),
  ('partial_value', 'enterprise', 40),
  -- user_repository: 0%
  ('user_repository', 'free', 0),
  ('user_repository', 'starter', 0),
  ('user_repository', 'pro', 0),
  ('user_repository', 'enterprise', 0),
  -- policy_block: 0%
  ('policy_block', 'free', 0),
  ('policy_block', 'starter', 0),
  ('policy_block', 'pro', 0),
  ('policy_block', 'enterprise', 0),
  -- user_cancel: 10% (middle ground of 0-20%)
  ('user_cancel', 'free', 10),
  ('user_cancel', 'starter', 10),
  ('user_cancel', 'pro', 15),
  ('user_cancel', 'enterprise', 20);

-- ═══════════════════════════════════════════════════════════════════════
-- 6. AUTONOMOUS DOCUMENTATION OUTPUTS
-- ═══════════════════════════════════════════════════════════════════════

-- Documentation generated autonomously by AQELOR (separate from user-uploaded docs)
create table public.autonomous_docs (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  repository_id     uuid not null references public.repositories (id) on delete cascade,
  mission_id        uuid references public.missions (id) on delete set null,
  tool_execution_id uuid references public.tool_executions (id) on delete set null,

  doc_type          text not null check (doc_type in (
    'commit_summary', 'pr_description', 'changelog',
    'file_documentation', 'module_documentation',
    'refactor_explanation', 'qa_notes', 'technical_handoff',
    'architecture_decision', 'api_documentation'
  )),
  title             text not null,
  content           text not null,
  format            text not null default 'markdown' check (format in (
    'markdown', 'plain', 'html', 'json'
  )),

  -- ─── Scope ────────────────────────────────────────────────────────
  scope_files       text[] not null default '{}',
  scope_branch      text,
  scope_commit_sha  text,

  -- ─── Quality ──────────────────────────────────────────────────────
  reflects_real_changes boolean not null default true,
  token_count       integer not null default 0 check (token_count >= 0),
  version           integer not null default 1 check (version >= 1),
  supersedes_id     uuid references public.autonomous_docs (id) on delete set null,
  is_current        boolean not null default true,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_autonomous_docs_updated_at before update on public.autonomous_docs
  for each row execute function public.set_updated_at();

create index idx_autonomous_docs_workspace on public.autonomous_docs (workspace_id, doc_type);
create index idx_autonomous_docs_repo on public.autonomous_docs (repository_id, created_at desc);
create index idx_autonomous_docs_mission on public.autonomous_docs (mission_id)
  where mission_id is not null;

-- ═══════════════════════════════════════════════════════════════════════
-- 7. PLAN LIMITS (agents available vs simultaneous per plan)
-- ═══════════════════════════════════════════════════════════════════════

-- Per-plan limits for agents, tools, and execution
create table public.plan_limits (
  id                      uuid primary key default gen_random_uuid(),
  plan_code               text not null unique check (plan_code in (
    'free', 'starter', 'pro', 'enterprise'
  )),

  -- ─── Agents ───────────────────────────────────────────────────────
  max_agents_available    integer not null default 5
    check (max_agents_available >= 1),
  max_agents_simultaneous integer not null default 1
    check (max_agents_simultaneous >= 1),

  -- ─── Repositories ─────────────────────────────────────────────────
  max_repositories        integer not null default 1
    check (max_repositories >= 1),

  -- ─── Execution ────────────────────────────────────────────────────
  max_lines_per_execution integer not null default 200
    check (max_lines_per_execution > 0),
  max_files_per_execution integer not null default 10
    check (max_files_per_execution > 0),
  max_daily_executions    integer not null default 5
    check (max_daily_executions >= 1),

  -- ─── Tools ────────────────────────────────────────────────────────
  premium_tools_enabled   boolean not null default false,
  max_research_queries_daily integer not null default 10
    check (max_research_queries_daily >= 0),

  -- ─── Storage ──────────────────────────────────────────────────────
  max_docs_uploaded       integer not null default 5
    check (max_docs_uploaded >= 0),
  max_doc_size_bytes      bigint not null default 5242880
    check (max_doc_size_bytes > 0),
  memory_retention_days   integer not null default 30
    check (memory_retention_days >= 1),

  -- ─── Models ───────────────────────────────────────────────────────
  byok_enabled            boolean not null default false,
  configurable_model_roles text[] not null default '{}',

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- Simultaneous cannot exceed available
  check (max_agents_simultaneous <= max_agents_available)
);

create trigger trg_plan_limits_updated_at before update on public.plan_limits
  for each row execute function public.set_updated_at();

-- Seed default plan limits
insert into public.plan_limits (
  plan_code, max_agents_available, max_agents_simultaneous,
  max_repositories, max_lines_per_execution, max_files_per_execution,
  max_daily_executions, premium_tools_enabled, max_research_queries_daily,
  max_docs_uploaded, max_doc_size_bytes, memory_retention_days,
  byok_enabled, configurable_model_roles
) values
  ('free', 5, 1, 1, 200, 10, 5, false, 5, 3, 2097152, 15, false, '{}'),
  ('starter', 10, 2, 3, 500, 20, 20, false, 15, 10, 5242880, 30, false, '{}'),
  ('pro', 15, 5, 10, 1000, 50, 50, true, 50, 50, 10485760, 90, true,
    '{planning,implementation,review,qa}'),
  ('enterprise', 15, 10, 50, 2000, 100, 200, true, 200, 200, 52428800, 365, true,
    '{planning,implementation,research,review,qa,risk,memory}');

-- ═══════════════════════════════════════════════════════════════════════
-- 8. TOOL EXECUTION MONTHLY COUNTERS
-- ═══════════════════════════════════════════════════════════════════════

-- Per-workspace per-tool monthly usage to enforce plan limits
create table public.tool_usage_monthly (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  tool_definition_id  uuid not null references public.tool_definitions (id) on delete cascade,
  period_year         integer not null check (period_year >= 2024),
  period_month        integer not null check (period_month >= 1 and period_month <= 12),
  execution_count     integer not null default 0 check (execution_count >= 0),
  au_consumed_micro   bigint not null default 0 check (au_consumed_micro >= 0),
  tokens_used         bigint not null default 0 check (tokens_used >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (workspace_id, tool_definition_id, period_year, period_month)
);

create trigger trg_tool_usage_monthly_updated_at before update on public.tool_usage_monthly
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 9. SEED TOOL DEFINITIONS
-- ═══════════════════════════════════════════════════════════════════════

-- Insert the 10 tools from the AQELOR functional documentation
insert into public.tool_definitions (
  slug, name, description, category,
  cost_minimum_micro, cost_standard_micro, cost_full_micro,
  allows_partial, partial_output_type, is_premium, risk_level,
  max_agents_required, default_model_tier, min_plan_required, sort_order
) values
  (
    'knowledge_intake',
    'Knowledge Intake',
    'Carga y procesamiento de documentación existente del sistema para mejorar el entendimiento funcional, técnico y operativo.',
    'knowledge',
    500, 1000, 2000,
    true, 'reduced_scope', false, 'low',
    1, 'lite', 'free', 1
  ),
  (
    'autonomous_docs',
    'Documentación Autónoma',
    'Genera documentación técnica automáticamente a partir del código y cambios reales: commits, PRs, changelogs, módulos.',
    'documentation',
    300, 800, 1500,
    true, 'reduced_scope', false, 'low',
    1, 'lite', 'free', 2
  ),
  (
    'research',
    'Research / Búsqueda / URL Context',
    'Investigación web, análisis de URLs, comparativas técnicas y mejores prácticas para soportar decisiones.',
    'research',
    200, 600, 1200,
    true, 'reduced_scope', false, 'low',
    1, 'standard', 'free', 3
  ),
  (
    'quality',
    'Calidad',
    'Limpieza básica, consistencia, lint, revisión técnica ligera y mejora estructural menor.',
    'quality',
    200, 500, 1000,
    true, 'reduced_scope', false, 'low',
    1, 'lite', 'free', 4
  ),
  (
    'improvement',
    'Mejora Técnica',
    'Reducción de deuda técnica moderada: refactors pequeños, reducción de complejidad, reorganización acotada.',
    'improvement',
    400, 1000, 2000,
    true, 'reduced_scope', false, 'moderate',
    2, 'standard', 'starter', 5
  ),
  (
    'qa_correction',
    'Corrección QA',
    'Corrección de defectos detectados por QA: fixes funcionales, ajuste de validaciones, solución de errores reproducibles.',
    'qa_correction',
    300, 800, 1500,
    true, 'reduced_scope', false, 'moderate',
    1, 'standard', 'free', 6
  ),
  (
    'security',
    'Seguridad',
    'Análisis y remediación de riesgos de seguridad: exposición de secretos, endurecimiento de validaciones.',
    'security',
    500, 1200, 2500,
    true, 'analysis_only', false, 'high',
    2, 'standard', 'starter', 7
  ),
  (
    'optimization',
    'Optimización',
    'Mejora de rendimiento, eficiencia, tiempos y uso de recursos: consultas, rutas pesadas, trabajo redundante.',
    'optimization',
    400, 1000, 2000,
    true, 'diagnostic_only', false, 'moderate',
    2, 'standard', 'starter', 8
  ),
  (
    'spaghetti_cleanup',
    'Eliminación de Código Spaghetti',
    'Refactorización profunda de zonas complejas, acopladas o difíciles de mantener. No permite ejecución parcial insegura.',
    'spaghetti_cleanup',
    1000, 3000, 6000,
    false, null, true, 'critical',
    3, 'pro', 'pro', 9
  ),
  (
    'new_implementation',
    'Implementación Nueva',
    'Construcción de nuevas capacidades o ampliación del sistema. Parcial limitado a análisis/diseño/plan, no código incompleto.',
    'implementation',
    800, 2500, 5000,
    true, 'plan_only', true, 'high',
    3, 'pro', 'starter', 10
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 10. EXTEND SUBSCRIPTIONS WITH AU FIELDS
-- ═══════════════════════════════════════════════════════════════════════

-- Add AU-related columns to existing subscriptions table
alter table public.subscriptions
  add column if not exists au_included_monthly bigint not null default 0
    check (au_included_monthly >= 0),
  add column if not exists au_rollover boolean not null default false,
  add column if not exists agents_available integer not null default 5
    check (agents_available >= 1),
  add column if not exists agents_simultaneous integer not null default 1
    check (agents_simultaneous >= 1);

-- ═══════════════════════════════════════════════════════════════════════
-- 11. EXTEND MISSIONS WITH TOOL REFERENCE
-- ═══════════════════════════════════════════════════════════════════════

-- Link missions to the tool that originated them
alter table public.missions
  add column if not exists tool_definition_id uuid references public.tool_definitions (id) on delete set null,
  add column if not exists execution_mode text check (execution_mode is null or execution_mode in (
    'full', 'partial', 'diagnostic'
  )),
  add column if not exists au_consumed_micro bigint not null default 0
    check (au_consumed_micro >= 0),
  add column if not exists au_refunded_micro bigint not null default 0
    check (au_refunded_micro >= 0);

-- ═══════════════════════════════════════════════════════════════════════
-- 12. ENABLE RLS ON NEW TABLES
-- ═══════════════════════════════════════════════════════════════════════

alter table public.au_wallets enable row level security;
alter table public.au_transactions enable row level security;
alter table public.au_packs enable row level security;
alter table public.plan_au_allocations enable row level security;
alter table public.tool_definitions enable row level security;
alter table public.feasibility_checks enable row level security;
alter table public.tool_executions enable row level security;
alter table public.au_refunds enable row level security;
alter table public.refund_policies enable row level security;
alter table public.autonomous_docs enable row level security;
alter table public.plan_limits enable row level security;
alter table public.tool_usage_monthly enable row level security;

-- ─── RLS Policies: AU Wallets (workspace-scoped) ────────────────────────
create policy "AU wallet workspace access"
  on public.au_wallets for all
  using (public.user_has_workspace_access(workspace_id));

-- ─── RLS Policies: AU Transactions (via wallet → workspace) ─────────────
create policy "AU transactions access"
  on public.au_transactions for all
  using (
    public.user_has_workspace_access(
      (select workspace_id from public.au_wallets where id = wallet_id)
    )
  );

-- ─── RLS Policies: AU Packs (readable by all authenticated users) ───────
create policy "AU packs readable by authenticated"
  on public.au_packs for select
  using (auth.uid() is not null);

-- ─── RLS Policies: Plan AU Allocations (readable by all authenticated) ──
create policy "Plan AU allocations readable"
  on public.plan_au_allocations for select
  using (auth.uid() is not null);

-- ─── RLS Policies: Tool Definitions (readable by all authenticated) ─────
create policy "Tool definitions readable"
  on public.tool_definitions for select
  using (auth.uid() is not null);

-- ─── RLS Policies: Feasibility Checks (workspace-scoped) ───────────────
create policy "Feasibility checks workspace access"
  on public.feasibility_checks for all
  using (public.user_has_workspace_access(workspace_id));

-- ─── RLS Policies: Tool Executions (workspace-scoped) ───────────────────
create policy "Tool executions workspace access"
  on public.tool_executions for all
  using (public.user_has_workspace_access(workspace_id));

-- ─── RLS Policies: AU Refunds (via wallet → workspace) ─────────────────
create policy "AU refunds access"
  on public.au_refunds for all
  using (
    public.user_has_workspace_access(
      (select workspace_id from public.au_wallets where id = wallet_id)
    )
  );

-- ─── RLS Policies: Refund Policies (readable by all authenticated) ──────
create policy "Refund policies readable"
  on public.refund_policies for select
  using (auth.uid() is not null);

-- ─── RLS Policies: Autonomous Docs (workspace-scoped) ───────────────────
create policy "Autonomous docs workspace access"
  on public.autonomous_docs for all
  using (public.user_has_workspace_access(workspace_id));

-- ─── RLS Policies: Plan Limits (readable by all authenticated) ──────────
create policy "Plan limits readable"
  on public.plan_limits for select
  using (auth.uid() is not null);

-- ─── RLS Policies: Tool Usage Monthly (workspace-scoped) ────────────────
create policy "Tool usage monthly workspace access"
  on public.tool_usage_monthly for all
  using (public.user_has_workspace_access(workspace_id));

-- ═══════════════════════════════════════════════════════════════════════
-- 13. HELPER: AUTO-CREATE AU WALLET ON WORKSPACE CREATION
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.auto_create_au_wallet()
returns trigger as $$
begin
  insert into public.au_wallets (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_workspace_auto_wallet
  after insert on public.workspaces
  for each row execute function public.auto_create_au_wallet();

-- ═══════════════════════════════════════════════════════════════════════
-- 14. HELPER: AUTO-APPLY REFUND ON TOOL EXECUTION FAILURE
-- ═══════════════════════════════════════════════════════════════════════

-- Function to calculate and apply refund when a tool execution fails
create or replace function public.process_tool_execution_refund()
returns trigger as $$
declare
  v_wallet_id uuid;
  v_plan_code text;
  v_refund_pct integer;
  v_refund_micro bigint;
  v_tx_id uuid;
begin
  -- Only process when status transitions to 'failed' or 'cancelled'
  if new.status not in ('failed', 'cancelled') then
    return new;
  end if;
  if old.status = new.status then
    return new;
  end if;
  if new.failure_origin is null then
    return new;
  end if;
  if new.au_consumed_micro = 0 then
    return new;
  end if;

  -- Get wallet
  select aw.id into v_wallet_id
  from public.au_wallets aw
  where aw.workspace_id = new.workspace_id;

  if v_wallet_id is null then
    return new;
  end if;

  -- Get plan code
  select s.plan_code into v_plan_code
  from public.subscriptions s
  join public.workspaces w on w.subscription_id = s.id
  where w.id = new.workspace_id
  limit 1;

  if v_plan_code is null then
    v_plan_code := 'free';
  end if;

  -- Map failure_origin to refund policy key
  select rp.refund_percentage into v_refund_pct
  from public.refund_policies rp
  where rp.plan_code = v_plan_code
    and rp.failure_origin = (
      case new.failure_origin
        when 'aqelor_internal' then 'aqelor_internal'
        when 'provider_external' then 'provider_external'
        when 'user_cancel' then 'user_cancel'
        when 'user_repository' then 'user_repository'
        when 'policy_block' then 'policy_block'
        when 'timeout' then 'provider_external'
        else 'user_repository'
      end
    )
    and rp.is_active = true;

  if v_refund_pct is null or v_refund_pct = 0 then
    return new;
  end if;

  v_refund_micro := (new.au_consumed_micro * v_refund_pct) / 100;

  if v_refund_micro = 0 then
    return new;
  end if;

  -- Credit wallet
  update public.au_wallets
  set balance_micro = balance_micro + v_refund_micro,
      lifetime_refund = lifetime_refund + v_refund_micro
  where id = v_wallet_id;

  -- Record transaction
  insert into public.au_transactions (
    wallet_id, transaction_type, amount_micro, balance_after,
    reference_type, reference_id, description
  )
  select
    v_wallet_id, 'refund', v_refund_micro,
    aw.balance_micro, 'refund', new.id,
    'Auto-refund ' || v_refund_pct || '% for ' || new.failure_origin
  from public.au_wallets aw
  where aw.id = v_wallet_id
  returning id into v_tx_id;

  -- Record refund
  insert into public.au_refunds (
    wallet_id, tool_execution_id, transaction_id,
    failure_origin, refund_percentage,
    au_original_micro, au_refunded_micro,
    reason, auto_applied
  ) values (
    v_wallet_id, new.id, v_tx_id,
    new.failure_origin, v_refund_pct,
    new.au_consumed_micro, v_refund_micro,
    'Automatic refund: ' || new.failure_origin, true
  );

  -- Update execution record
  new.au_refunded_micro := v_refund_micro;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_tool_execution_refund
  before update on public.tool_executions
  for each row execute function public.process_tool_execution_refund();
