-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Migration 0011 — API Key Defaults + BYOK System                  ║
-- ║                                                                    ║
-- ║  1. Tabla platform_default_keys: keys de AQELOR por defecto       ║
-- ║  2. Amplía api_keys: soporte Ollama, LM Studio, Vertex AI         ║
-- ║  3. Límite de 3 keys por usuario                                  ║
-- ║  4. RPC resolve_model_credentials: devuelve key activa            ║
-- ║     (usuario > plataforma)                                        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Tabla de keys por defecto de la plataforma (admin-only)
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.platform_default_keys (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null unique check (provider in (
    'vertex_ai', 'gemini', 'anthropic', 'mistral', 'openai', 'custom'
  )),
  encrypted_key text not null,
  config        jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.platform_default_keys is
  'API keys de AQELOR usadas por defecto para todos los usuarios. Solo admins pueden modificar.';

comment on column public.platform_default_keys.config is
  'Configuración extra del proveedor, ej: {"project_id": "...", "location": "us-central1"} para Vertex AI.';

create trigger trg_platform_default_keys_updated_at
  before update on public.platform_default_keys
  for each row execute function public.set_updated_at();

-- RLS: nadie puede leer directamente (solo via RPC con SECURITY DEFINER)
alter table public.platform_default_keys enable row level security;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Ampliar api_keys del usuario con más proveedores
-- ═══════════════════════════════════════════════════════════════════════

-- Eliminar constraint antigua de provider y crear una más amplia
alter table public.api_keys drop constraint if exists api_keys_provider_check;
alter table public.api_keys add constraint api_keys_provider_check
  check (provider in (
    'vertex_ai', 'gemini', 'anthropic', 'mistral', 'openai',
    'ollama', 'lm_studio', 'github', 'custom'
  ));

-- Configuración extra (base_url para Ollama/LM Studio, project_id para Vertex)
alter table public.api_keys
  add column if not exists config jsonb not null default '{}'::jsonb;

-- Prioridad (para cuando el usuario tiene múltiples keys del mismo proveedor)
alter table public.api_keys
  add column if not exists priority integer not null default 0;

comment on column public.api_keys.config is
  'Configuración extra: {"base_url": "http://localhost:11434"} para Ollama, {"project_id": "...", "location": "..."} para Vertex AI.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Función para validar límite de 3 keys por usuario
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.check_user_api_key_limit()
returns trigger
security definer set search_path = public
language plpgsql as $$
declare
  key_count integer;
begin
  select count(*) into key_count
  from public.api_keys
  where user_id = new.user_id
    and is_active = true;

  -- En INSERT, el nuevo registro aún no cuenta en el count
  -- En UPDATE reactivando una key, ya cuenta
  if tg_op = 'INSERT' and key_count >= 3 then
    raise exception 'Limite alcanzado: maximo 3 API keys activas por usuario. Elimina o desactiva una key existente.';
  end if;

  if tg_op = 'UPDATE' and new.is_active = true and key_count >= 3 then
    -- Verificar si ya estaba activa (no cuenta como nueva)
    if old.is_active = false then
      raise exception 'Limite alcanzado: maximo 3 API keys activas por usuario. Elimina o desactiva una key existente.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_api_key_limit on public.api_keys;

create trigger trg_check_api_key_limit
  before insert or update on public.api_keys
  for each row execute function public.check_user_api_key_limit();

-- ═══════════════════════════════════════════════════════════════════════
-- 4. RPC: Resolver credenciales para un modelo
--    Prioridad: user key > platform default
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.resolve_model_credentials(
  target_provider text
)
returns json
security definer set search_path = public
language plpgsql as $$
declare
  current_user_id uuid := auth.uid();
  user_key record;
  platform_key record;
begin
  if current_user_id is null then
    raise exception 'Autenticacion requerida';
  end if;

  -- 1. Buscar key del usuario para este proveedor
  select id, provider, encrypted_key, config, label
  into user_key
  from public.api_keys
  where user_id = current_user_id
    and provider = target_provider
    and is_active = true
  order by priority desc, created_at desc
  limit 1;

  if user_key.id is not null then
    return json_build_object(
      'source', 'user',
      'provider', user_key.provider,
      'key_id', user_key.id,
      'encrypted_key', user_key.encrypted_key,
      'config', user_key.config,
      'label', user_key.label
    );
  end if;

  -- 2. Fallback: key por defecto de la plataforma
  select id, provider, encrypted_key, config
  into platform_key
  from public.platform_default_keys
  where provider = target_provider
    and is_active = true
  limit 1;

  if platform_key.id is not null then
    return json_build_object(
      'source', 'platform',
      'provider', platform_key.provider,
      'key_id', platform_key.id,
      'encrypted_key', platform_key.encrypted_key,
      'config', platform_key.config,
      'label', 'AQELOR Default'
    );
  end if;

  -- 3. No hay key disponible
  return json_build_object(
    'source', 'none',
    'provider', target_provider,
    'key_id', null,
    'encrypted_key', null,
    'config', '{}'::jsonb,
    'label', null
  );
end;
$$;

grant execute on function public.resolve_model_credentials(text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. RPC: Listar API keys del usuario (sin exponer encrypted_key)
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.list_user_api_keys()
returns json
security definer set search_path = public
language plpgsql as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Autenticacion requerida';
  end if;

  return (
    select coalesce(json_agg(row_to_json(k)), '[]'::json)
    from (
      select
        id,
        provider,
        label,
        config,
        is_active,
        priority,
        last_used_at,
        created_at,
        -- Mostrar solo los últimos 4 caracteres de la key
        '****' || right(encrypted_key, 4) as key_hint
      from public.api_keys
      where user_id = current_user_id
      order by priority desc, created_at desc
    ) k
  );
end;
$$;

grant execute on function public.list_user_api_keys() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. RPC: Agregar API key del usuario (con validación)
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.upsert_user_api_key(
  target_provider text,
  api_key text,
  key_label text default 'default',
  key_config jsonb default '{}'::jsonb
)
returns uuid
security definer set search_path = public
language plpgsql as $$
declare
  current_user_id uuid := auth.uid();
  result_id uuid;
begin
  if current_user_id is null then
    raise exception 'Autenticacion requerida';
  end if;

  if length(api_key) < 8 then
    raise exception 'API key invalida: debe tener al menos 8 caracteres.';
  end if;

  insert into public.api_keys (
    user_id, provider, label, encrypted_key, config, is_active, priority
  ) values (
    current_user_id, target_provider, key_label, api_key, key_config, true, 0
  )
  on conflict (user_id, provider, label) do update set
    encrypted_key = excluded.encrypted_key,
    config = excluded.config,
    is_active = true,
    updated_at = now()
  returning id into result_id;

  return result_id;
end;
$$;

grant execute on function public.upsert_user_api_key(text, text, text, jsonb) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 7. RPC: Eliminar/desactivar API key del usuario
--    Al eliminar, el sistema vuelve a usar la key default
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.delete_user_api_key(
  target_key_id uuid
)
returns void
security definer set search_path = public
language plpgsql as $$
declare
  current_user_id uuid := auth.uid();
  key_owner uuid;
begin
  if current_user_id is null then
    raise exception 'Autenticacion requerida';
  end if;

  select user_id into key_owner
  from public.api_keys
  where id = target_key_id;

  if key_owner is null then
    raise exception 'API key no encontrada.';
  end if;

  if key_owner != current_user_id then
    raise exception 'No tienes permiso para eliminar esta API key.';
  end if;

  delete from public.api_keys where id = target_key_id;
end;
$$;

grant execute on function public.delete_user_api_key(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 8. Seed: Insertar key por defecto de Vertex AI (placeholder)
--    El admin debe actualizar encrypted_key con las credenciales reales
-- ═══════════════════════════════════════════════════════════════════════

insert into public.platform_default_keys (provider, encrypted_key, config, is_active)
values (
  'vertex_ai',
  'PLACEHOLDER_VERTEX_SERVICE_ACCOUNT_KEY',
  '{"project_id": "", "location": "us-central1"}'::jsonb,
  false  -- Desactivado hasta que el admin configure las credenciales reales
)
on conflict (provider) do nothing;
