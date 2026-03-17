-- Billing gateway foundation for subscriptions, AU purchases and provider-ready checkout flows.
-- This migration keeps the AU economy from 0002 and adds the commercial layer that will later
-- be connected to a real payment gateway adapter.

-- 1. Normalize subscriptions for provider-backed commerce.
alter table public.subscriptions
  add column if not exists provider text not null default 'disabled',
  add column if not exists offer_code text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists status_reason text not null default '',
  add column if not exists last_billed_at timestamptz,
  add column if not exists next_billing_at timestamptz,
  add column if not exists payment_method_summary text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.subscriptions
  drop constraint if exists subscriptions_provider_check;

alter table public.subscriptions
  add constraint subscriptions_provider_check
  check (provider in ('disabled', 'stripe', 'mercado_pago', 'custom'));

create unique index if not exists idx_subscriptions_provider_subscription
  on public.subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;

create unique index if not exists idx_subscriptions_provider_customer
  on public.subscriptions (provider, provider_customer_id)
  where provider_customer_id is not null;

-- 2. Provider/customer mapping per Auria user.
create table if not exists public.billing_customers (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users (id) on delete cascade,
  default_workspace_id  uuid references public.workspaces (id) on delete set null,
  provider              text not null default 'disabled'
    check (provider in ('disabled', 'stripe', 'mercado_pago', 'custom')),
  provider_customer_id  text,
  email                 text,
  is_default            boolean not null default true,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, provider)
);

create trigger trg_billing_customers_updated_at before update on public.billing_customers
  for each row execute function public.set_updated_at();

create unique index if not exists idx_billing_customers_provider_customer
  on public.billing_customers (provider, provider_customer_id)
  where provider_customer_id is not null;

-- 3. Subscription commerce catalog.
create table if not exists public.billing_plan_offers (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique check (code ~ '^[a-z0-9_]+$'),
  plan_code           text not null check (plan_code in (
    'free', 'starter', 'pro', 'enterprise'
  )),
  billing_cycle       text not null check (billing_cycle in (
    'monthly', 'yearly'
  )),
  display_name        text not null,
  description         text not null default '',
  price_usd           numeric(10, 2)
    check (price_usd is null or price_usd >= 0),
  currency            text not null default 'usd',
  budget_limit_usd    numeric(12, 2) not null default 0
    check (budget_limit_usd >= 0),
  provider            text not null default 'disabled'
    check (provider in ('disabled', 'stripe', 'mercado_pago', 'custom')),
  provider_product_id text,
  provider_price_id   text,
  provider_lookup_key text,
  is_custom_price     boolean not null default false,
  trial_days          integer not null default 0 check (trial_days >= 0),
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (plan_code, billing_cycle)
);

create trigger trg_billing_plan_offers_updated_at before update on public.billing_plan_offers
  for each row execute function public.set_updated_at();

-- 4. Extend AU packs with provider-ready catalog metadata.
alter table public.au_packs
  add column if not exists code text,
  add column if not exists description text not null default '',
  add column if not exists currency text not null default 'usd',
  add column if not exists provider text not null default 'disabled',
  add column if not exists provider_price_id text,
  add column if not exists provider_lookup_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.au_packs
set code = lower(regexp_replace(name, '[^a-z0-9]+', '_', 'g'))
where code is null;

alter table public.au_packs
  alter column code set not null;

alter table public.au_packs
  drop constraint if exists au_packs_provider_check;

alter table public.au_packs
  add constraint au_packs_provider_check
  check (provider in ('disabled', 'stripe', 'mercado_pago', 'custom'));

create unique index if not exists idx_au_packs_code
  on public.au_packs (code);

-- 5. Checkout lifecycle for both subscriptions and AU packs.
create table if not exists public.billing_checkout_sessions (
  id                         uuid primary key default gen_random_uuid(),
  session_kind               text not null check (session_kind in (
    'subscription', 'au_pack'
  )),
  status                     text not null default 'pending' check (status in (
    'pending', 'open', 'completed', 'expired', 'cancelled', 'failed', 'requires_gateway'
  )),
  provider                   text not null default 'disabled'
    check (provider in ('disabled', 'stripe', 'mercado_pago', 'custom')),
  user_id                    uuid not null references public.users (id) on delete cascade,
  workspace_id               uuid not null references public.workspaces (id) on delete cascade,
  subscription_id            uuid references public.subscriptions (id) on delete set null,
  plan_offer_id              uuid references public.billing_plan_offers (id) on delete set null,
  au_pack_id                 uuid references public.au_packs (id) on delete set null,
  provider_customer_id       text,
  provider_session_id        text,
  provider_payment_intent_id text,
  checkout_url               text,
  currency                   text not null default 'usd',
  amount_usd                 numeric(10, 2)
    check (amount_usd is null or amount_usd >= 0),
  metadata                   jsonb not null default '{}'::jsonb,
  requested_at               timestamptz not null default now(),
  expires_at                 timestamptz,
  completed_at               timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  check (
    (session_kind = 'subscription' and plan_offer_id is not null and au_pack_id is null)
    or
    (session_kind = 'au_pack' and au_pack_id is not null and plan_offer_id is null)
  )
);

create trigger trg_billing_checkout_sessions_updated_at before update on public.billing_checkout_sessions
  for each row execute function public.set_updated_at();

create index if not exists idx_billing_checkout_sessions_user
  on public.billing_checkout_sessions (user_id, created_at desc);

create index if not exists idx_billing_checkout_sessions_workspace
  on public.billing_checkout_sessions (workspace_id, created_at desc);

create unique index if not exists idx_billing_checkout_sessions_provider_session
  on public.billing_checkout_sessions (provider, provider_session_id)
  where provider_session_id is not null;

-- 6. Purchase lifecycle for AU packs.
create table if not exists public.au_pack_purchases (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  au_pack_id          uuid not null references public.au_packs (id) on delete restrict,
  checkout_session_id uuid unique references public.billing_checkout_sessions (id) on delete set null,
  status              text not null default 'initiated' check (status in (
    'initiated', 'awaiting_payment', 'paid', 'credited', 'failed', 'cancelled', 'refunded'
  )),
  gross_amount_usd    numeric(10, 2) not null default 0
    check (gross_amount_usd >= 0),
  currency            text not null default 'usd',
  provider            text not null default 'disabled'
    check (provider in ('disabled', 'stripe', 'mercado_pago', 'custom')),
  provider_payment_id text,
  credited_micro      bigint not null default 0 check (credited_micro >= 0),
  bonus_credited_micro bigint not null default 0 check (bonus_credited_micro >= 0),
  metadata            jsonb not null default '{}'::jsonb,
  credited_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger trg_au_pack_purchases_updated_at before update on public.au_pack_purchases
  for each row execute function public.set_updated_at();

create index if not exists idx_au_pack_purchases_user
  on public.au_pack_purchases (user_id, created_at desc);

create index if not exists idx_au_pack_purchases_workspace
  on public.au_pack_purchases (workspace_id, created_at desc);

-- 7. Subscription AU grants for idempotent monthly allocations.
create table if not exists public.subscription_au_grants (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  amount_micro    bigint not null check (amount_micro >= 0),
  rollover_micro  bigint not null default 0 check (rollover_micro >= 0),
  transaction_id  uuid unique references public.au_transactions (id) on delete set null,
  source          text not null check (source in (
    'cycle_reset', 'manual_adjustment', 'migration'
  )),
  created_at      timestamptz not null default now(),
  unique (subscription_id, workspace_id, period_start, source),
  check (period_end > period_start)
);

create index if not exists idx_subscription_au_grants_workspace
  on public.subscription_au_grants (workspace_id, period_start desc);

-- 8. Raw webhook ledger for provider reconciliation.
create table if not exists public.billing_webhook_events (
  id               uuid primary key default gen_random_uuid(),
  provider         text not null default 'disabled'
    check (provider in ('disabled', 'stripe', 'mercado_pago', 'custom')),
  provider_event_id text,
  event_type       text not null,
  signature_valid  boolean not null default false,
  processing_status text not null default 'pending' check (processing_status in (
    'pending', 'processed', 'ignored', 'failed'
  )),
  error_message    text,
  payload          jsonb not null default '{}'::jsonb,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz
);

create unique index if not exists idx_billing_webhook_events_provider_event
  on public.billing_webhook_events (provider, provider_event_id)
  where provider_event_id is not null;

-- 9. Make billing_events capable of representing subscription and pack commerce.
alter table public.billing_events
  alter column subscription_id drop not null;

alter table public.billing_events
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null,
  add column if not exists checkout_session_id uuid references public.billing_checkout_sessions (id) on delete set null,
  add column if not exists pack_purchase_id uuid references public.au_pack_purchases (id) on delete set null,
  add column if not exists provider text not null default 'disabled';

alter table public.billing_events
  drop constraint if exists billing_events_provider_check;

alter table public.billing_events
  add constraint billing_events_provider_check
  check (provider in ('disabled', 'stripe', 'mercado_pago', 'custom'));

alter table public.billing_events
  drop constraint if exists billing_events_event_type_check;

alter table public.billing_events
  add constraint billing_events_event_type_check
  check (event_type in (
    'payment_succeeded', 'payment_failed', 'subscription_created',
    'subscription_updated', 'subscription_canceled', 'refund',
    'trial_started', 'trial_ended', 'invoice_created',
    'checkout_session_created', 'checkout_session_completed',
    'portal_session_created', 'pack_purchase_completed'
  ));

create index if not exists idx_billing_events_workspace
  on public.billing_events (workspace_id, created_at desc)
  where workspace_id is not null;

create index if not exists idx_billing_events_checkout
  on public.billing_events (checkout_session_id)
  where checkout_session_id is not null;

create index if not exists idx_billing_events_pack_purchase
  on public.billing_events (pack_purchase_id)
  where pack_purchase_id is not null;

-- 10. Seed plan AU allocations and the commercial catalog.
insert into public.plan_au_allocations (
  plan_code, monthly_micro, rollover, max_rollover_micro
) values
  ('free', 0, false, 0),
  ('starter', 15000, false, 0),
  ('pro', 60000, true, 30000),
  ('enterprise', 250000, true, 250000)
on conflict (plan_code) do update
set monthly_micro = excluded.monthly_micro,
    rollover = excluded.rollover,
    max_rollover_micro = excluded.max_rollover_micro,
    updated_at = now();

insert into public.billing_plan_offers (
  code, plan_code, billing_cycle, display_name, description,
  price_usd, currency, budget_limit_usd, provider, provider_lookup_key,
  is_custom_price, trial_days, is_active, sort_order
) values
  (
    'free_monthly',
    'free',
    'monthly',
    'Free',
    'Controlled entry plan for evaluation workspaces and low-risk activity.',
    0,
    'usd',
    0,
    'disabled',
    'auria_free_monthly',
    false,
    0,
    true,
    0
  ),
  (
    'starter_monthly',
    'starter',
    'monthly',
    'Starter',
    'Operational starter plan with moderate concurrency and useful monthly AU.',
    19,
    'usd',
    100,
    'disabled',
    'auria_starter_monthly',
    false,
    7,
    true,
    1
  ),
  (
    'starter_yearly',
    'starter',
    'yearly',
    'Starter Annual',
    'Starter plan billed yearly with the same monthly AU envelope.',
    190,
    'usd',
    1200,
    'disabled',
    'auria_starter_yearly',
    false,
    7,
    true,
    2
  ),
  (
    'pro_monthly',
    'pro',
    'monthly',
    'Pro',
    'Higher concurrency, premium tools and larger AU runway for sustained execution.',
    79,
    'usd',
    500,
    'disabled',
    'auria_pro_monthly',
    false,
    7,
    true,
    3
  ),
  (
    'pro_yearly',
    'pro',
    'yearly',
    'Pro Annual',
    'Yearly Pro plan with the same monthly operational envelope.',
    790,
    'usd',
    6000,
    'disabled',
    'auria_pro_yearly',
    false,
    7,
    true,
    4
  ),
  (
    'enterprise_monthly',
    'enterprise',
    'monthly',
    'Enterprise',
    'Custom enterprise plan with expanded concurrency, governance and support.',
    null,
    'usd',
    0,
    'disabled',
    'auria_enterprise_monthly',
    true,
    0,
    true,
    5
  ),
  (
    'enterprise_yearly',
    'enterprise',
    'yearly',
    'Enterprise Annual',
    'Custom enterprise agreement with annual billing.',
    null,
    'usd',
    0,
    'disabled',
    'auria_enterprise_yearly',
    true,
    0,
    true,
    6
  )
on conflict (code) do update
set plan_code = excluded.plan_code,
    billing_cycle = excluded.billing_cycle,
    display_name = excluded.display_name,
    description = excluded.description,
    price_usd = excluded.price_usd,
    currency = excluded.currency,
    budget_limit_usd = excluded.budget_limit_usd,
    provider = excluded.provider,
    provider_lookup_key = excluded.provider_lookup_key,
    is_custom_price = excluded.is_custom_price,
    trial_days = excluded.trial_days,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into public.au_packs (
  code, name, description, amount_micro, price_usd, bonus_micro,
  currency, provider, provider_lookup_key, is_active, sort_order
) values
  (
    'au_boost_10',
    'AU Boost 10',
    'Top-up pack for a small burst of autonomous execution.',
    10000,
    10,
    0,
    'usd',
    'disabled',
    'auria_au_boost_10',
    true,
    1
  ),
  (
    'au_boost_30',
    'AU Boost 30',
    'Balanced AU refill with a small bonus for sustained work.',
    30000,
    27,
    3000,
    'usd',
    'disabled',
    'auria_au_boost_30',
    true,
    2
  ),
  (
    'au_boost_80',
    'AU Boost 80',
    'Large AU refill intended for heavy execution windows.',
    80000,
    64,
    12000,
    'usd',
    'disabled',
    'auria_au_boost_80',
    true,
    3
  )
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    amount_micro = excluded.amount_micro,
    price_usd = excluded.price_usd,
    bonus_micro = excluded.bonus_micro,
    currency = excluded.currency,
    provider = excluded.provider,
    provider_lookup_key = excluded.provider_lookup_key,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    updated_at = now();

-- 11. Service-role helper functions for entitlement sync and checkout completion.
create or replace function public.sync_subscription_entitlements(p_subscription_id uuid)
returns uuid as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_plan_limits public.plan_limits%rowtype;
  v_allocation public.plan_au_allocations%rowtype;
  v_effective_plan text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  select *
  into v_subscription
  from public.subscriptions
  where id = p_subscription_id;

  if not found then
    raise exception 'subscription % not found', p_subscription_id;
  end if;

  v_effective_plan := case
    when v_subscription.status in ('trialing', 'active') then v_subscription.plan_code
    else 'free'
  end;

  select *
  into v_plan_limits
  from public.plan_limits
  where plan_code = v_effective_plan;

  if not found then
    raise exception 'plan limits missing for %', v_effective_plan;
  end if;

  select *
  into v_allocation
  from public.plan_au_allocations
  where plan_code = v_effective_plan;

  update public.subscriptions
  set max_repositories = v_plan_limits.max_repositories,
      max_agents = v_plan_limits.max_agents_available,
      agents_available = v_plan_limits.max_agents_available,
      agents_simultaneous = v_plan_limits.max_agents_simultaneous,
      au_included_monthly = coalesce(v_allocation.monthly_micro, 0),
      au_rollover = coalesce(v_allocation.rollover, false)
  where id = p_subscription_id;

  update public.workspaces
  set max_concurrent_agents = v_plan_limits.max_agents_simultaneous
  where subscription_id = p_subscription_id;

  return p_subscription_id;
end;
$$ language plpgsql security definer;

create or replace function public.credit_workspace_au(
  p_workspace_id uuid,
  p_amount_micro bigint,
  p_transaction_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_description text
)
returns uuid as $$
declare
  v_wallet public.au_wallets%rowtype;
  v_balance_after bigint;
  v_transaction_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  if p_amount_micro <= 0 then
    raise exception 'credit amount must be positive';
  end if;

  if p_transaction_type not in ('purchase', 'refund', 'adjustment', 'bonus') then
    raise exception 'unsupported credit transaction type %', p_transaction_type;
  end if;

  select *
  into v_wallet
  from public.au_wallets
  where workspace_id = p_workspace_id
  for update;

  if not found then
    insert into public.au_wallets (workspace_id)
    values (p_workspace_id)
    returning * into v_wallet;
  end if;

  update public.au_wallets
  set balance_micro = balance_micro + p_amount_micro,
      lifetime_earned = lifetime_earned + p_amount_micro,
      lifetime_refund = lifetime_refund + case
        when p_transaction_type = 'refund' then p_amount_micro
        else 0
      end
  where id = v_wallet.id
  returning balance_micro into v_balance_after;

  insert into public.au_transactions (
    wallet_id,
    transaction_type,
    amount_micro,
    balance_after,
    reference_type,
    reference_id,
    description
  ) values (
    v_wallet.id,
    p_transaction_type,
    p_amount_micro,
    v_balance_after,
    p_reference_type,
    p_reference_id,
    p_description
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$ language plpgsql security definer;

create or replace function public.grant_subscription_cycle_au(
  p_subscription_id uuid,
  p_workspace_id uuid,
  p_period_start date,
  p_period_end date,
  p_source text default 'cycle_reset'
)
returns uuid as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_allocation public.plan_au_allocations%rowtype;
  v_existing_tx uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  select *
  into v_subscription
  from public.subscriptions
  where id = p_subscription_id;

  if not found then
    raise exception 'subscription % not found', p_subscription_id;
  end if;

  select *
  into v_allocation
  from public.plan_au_allocations
  where plan_code = v_subscription.plan_code;

  if not found or coalesce(v_allocation.monthly_micro, 0) = 0 then
    return null;
  end if;

  select transaction_id
  into v_existing_tx
  from public.subscription_au_grants
  where subscription_id = p_subscription_id
    and workspace_id = p_workspace_id
    and period_start = p_period_start
    and source = p_source;

  if v_existing_tx is not null then
    return v_existing_tx;
  end if;

  v_existing_tx := public.credit_workspace_au(
    p_workspace_id,
    v_allocation.monthly_micro,
    'bonus',
    'subscription',
    p_subscription_id,
    'Plan AU allocation for ' || v_subscription.plan_code || ' (' || p_source || ')'
  );

  insert into public.subscription_au_grants (
    subscription_id,
    workspace_id,
    period_start,
    period_end,
    amount_micro,
    rollover_micro,
    transaction_id,
    source
  ) values (
    p_subscription_id,
    p_workspace_id,
    p_period_start,
    p_period_end,
    v_allocation.monthly_micro,
    0,
    v_existing_tx,
    p_source
  )
  on conflict (subscription_id, workspace_id, period_start, source) do nothing;

  return v_existing_tx;
end;
$$ language plpgsql security definer;

create or replace function public.upsert_subscription_from_offer(
  p_user_id uuid,
  p_workspace_id uuid,
  p_plan_offer_id uuid,
  p_provider text,
  p_provider_customer_id text default null,
  p_provider_subscription_id text default null,
  p_status text default 'active',
  p_current_period_start timestamptz default now(),
  p_current_period_end timestamptz default (now() + interval '30 days')
)
returns uuid as $$
declare
  v_offer public.billing_plan_offers%rowtype;
  v_workspace public.workspaces%rowtype;
  v_subscription_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  select *
  into v_offer
  from public.billing_plan_offers
  where id = p_plan_offer_id;

  if not found then
    raise exception 'billing plan offer % not found', p_plan_offer_id;
  end if;

  select *
  into v_workspace
  from public.workspaces
  where id = p_workspace_id
  for update;

  if not found then
    raise exception 'workspace % not found', p_workspace_id;
  end if;

  v_subscription_id := v_workspace.subscription_id;

  if v_subscription_id is null then
    insert into public.subscriptions (
      user_id,
      provider,
      provider_customer_id,
      provider_subscription_id,
      offer_code,
      plan_code,
      status,
      billing_cycle,
      budget_limit_usd,
      current_period_start,
      current_period_end,
      next_billing_at,
      last_billed_at
    ) values (
      p_user_id,
      p_provider,
      p_provider_customer_id,
      p_provider_subscription_id,
      v_offer.code,
      v_offer.plan_code,
      p_status,
      v_offer.billing_cycle,
      v_offer.budget_limit_usd,
      p_current_period_start,
      p_current_period_end,
      p_current_period_end,
      now()
    )
    returning id into v_subscription_id;

    update public.workspaces
    set subscription_id = v_subscription_id
    where id = p_workspace_id;
  else
    update public.subscriptions
    set user_id = p_user_id,
        provider = p_provider,
        provider_customer_id = coalesce(p_provider_customer_id, provider_customer_id),
        provider_subscription_id = coalesce(p_provider_subscription_id, provider_subscription_id),
        offer_code = v_offer.code,
        plan_code = v_offer.plan_code,
        status = p_status,
        billing_cycle = v_offer.billing_cycle,
        budget_limit_usd = v_offer.budget_limit_usd,
        current_period_start = p_current_period_start,
        current_period_end = p_current_period_end,
        next_billing_at = p_current_period_end,
        last_billed_at = now()
    where id = v_subscription_id;
  end if;

  perform public.sync_subscription_entitlements(v_subscription_id);

  return v_subscription_id;
end;
$$ language plpgsql security definer;

create or replace function public.finalize_pack_purchase(p_purchase_id uuid)
returns uuid as $$
declare
  v_purchase public.au_pack_purchases%rowtype;
  v_pack public.au_packs%rowtype;
  v_transaction_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  select *
  into v_purchase
  from public.au_pack_purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'pack purchase % not found', p_purchase_id;
  end if;

  select *
  into v_pack
  from public.au_packs
  where id = v_purchase.au_pack_id;

  if not found then
    raise exception 'AU pack % not found', v_purchase.au_pack_id;
  end if;

  if v_purchase.status = 'credited' then
    select id
    into v_transaction_id
    from public.au_transactions
    where reference_type = 'pack_purchase'
      and reference_id = p_purchase_id
    order by created_at desc
    limit 1;

    return v_transaction_id;
  end if;

  v_transaction_id := public.credit_workspace_au(
    v_purchase.workspace_id,
    v_pack.amount_micro + v_pack.bonus_micro,
    'purchase',
    'pack_purchase',
    p_purchase_id,
    'AU pack purchase credited: ' || v_pack.name
  );

  update public.au_pack_purchases
  set status = 'credited',
      credited_micro = v_pack.amount_micro,
      bonus_credited_micro = v_pack.bonus_micro,
      credited_at = now()
  where id = p_purchase_id;

  return v_transaction_id;
end;
$$ language plpgsql security definer;

create or replace function public.apply_subscription_status_change(
  p_subscription_id uuid,
  p_status text,
  p_reason text default null
)
returns uuid as $$
declare
  v_workspace_id uuid;
  v_event_type text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  update public.subscriptions
  set status = p_status,
      status_reason = coalesce(p_reason, status_reason),
      canceled_at = case
        when p_status = 'canceled' then coalesce(canceled_at, now())
        else canceled_at
      end
  where id = p_subscription_id;

  perform public.sync_subscription_entitlements(p_subscription_id);

  select id
  into v_workspace_id
  from public.workspaces
  where subscription_id = p_subscription_id
  limit 1;

  v_event_type := case
    when p_status = 'canceled' then 'subscription_canceled'
    else 'subscription_updated'
  end;

  insert into public.billing_events (
    subscription_id,
    workspace_id,
    provider,
    event_type,
    payload
  ) values (
    p_subscription_id,
    v_workspace_id,
    (select provider from public.subscriptions where id = p_subscription_id),
    v_event_type,
    jsonb_build_object(
      'status', p_status,
      'reason', p_reason
    )
  );

  return p_subscription_id;
end;
$$ language plpgsql security definer;

create or replace function public.apply_checkout_completion(
  p_checkout_session_id uuid,
  p_provider_session_id text default null,
  p_provider_payment_id text default null,
  p_provider_subscription_id text default null,
  p_provider_customer_id text default null,
  p_subscription_status text default 'active',
  p_period_start timestamptz default now(),
  p_period_end timestamptz default (now() + interval '30 days')
)
returns jsonb as $$
declare
  v_session public.billing_checkout_sessions%rowtype;
  v_subscription_id uuid;
  v_purchase_id uuid;
  v_transaction_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  select *
  into v_session
  from public.billing_checkout_sessions
  where id = p_checkout_session_id
  for update;

  if not found then
    raise exception 'checkout session % not found', p_checkout_session_id;
  end if;

  update public.billing_checkout_sessions
  set status = 'completed',
      provider_session_id = coalesce(p_provider_session_id, provider_session_id),
      provider_payment_intent_id = coalesce(p_provider_payment_id, provider_payment_intent_id),
      provider_customer_id = coalesce(p_provider_customer_id, provider_customer_id),
      completed_at = coalesce(completed_at, now())
  where id = p_checkout_session_id;

  insert into public.billing_events (
    subscription_id,
    workspace_id,
    checkout_session_id,
    provider,
    event_type,
    amount_usd,
    currency,
    payload
  ) values (
    v_session.subscription_id,
    v_session.workspace_id,
    v_session.id,
    v_session.provider,
    'checkout_session_completed',
    v_session.amount_usd,
    v_session.currency,
    jsonb_build_object(
      'session_kind', v_session.session_kind,
      'provider_session_id', coalesce(p_provider_session_id, v_session.provider_session_id),
      'provider_payment_id', p_provider_payment_id
    )
  );

  if v_session.session_kind = 'subscription' then
    v_subscription_id := public.upsert_subscription_from_offer(
      v_session.user_id,
      v_session.workspace_id,
      v_session.plan_offer_id,
      v_session.provider,
      coalesce(p_provider_customer_id, v_session.provider_customer_id),
      p_provider_subscription_id,
      p_subscription_status,
      p_period_start,
      p_period_end
    );

    v_transaction_id := public.grant_subscription_cycle_au(
      v_subscription_id,
      v_session.workspace_id,
      p_period_start::date,
      p_period_end::date,
      'cycle_reset'
    );

    insert into public.billing_events (
      subscription_id,
      workspace_id,
      checkout_session_id,
      provider,
      event_type,
      amount_usd,
      currency,
      payload
    ) values (
      v_subscription_id,
      v_session.workspace_id,
      v_session.id,
      v_session.provider,
      'payment_succeeded',
      v_session.amount_usd,
      v_session.currency,
      jsonb_build_object(
        'plan_offer_id', v_session.plan_offer_id,
        'provider_subscription_id', p_provider_subscription_id,
        'period_start', p_period_start,
        'period_end', p_period_end,
        'wallet_transaction_id', v_transaction_id
      )
    );

    return jsonb_build_object(
      'kind', 'subscription',
      'checkoutSessionId', v_session.id,
      'subscriptionId', v_subscription_id,
      'walletTransactionId', v_transaction_id
    );
  end if;

  select id
  into v_purchase_id
  from public.au_pack_purchases
  where checkout_session_id = v_session.id
  limit 1;

  if v_purchase_id is null then
    insert into public.au_pack_purchases (
      user_id,
      workspace_id,
      au_pack_id,
      checkout_session_id,
      status,
      gross_amount_usd,
      currency,
      provider,
      provider_payment_id
    ) values (
      v_session.user_id,
      v_session.workspace_id,
      v_session.au_pack_id,
      v_session.id,
      'paid',
      coalesce(v_session.amount_usd, 0),
      v_session.currency,
      v_session.provider,
      p_provider_payment_id
    )
    returning id into v_purchase_id;
  else
    update public.au_pack_purchases
    set status = 'paid',
        provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id)
    where id = v_purchase_id;
  end if;

  v_transaction_id := public.finalize_pack_purchase(v_purchase_id);

  insert into public.billing_events (
    workspace_id,
    checkout_session_id,
    pack_purchase_id,
    provider,
    event_type,
    amount_usd,
    currency,
    payload
  ) values (
    v_session.workspace_id,
    v_session.id,
    v_purchase_id,
    v_session.provider,
    'pack_purchase_completed',
    v_session.amount_usd,
    v_session.currency,
    jsonb_build_object(
      'au_pack_id', v_session.au_pack_id,
      'wallet_transaction_id', v_transaction_id
    )
  );

  return jsonb_build_object(
    'kind', 'au_pack',
    'checkoutSessionId', v_session.id,
    'packPurchaseId', v_purchase_id,
    'walletTransactionId', v_transaction_id
  );
end;
$$ language plpgsql security definer;

-- 12. RLS for the new commerce layer.
alter table public.billing_customers enable row level security;
alter table public.billing_plan_offers enable row level security;
alter table public.billing_checkout_sessions enable row level security;
alter table public.au_pack_purchases enable row level security;
alter table public.subscription_au_grants enable row level security;
alter table public.billing_webhook_events enable row level security;

create policy "Billing customers own access"
  on public.billing_customers for all
  using (user_id = auth.uid());

create policy "Billing plan offers readable"
  on public.billing_plan_offers for select
  using (auth.uid() is not null);

create policy "Billing checkout sessions own access"
  on public.billing_checkout_sessions for all
  using (
    user_id = auth.uid()
    and public.user_has_workspace_access(workspace_id)
  );

create policy "AU pack purchases own access"
  on public.au_pack_purchases for all
  using (
    user_id = auth.uid()
    and public.user_has_workspace_access(workspace_id)
  );

create policy "Subscription AU grants workspace access"
  on public.subscription_au_grants for select
  using (public.user_has_workspace_access(workspace_id));

drop policy if exists "Billing events access" on public.billing_events;

create policy "Billing events access"
  on public.billing_events for select
  using (
    (subscription_id is not null and (
      select user_id from public.subscriptions where id = subscription_id
    ) = auth.uid())
    or
    (workspace_id is not null and public.user_has_workspace_access(workspace_id))
  );

-- Webhook ledger remains server-only. Service role bypasses RLS and no user policy is granted.
