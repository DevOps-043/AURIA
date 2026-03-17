-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0005: GitHub Repository Connection Helpers
-- ═══════════════════════════════════════════════════════════════════════
-- Adds RPC functions for repository slot management and GitHub
-- connection workflows. These functions enforce plan-level limits
-- and provide safe atomic operations for repository CRUD.

-- ─── RPC: Check if workspace has available repo slots ────────────────
-- Returns true if the workspace can connect one more repository
-- without exceeding its plan's max_repositories limit.

create or replace function public.check_repo_slot_available(
  target_workspace_id uuid
)
returns boolean
security definer set search_path = public
language plpgsql as $$
declare
  max_repos integer;
  current_repos integer;
begin
  -- Verify the caller has access to this workspace
  if not public.user_has_workspace_access(target_workspace_id) then
    raise exception 'Access denied to workspace';
  end if;

  -- Get the plan's repo limit via workspace → subscription → plan_limits
  select coalesce(pl.max_repositories, 1) into max_repos
  from public.workspaces w
  join public.subscriptions s on w.subscription_id = s.id
  join public.plan_limits pl on pl.plan_code = s.plan_code
  where w.id = target_workspace_id
    and s.status in ('active', 'trialing');

  -- If no active subscription found, default to minimum
  if max_repos is null then
    max_repos := 1;
  end if;

  -- Count currently active repositories in the workspace
  select count(*) into current_repos
  from public.repositories
  where workspace_id = target_workspace_id
    and is_active = true;

  return current_repos < max_repos;
end;
$$;

grant execute on function public.check_repo_slot_available(uuid) to authenticated;

-- ─── RPC: Get workspace repo slot info ───────────────────────────────
-- Returns current usage and limit for the workspace's repo slots.
-- Useful for the UI to display "X / Y repositories connected".

create or replace function public.get_repo_slot_info(
  target_workspace_id uuid
)
returns json
security definer set search_path = public
language plpgsql as $$
declare
  max_repos integer;
  current_repos integer;
begin
  if not public.user_has_workspace_access(target_workspace_id) then
    raise exception 'Access denied to workspace';
  end if;

  select coalesce(pl.max_repositories, 1) into max_repos
  from public.workspaces w
  join public.subscriptions s on w.subscription_id = s.id
  join public.plan_limits pl on pl.plan_code = s.plan_code
  where w.id = target_workspace_id
    and s.status in ('active', 'trialing');

  if max_repos is null then
    max_repos := 1;
  end if;

  select count(*) into current_repos
  from public.repositories
  where workspace_id = target_workspace_id
    and is_active = true;

  return json_build_object(
    'used', current_repos,
    'total', max_repos,
    'available', max_repos - current_repos
  );
end;
$$;

grant execute on function public.get_repo_slot_info(uuid) to authenticated;

-- ─── RPC: Connect a GitHub repository ────────────────────────────────
-- Atomically creates the repository, connection, and default policies
-- in a single transaction. Returns the new repository ID.

create or replace function public.connect_github_repository(
  target_workspace_id uuid,
  github_external_id text,
  repo_full_name text,
  repo_name text,
  repo_default_branch text default 'main',
  repo_language text default null,
  repo_description text default null,
  repo_url text default null,
  repo_is_private boolean default false
)
returns uuid
security definer set search_path = public
language plpgsql as $$
declare
  new_repo_id uuid;
  slot_available boolean;
  existing_repo_id uuid;
begin
  -- Verify workspace access
  if not public.user_has_workspace_access(target_workspace_id) then
    raise exception 'Access denied to workspace';
  end if;

  -- Check if this GitHub repo is already connected to this workspace
  select id into existing_repo_id
  from public.repositories
  where workspace_id = target_workspace_id
    and provider = 'github'
    and external_id = github_external_id
    and is_active = true;

  if existing_repo_id is not null then
    raise exception 'Repository is already connected to this workspace';
  end if;

  -- Verify slot availability
  select public.check_repo_slot_available(target_workspace_id) into slot_available;
  if not slot_available then
    raise exception 'No available repository slots. Upgrade your plan to connect more repositories.';
  end if;

  -- Insert the repository
  insert into public.repositories (
    workspace_id, name, full_name, provider, external_id,
    default_branch, primary_branch, language,
    description, url, is_active
  ) values (
    target_workspace_id, repo_name, repo_full_name, 'github', github_external_id,
    repo_default_branch, repo_default_branch, repo_language,
    repo_description, repo_url, true
  )
  returning id into new_repo_id;

  -- Create the connection record
  insert into public.repository_connections (
    repository_id, connection_mode, connection_status
  ) values (
    new_repo_id, 'api_only', 'active'
  );

  -- Create default policies for the repository
  insert into public.repository_policies (
    repository_id, autonomy_mode, max_lines_per_mission,
    max_lines_per_file, max_files_per_mission, require_human_review
  ) values (
    new_repo_id, 'suggest', 300, 100, 10, true
  );

  return new_repo_id;
end;
$$;

grant execute on function public.connect_github_repository(uuid, text, text, text, text, text, text, text, boolean) to authenticated;

-- ─── RPC: Disconnect a repository ───────────────────────────────────
-- Soft-deletes the repository and updates its connection status.

create or replace function public.disconnect_repository(
  target_repo_id uuid
)
returns void
security definer set search_path = public
language plpgsql as $$
declare
  ws_id uuid;
begin
  -- Get workspace_id and verify access
  select workspace_id into ws_id
  from public.repositories
  where id = target_repo_id;

  if ws_id is null then
    raise exception 'Repository not found';
  end if;

  if not public.user_has_workspace_access(ws_id) then
    raise exception 'Access denied to workspace';
  end if;

  -- Soft-delete the repository
  update public.repositories
  set is_active = false, updated_at = now()
  where id = target_repo_id;

  -- Update connection status
  update public.repository_connections
  set connection_status = 'disconnected', updated_at = now()
  where repository_id = target_repo_id;
end;
$$;

grant execute on function public.disconnect_repository(uuid) to authenticated;
