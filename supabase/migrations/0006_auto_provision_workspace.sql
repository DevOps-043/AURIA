-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Migration 0006 — Auto-Provision Workspace on Signup              ║
-- ║                                                                    ║
-- ║  Extends handle_new_user() to create a starter subscription and   ║
-- ║  default workspace automatically when a user signs up.            ║
-- ║  Without this, users have no workspace and cannot connect repos.  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Replace the existing handle_new_user trigger function to also
-- create a subscription + workspace after inserting into public.users.

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_subscription_id uuid;
  new_workspace_id uuid;
  user_slug text;
  username_val text;
begin
  -- 1. Insert into public.users (same as before)
  insert into public.users (
    id,
    email,
    first_name,
    last_name,
    phone,
    date_of_birth,
    gender,
    country_code,
    city,
    company_name,
    job_title,
    github_username,
    bio,
    marketing_consent,
    terms_accepted_at
  ) values (
    new.id,
    new.email,
    coalesce(meta->>'first_name', ''),
    coalesce(meta->>'last_name', ''),
    nullif(meta->>'phone', ''),
    case
      when meta->>'date_of_birth' is not null
        and meta->>'date_of_birth' != ''
      then (meta->>'date_of_birth')::date
      else null
    end,
    nullif(meta->>'gender', ''),
    nullif(meta->>'country_code', ''),
    nullif(meta->>'city', ''),
    nullif(meta->>'company_name', ''),
    nullif(meta->>'job_title', ''),
    nullif(meta->>'github_username', ''),
    nullif(meta->>'bio', ''),
    coalesce((meta->>'marketing_consent')::boolean, false),
    case
      when coalesce((meta->>'terms_accepted')::boolean, false)
      then now()
      else null
    end
  );

  -- 2. Log the signup event
  insert into public.auth_audit_log (user_id, event_type, metadata)
  values (new.id, 'signup', jsonb_build_object(
    'provider', coalesce(new.raw_app_meta_data->>'provider', 'email')
  ));

  -- 3. Create a starter subscription for the new user
  insert into public.subscriptions (
    user_id,
    plan_code,
    status,
    billing_cycle,
    max_repositories,
    max_agents,
    agents_available,
    agents_simultaneous,
    au_included_monthly,
    au_rollover,
    budget_limit_usd,
    current_period_start,
    current_period_end
  ) values (
    new.id,
    'starter',
    'active',
    'monthly',
    3,     -- starter plan: 3 repos
    10,    -- starter plan: 10 agents
    10,    -- agents available
    2,     -- starter simultaneous agents
    15000, -- 15 AU
    false,
    0,
    now(),
    now() + interval '30 days'
  )
  returning id into new_subscription_id;

  -- 4. Generate a unique slug from username or email
  username_val := coalesce(
    nullif(meta->>'username', ''),
    split_part(new.email, '@', 1)
  );
  -- Sanitize: lowercase, replace non-alphanumeric with hyphens, trim
  user_slug := lower(regexp_replace(username_val, '[^a-z0-9]', '-', 'gi'));
  -- Remove leading/trailing hyphens and collapse multiple hyphens
  user_slug := regexp_replace(user_slug, '-+', '-', 'g');
  user_slug := trim(both '-' from user_slug);
  -- Ensure minimum length (slug constraint requires >= 3 chars)
  if length(user_slug) < 3 then
    user_slug := user_slug || '-ws';
  end if;
  -- Append random suffix to guarantee uniqueness
  user_slug := user_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- 5. Create a default workspace linked to the subscription
  insert into public.workspaces (
    owner_id,
    subscription_id,
    name,
    slug,
    mode
  ) values (
    new.id,
    new_subscription_id,
    coalesce(nullif(username_val, ''), 'My Workspace') || '''s Workspace',
    user_slug,
    'cloud'
  )
  returning id into new_workspace_id;

  return new;
end;
$$ language plpgsql;

-- ═══════════════════════════════════════════════════════════════════════
-- Backfill: Create workspaces for existing users who don't have one
-- ═══════════════════════════════════════════════════════════════════════

do $$
declare
  r record;
  new_sub_id uuid;
  user_slug text;
  username_val text;
begin
  for r in
    select u.id, u.email
    from public.users u
    where not exists (
      select 1 from public.workspaces w where w.owner_id = u.id
    )
  loop
    -- Create starter subscription
    insert into public.subscriptions (
      user_id, plan_code, status, billing_cycle,
      max_repositories, max_agents, agents_available, agents_simultaneous,
      au_included_monthly, au_rollover, budget_limit_usd,
      current_period_start, current_period_end
    ) values (
      r.id, 'starter', 'active', 'monthly',
      3, 10, 10, 2, 15000, false, 0, now(), now() + interval '30 days'
    )
    returning id into new_sub_id;

    -- Generate slug from email
    username_val := split_part(r.email, '@', 1);
    user_slug := lower(regexp_replace(username_val, '[^a-z0-9]', '-', 'gi'));
    user_slug := regexp_replace(user_slug, '-+', '-', 'g');
    user_slug := trim(both '-' from user_slug);
    if length(user_slug) < 3 then
      user_slug := user_slug || '-ws';
    end if;
    user_slug := user_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

    -- Create workspace
    insert into public.workspaces (
      owner_id, subscription_id, name, slug, mode
    ) values (
      r.id, new_sub_id,
      username_val || '''s Workspace',
      user_slug,
      'cloud'
    );
  end loop;
end;
$$;
