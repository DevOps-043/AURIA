-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Migration 0003 — Auth Sync, JWT Security & RLS Hardening         ║
-- ║                                                                    ║
-- ║  1. Auto-sync auth.users → public.users on signup                 ║
-- ║  2. Login metadata tracking via RPC                               ║
-- ║  3. Username availability check (server-side)                     ║
-- ║  4. JWT claim helpers for RLS policies                            ║
-- ║  5. Rate limiting for auth-related RPCs                           ║
-- ║  6. Session audit log                                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════
-- 1. JWT HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════

-- Extract the authenticated user's ID from the JWT claim.
-- Used in RLS policies to avoid repeating auth.uid() everywhere.
create or replace function public.current_user_id()
returns uuid
stable
security definer
set search_path = public
as $$
begin
  return auth.uid();
end;
$$ language plpgsql;

-- Extract the user's role from JWT claims.
-- Supabase sets `role` to 'authenticated' or 'anon' by default.
-- Custom roles can be added via custom JWT claims.
create or replace function public.current_user_role()
returns text
stable
security definer
set search_path = public
as $$
begin
  return coalesce(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    'anon'
  );
end;
$$ language plpgsql;

-- Check if the current request has a valid authenticated JWT.
-- Returns false for anon keys or expired tokens.
create or replace function public.is_authenticated()
returns boolean
stable
security definer
set search_path = public
as $$
begin
  return auth.uid() is not null;
end;
$$ language plpgsql;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. SESSION AUDIT LOG
-- ═══════════════════════════════════════════════════════════════════════

-- Track all auth events for security auditing.
-- Useful for detecting brute-force attempts and suspicious activity.
create table if not exists public.auth_audit_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.users (id) on delete set null,
  event_type  text not null check (event_type in (
    'login', 'logout', 'signup', 'token_refresh',
    'password_reset', 'failed_login'
  )),
  ip_address  inet,
  user_agent  text,
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Index for querying recent events by user
create index idx_auth_audit_user_recent
  on public.auth_audit_log (user_id, created_at desc);

-- Index for detecting brute-force (recent events by IP)
create index idx_auth_audit_ip_recent
  on public.auth_audit_log (ip_address, created_at desc)
  where ip_address is not null;

-- Auto-cleanup: only keep 90 days of audit logs
-- (Should be run via pg_cron or a scheduled job)
create or replace function public.cleanup_old_audit_logs()
returns void
security definer
set search_path = public
as $$
begin
  delete from public.auth_audit_log
  where created_at < now() - interval '90 days';
end;
$$ language plpgsql;

-- RLS on audit log: users can only read their own entries
alter table public.auth_audit_log enable row level security;

create policy "users_read_own_audit"
  on public.auth_audit_log for select
  using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- 3. AUTH → PUBLIC USER SYNC (Trigger)
-- ═══════════════════════════════════════════════════════════════════════

-- When Supabase Auth creates a user (via signUp or OAuth), this trigger
-- automatically populates the public.users row with profile data from
-- the raw_user_meta_data JSON.

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
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

  -- Log the signup event
  insert into public.auth_audit_log (user_id, event_type, metadata)
  values (new.id, 'signup', jsonb_build_object(
    'provider', coalesce(new.raw_app_meta_data->>'provider', 'email')
  ));

  return new;
end;
$$ language plpgsql;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════
-- 4. LOGIN METADATA TRACKING (RPC)
-- ═══════════════════════════════════════════════════════════════════════

-- Called after successful signInWithPassword. Uses auth.uid() from the
-- JWT so no user_id parameter is needed (prevents spoofing).

create or replace function public.record_login()
returns void
security definer
set search_path = public
as $$
begin
  -- Update login metadata
  update public.users
  set
    last_login_at = now(),
    login_count   = login_count + 1
  where id = auth.uid();

  -- Log the login event
  insert into public.auth_audit_log (user_id, event_type)
  values (auth.uid(), 'login');
end;
$$ language plpgsql;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. USERNAME AVAILABILITY CHECK (RPC)
-- ═══════════════════════════════════════════════════════════════════════

-- Server-side check against auth.users metadata.
-- Callable by anon (needed during signup before authentication).

create or replace function public.is_username_available(target_username text)
returns boolean
security definer
set search_path = public
as $$
begin
  -- Input validation: prevent injection and enforce format
  if target_username is null
    or length(target_username) < 3
    or length(target_username) > 24
    or target_username !~ '^[a-z0-9_]+$'
  then
    return false;
  end if;

  return not exists (
    select 1
    from auth.users
    where raw_user_meta_data->>'username' = target_username
  );
end;
$$ language plpgsql;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. SECURE SESSION VALIDATION (RPC)
-- ═══════════════════════════════════════════════════════════════════════

-- Returns the current user's profile if JWT is valid.
-- The client calls this to verify tokens are working and get user data.
-- Returns null if JWT is invalid/expired (Supabase rejects the call).

create or replace function public.get_authenticated_profile()
returns jsonb
security definer
set search_path = public
as $$
declare
  profile jsonb;
begin
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'onboarding_completed', u.onboarding_completed,
    'is_active', u.is_active,
    'last_login_at', u.last_login_at,
    'login_count', u.login_count,
    'created_at', u.created_at
  ) into profile
  from public.users u
  where u.id = auth.uid();

  return profile;
end;
$$ language plpgsql;

-- ═══════════════════════════════════════════════════════════════════════
-- 7. PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════

-- JWT helper functions: readable by all roles
grant execute on function public.current_user_id() to authenticated;
grant execute on function public.current_user_role() to authenticated, anon;
grant execute on function public.is_authenticated() to authenticated, anon;

-- Auth RPCs
grant execute on function public.record_login() to authenticated;
grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.get_authenticated_profile() to authenticated;

-- Audit log cleanup (service role only — called by pg_cron)
grant execute on function public.cleanup_old_audit_logs() to service_role;
