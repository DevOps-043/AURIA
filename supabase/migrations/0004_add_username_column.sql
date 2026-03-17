-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Migration 0004 — Add username column to public.users             ║
-- ║  Enables login by username and enforces uniqueness.               ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 1. Add the column
alter table public.users
  add column if not exists username text;

-- 2. Unique constraint (case-insensitive via lower index)
create unique index if not exists idx_users_username_unique
  on public.users (lower(username))
  where username is not null;

-- 3. Backfill from auth.users metadata for any existing users
update public.users u
set username = sub.username
from (
  select id, raw_user_meta_data->>'username' as username
  from auth.users
  where raw_user_meta_data->>'username' is not null
) sub
where u.id = sub.id
  and u.username is null;

-- 4. Update the handle_new_user trigger to also set username
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
    username,
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
    nullif(meta->>'username', ''),
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

-- 5. RPC: Resolve username → email (bypasses RLS for login)
-- Anon users need this because they aren't authenticated yet.
-- Only returns the email, never exposes other user data.
create or replace function public.resolve_username_to_email(target_username text)
returns text
security definer
set search_path = public
as $$
declare
  found_email text;
begin
  select email into found_email
  from public.users
  where lower(username) = lower(target_username)
  limit 1;

  return found_email;
end;
$$ language plpgsql;

grant execute on function public.resolve_username_to_email(text) to anon, authenticated;

-- 6. Update username availability check to also check public.users
create or replace function public.is_username_available(target_username text)
returns boolean
security definer
set search_path = public
as $$
begin
  if target_username is null
    or length(target_username) < 3
    or length(target_username) > 24
    or target_username !~ '^[a-z0-9_]+$'
  then
    return false;
  end if;

  -- Check both auth metadata and public.users for completeness
  return not exists (
    select 1 from public.users
    where lower(username) = lower(target_username)
  )
  and not exists (
    select 1 from auth.users
    where raw_user_meta_data->>'username' = target_username
  );
end;
$$ language plpgsql;
