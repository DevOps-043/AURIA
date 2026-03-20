-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Migration 0012 — SSO Profile Sync & Avatar Storage               ║
-- ║                                                                    ║
-- ║  1. Fix handle_new_user to extract GitHub OAuth metadata           ║
-- ║  2. Add avatar_url backfill from SSO for existing users            ║
-- ║  3. Create storage bucket for profile avatars                      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════
-- 1. REPLACE handle_new_user — extract GitHub OAuth metadata properly
-- ═══════════════════════════════════════════════════════════════════════

-- GitHub OAuth raw_user_meta_data provides:
--   full_name, name, avatar_url, user_name, preferred_username, email
-- Email/password signup provides:
--   first_name, last_name (from our signup form)

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  provider text := coalesce(new.raw_app_meta_data->>'provider', 'email');
  v_full_name text;
  v_first_name text;
  v_last_name text;
begin
  -- Extract name: GitHub sends 'full_name' or 'name', email signup sends 'first_name'/'last_name'
  if provider = 'github' then
    v_full_name := coalesce(meta->>'full_name', meta->>'name', '');
    -- Split full_name into first/last
    v_first_name := split_part(v_full_name, ' ', 1);
    v_last_name  := nullif(trim(substring(v_full_name from position(' ' in v_full_name) + 1)), '');
    if v_last_name = v_first_name then v_last_name := null; end if;
  else
    v_first_name := coalesce(meta->>'first_name', '');
    v_last_name  := nullif(meta->>'last_name', '');
  end if;

  insert into public.users (
    id,
    email,
    first_name,
    last_name,
    phone,
    avatar_url,
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
    v_first_name,
    v_last_name,
    nullif(meta->>'phone', ''),
    -- Avatar: GitHub provides avatar_url directly
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'country_code', ''),
    nullif(meta->>'city', ''),
    nullif(meta->>'company_name', ''),
    nullif(meta->>'job_title', ''),
    -- GitHub username from OAuth
    coalesce(
      nullif(meta->>'user_name', ''),
      nullif(meta->>'preferred_username', ''),
      nullif(meta->>'github_username', '')
    ),
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
    'provider', provider
  ));

  return new;
end;
$$ language plpgsql;


-- ═══════════════════════════════════════════════════════════════════════
-- 2. BACKFILL: Update existing users who have empty profiles from SSO
-- ═══════════════════════════════════════════════════════════════════════

-- For users who signed up via GitHub but have empty first_name/avatar_url,
-- pull the data from auth.users.raw_user_meta_data.
update public.users u
set
  first_name = coalesce(
    nullif(u.first_name, ''),
    split_part(coalesce(a.raw_user_meta_data->>'full_name', a.raw_user_meta_data->>'name', ''), ' ', 1)
  ),
  last_name = coalesce(
    nullif(u.last_name, ''),
    nullif(trim(substring(
      coalesce(a.raw_user_meta_data->>'full_name', a.raw_user_meta_data->>'name', '')
      from position(' ' in coalesce(a.raw_user_meta_data->>'full_name', a.raw_user_meta_data->>'name', '')) + 1
    )), '')
  ),
  avatar_url = coalesce(
    nullif(u.avatar_url, ''),
    a.raw_user_meta_data->>'avatar_url'
  ),
  github_username = coalesce(
    nullif(u.github_username, ''),
    a.raw_user_meta_data->>'user_name',
    a.raw_user_meta_data->>'preferred_username'
  )
from auth.users a
where u.id = a.id
  and (u.first_name = '' or u.first_name is null or u.avatar_url is null or u.avatar_url = '');


-- ═══════════════════════════════════════════════════════════════════════
-- 3. STORAGE BUCKET FOR AVATARS
-- ═══════════════════════════════════════════════════════════════════════

-- Create the bucket (public so avatar URLs can be rendered in <img>)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2 MB max
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- RLS: users can upload/update/delete only their own avatar (path = uid/*)
create policy "users_upload_own_avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users_update_own_avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users_delete_own_avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read for all avatars (bucket is public)
create policy "public_read_avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
