create or replace function public.normalize_subscription_billing_state()
returns trigger
security definer
set search_path = public
as $$
declare
  v_effective_plan text;
  v_plan_limits public.plan_limits%rowtype;
  v_allocation public.plan_au_allocations%rowtype;
  v_offer_code text;
begin
  new.provider := coalesce(new.provider, 'disabled');
  new.status_reason := coalesce(new.status_reason, '');

  if new.current_period_start is null then
    new.current_period_start := now();
  end if;

  if new.current_period_end is null then
    new.current_period_end := case
      when new.billing_cycle = 'yearly' then new.current_period_start + interval '1 year'
      else new.current_period_start + interval '1 month'
    end;
  end if;

  new.next_billing_at := coalesce(new.next_billing_at, new.current_period_end);

  if new.offer_code is null then
    select code
    into v_offer_code
    from public.billing_plan_offers
    where plan_code = new.plan_code
      and billing_cycle = new.billing_cycle
      and is_active = true
    order by sort_order
    limit 1;

    new.offer_code := v_offer_code;
  end if;

  v_effective_plan := case
    when new.status in ('trialing', 'active') then new.plan_code
    else 'free'
  end;

  select *
  into v_plan_limits
  from public.plan_limits
  where plan_code = v_effective_plan;

  if found then
    new.max_repositories := v_plan_limits.max_repositories;
    new.max_agents := v_plan_limits.max_agents_available;
    new.agents_available := v_plan_limits.max_agents_available;
    new.agents_simultaneous := v_plan_limits.max_agents_simultaneous;
  end if;

  select *
  into v_allocation
  from public.plan_au_allocations
  where plan_code = v_effective_plan;

  if found then
    new.au_included_monthly := coalesce(v_allocation.monthly_micro, 0);
    new.au_rollover := coalesce(v_allocation.rollover, false);
  else
    new.au_included_monthly := 0;
    new.au_rollover := false;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_subscriptions_billing_normalize on public.subscriptions;

create trigger trg_subscriptions_billing_normalize
  before insert or update on public.subscriptions
  for each row execute function public.normalize_subscription_billing_state();

create or replace function public.sync_workspace_subscription_limits()
returns trigger
security definer
set search_path = public
as $$
begin
  update public.workspaces
  set max_concurrent_agents = coalesce(new.agents_simultaneous, max_concurrent_agents)
  where subscription_id = new.id;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_subscriptions_workspace_limits on public.subscriptions;

create trigger trg_subscriptions_workspace_limits
  after insert or update on public.subscriptions
  for each row execute function public.sync_workspace_subscription_limits();

update public.subscriptions
set plan_code = plan_code,
    billing_cycle = billing_cycle;

insert into public.au_wallets (workspace_id)
select w.id
from public.workspaces w
left join public.au_wallets aw on aw.workspace_id = w.id
where aw.id is null;

do $$
declare
  r record;
  v_wallet_id uuid;
  v_balance_after bigint;
  v_transaction_id uuid;
begin
  for r in
    select
      s.id as subscription_id,
      w.id as workspace_id,
      s.plan_code,
      s.current_period_start::date as period_start,
      s.current_period_end::date as period_end,
      pa.monthly_micro
    from public.subscriptions s
    join public.workspaces w on w.subscription_id = s.id
    join public.plan_au_allocations pa on pa.plan_code = s.plan_code
    left join public.subscription_au_grants g
      on g.subscription_id = s.id
      and g.workspace_id = w.id
      and g.period_start = s.current_period_start::date
      and g.source = 'cycle_reset'
    where s.status in ('trialing', 'active')
      and pa.monthly_micro > 0
      and g.id is null
  loop
    update public.au_wallets
    set balance_micro = balance_micro + r.monthly_micro,
        lifetime_earned = lifetime_earned + r.monthly_micro
    where workspace_id = r.workspace_id
    returning id, balance_micro into v_wallet_id, v_balance_after;

    insert into public.au_transactions (
      wallet_id,
      transaction_type,
      amount_micro,
      balance_after,
      reference_type,
      reference_id,
      description
    ) values (
      v_wallet_id,
      'bonus',
      r.monthly_micro,
      v_balance_after,
      'subscription',
      r.subscription_id,
      'Plan AU allocation for ' || r.plan_code || ' (migration backfill)'
    )
    returning id into v_transaction_id;

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
      r.subscription_id,
      r.workspace_id,
      r.period_start,
      r.period_end,
      r.monthly_micro,
      0,
      v_transaction_id,
      'cycle_reset'
    );
  end loop;
end;
$$;

create or replace function public.simulate_billing_checkout(
  p_workspace_id uuid,
  p_checkout_kind text,
  p_offer_code text default null,
  p_pack_code text default null
)
returns jsonb
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace public.workspaces%rowtype;
  v_offer public.billing_plan_offers%rowtype;
  v_pack public.au_packs%rowtype;
  v_checkout_id uuid;
  v_subscription_id uuid;
  v_purchase_id uuid;
  v_wallet_id uuid;
  v_balance_after bigint;
  v_transaction_id uuid;
  v_period_start timestamptz := now();
  v_period_end timestamptz := now();
  v_subscription_status text;
  v_allocation public.plan_au_allocations%rowtype;
  v_existing_grant uuid;
  v_existing_cycle_grant_micro bigint := 0;
  v_existing_adjustment_micro bigint := 0;
  v_adjustment_micro bigint := 0;
  v_adjustment_grant_id uuid;
  v_customer_id uuid;
  v_customer_email text;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if p_checkout_kind not in ('subscription', 'au_pack') then
    raise exception 'unsupported checkout kind %', p_checkout_kind;
  end if;

  if not public.user_has_workspace_access(p_workspace_id) then
    raise exception 'workspace access denied';
  end if;

  select *
  into v_workspace
  from public.workspaces
  where id = p_workspace_id
  for update;

  if not found then
    raise exception 'workspace % not found', p_workspace_id;
  end if;

  select email
  into v_customer_email
  from public.users
  where id = v_user_id;

  insert into public.billing_customers (
    user_id,
    default_workspace_id,
    provider,
    email,
    is_default
  ) values (
    v_user_id,
    p_workspace_id,
    'disabled',
    v_customer_email,
    true
  )
  on conflict (user_id, provider) do update
  set default_workspace_id = excluded.default_workspace_id,
      email = coalesce(excluded.email, public.billing_customers.email),
      updated_at = now()
  returning id into v_customer_id;

  if p_checkout_kind = 'subscription' then
    if p_offer_code is null then
      raise exception 'offer code is required';
    end if;

    select *
    into v_offer
    from public.billing_plan_offers
    where code = p_offer_code
      and is_active = true;

    if not found then
      raise exception 'billing plan offer % not found', p_offer_code;
    end if;

    v_subscription_status := case
      when coalesce(v_offer.trial_days, 0) > 0 then 'trialing'
      else 'active'
    end;
    v_period_end := case
      when v_offer.billing_cycle = 'yearly' then v_period_start + interval '1 year'
      else v_period_start + interval '1 month'
    end;

    insert into public.billing_checkout_sessions (
      session_kind,
      status,
      provider,
      user_id,
      workspace_id,
      subscription_id,
      plan_offer_id,
      currency,
      amount_usd
    ) values (
      'subscription',
      'pending',
      'disabled',
      v_user_id,
      p_workspace_id,
      v_workspace.subscription_id,
      v_offer.id,
      v_offer.currency,
      v_offer.price_usd
    )
    returning id into v_checkout_id;

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
      v_workspace.subscription_id,
      p_workspace_id,
      v_checkout_id,
      'disabled',
      'checkout_session_created',
      v_offer.price_usd,
      v_offer.currency,
      jsonb_build_object(
        'checkout_kind', 'subscription',
        'offer_code', v_offer.code,
        'simulation', true
      )
    );

    if v_workspace.subscription_id is null then
      insert into public.subscriptions (
        user_id,
        provider,
        offer_code,
        plan_code,
        status,
        billing_cycle,
        budget_limit_usd,
        current_period_start,
        current_period_end,
        next_billing_at,
        payment_method_summary,
        status_reason,
        provider_subscription_id
      ) values (
        v_user_id,
        'disabled',
        v_offer.code,
        v_offer.plan_code,
        v_subscription_status,
        v_offer.billing_cycle,
        v_offer.budget_limit_usd,
        v_period_start,
        v_period_end,
        v_period_end,
        'Simulation mode',
        'Simulated checkout applied locally',
        'sim_subscription_' || replace(v_checkout_id::text, '-', '')
      )
      returning id into v_subscription_id;

      update public.workspaces
      set subscription_id = v_subscription_id
      where id = p_workspace_id;
    else
      v_subscription_id := v_workspace.subscription_id;

      update public.subscriptions
      set user_id = v_user_id,
          provider = 'disabled',
          offer_code = v_offer.code,
          plan_code = v_offer.plan_code,
          status = v_subscription_status,
          billing_cycle = v_offer.billing_cycle,
          budget_limit_usd = v_offer.budget_limit_usd,
          current_period_start = v_period_start,
          current_period_end = v_period_end,
          next_billing_at = v_period_end,
          payment_method_summary = 'Simulation mode',
          status_reason = 'Simulated checkout applied locally',
          provider_subscription_id = 'sim_subscription_' || replace(v_checkout_id::text, '-', ''),
          cancel_at_period_end = false
      where id = v_subscription_id;
    end if;

    select *
    into v_allocation
    from public.plan_au_allocations
    where plan_code = v_offer.plan_code;

    update public.billing_checkout_sessions
    set status = 'completed',
        subscription_id = v_subscription_id,
        provider_session_id = 'sim_checkout_' || replace(v_checkout_id::text, '-', ''),
        provider_payment_intent_id = 'sim_payment_' || replace(v_checkout_id::text, '-', ''),
        completed_at = now()
    where id = v_checkout_id;

    if coalesce(v_allocation.monthly_micro, 0) > 0 then
      insert into public.au_wallets (workspace_id)
      values (p_workspace_id)
      on conflict (workspace_id) do nothing;

      select coalesce(sum(amount_micro), 0)
      into v_existing_cycle_grant_micro
      from public.subscription_au_grants
      where subscription_id = v_subscription_id
        and workspace_id = p_workspace_id
        and period_start = v_period_start::date
        and source = 'cycle_reset';

      select id, coalesce(amount_micro, 0)
      into v_adjustment_grant_id, v_existing_adjustment_micro
      from public.subscription_au_grants
      where subscription_id = v_subscription_id
        and workspace_id = p_workspace_id
        and period_start = v_period_start::date
        and source = 'manual_adjustment'
      order by created_at desc
      limit 1;

      select transaction_id
      into v_existing_grant
      from public.subscription_au_grants
      where subscription_id = v_subscription_id
        and workspace_id = p_workspace_id
        and period_start = v_period_start::date
        and source = 'cycle_reset';

      if v_existing_grant is null then
        update public.au_wallets
        set balance_micro = balance_micro + v_allocation.monthly_micro,
            lifetime_earned = lifetime_earned + v_allocation.monthly_micro
        where workspace_id = p_workspace_id
        returning id, balance_micro into v_wallet_id, v_balance_after;

        insert into public.au_transactions (
          wallet_id,
          transaction_type,
          amount_micro,
          balance_after,
          reference_type,
          reference_id,
          description
        ) values (
          v_wallet_id,
          'bonus',
          v_allocation.monthly_micro,
          v_balance_after,
          'subscription',
          v_subscription_id,
          'Plan AU allocation for ' || v_offer.plan_code || ' (simulation)'
        )
        returning id into v_transaction_id;

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
          v_subscription_id,
          p_workspace_id,
          v_period_start::date,
          v_period_end::date,
          v_allocation.monthly_micro,
          0,
          v_transaction_id,
          'cycle_reset'
        );
      else
        v_transaction_id := v_existing_grant;

        v_adjustment_micro := greatest(
          v_allocation.monthly_micro
            - v_existing_cycle_grant_micro
            - v_existing_adjustment_micro,
          0
        );

        if v_adjustment_micro > 0 then
          update public.au_wallets
          set balance_micro = balance_micro + v_adjustment_micro,
              lifetime_earned = lifetime_earned + v_adjustment_micro
          where workspace_id = p_workspace_id
          returning id, balance_micro into v_wallet_id, v_balance_after;

          insert into public.au_transactions (
            wallet_id,
            transaction_type,
            amount_micro,
            balance_after,
            reference_type,
            reference_id,
            description
          ) values (
            v_wallet_id,
            'bonus',
            v_adjustment_micro,
            v_balance_after,
            'subscription',
            v_subscription_id,
            'Plan AU upgrade adjustment for ' || v_offer.plan_code || ' (simulation)'
          )
          returning id into v_transaction_id;

          if v_adjustment_grant_id is null then
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
              v_subscription_id,
              p_workspace_id,
              v_period_start::date,
              v_period_end::date,
              v_adjustment_micro,
              0,
              v_transaction_id,
              'manual_adjustment'
            );
          else
            update public.subscription_au_grants
            set amount_micro = amount_micro + v_adjustment_micro,
                updated_at = now()
            where id = v_adjustment_grant_id;
          end if;
        end if;
      end if;
    end if;

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
      p_workspace_id,
      v_checkout_id,
      'disabled',
      'checkout_session_completed',
      v_offer.price_usd,
      v_offer.currency,
      jsonb_build_object(
        'checkout_kind', 'subscription',
        'offer_code', v_offer.code,
        'simulation', true
      )
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
      p_workspace_id,
      v_checkout_id,
      'disabled',
      'payment_succeeded',
      v_offer.price_usd,
      v_offer.currency,
      jsonb_build_object(
        'offer_code', v_offer.code,
        'simulation', true,
        'wallet_transaction_id', v_transaction_id
      )
    );

    return jsonb_build_object(
      'kind', 'subscription',
      'status', 'completed',
      'checkoutSessionId', v_checkout_id,
      'subscriptionId', v_subscription_id,
      'walletTransactionId', v_transaction_id,
      'offerCode', v_offer.code,
      'message', 'Simulated checkout completed. Plan benefits and included AU were applied.'
    );
  end if;

  if p_pack_code is null then
    raise exception 'pack code is required';
  end if;

  select *
  into v_pack
  from public.au_packs
  where code = p_pack_code
    and is_active = true;

  if not found then
    raise exception 'AU pack % not found', p_pack_code;
  end if;

  insert into public.billing_checkout_sessions (
    session_kind,
    status,
    provider,
    user_id,
    workspace_id,
    au_pack_id,
    currency,
    amount_usd
  ) values (
    'au_pack',
    'pending',
    'disabled',
    v_user_id,
    p_workspace_id,
    v_pack.id,
    v_pack.currency,
    v_pack.price_usd
  )
  returning id into v_checkout_id;

  insert into public.au_pack_purchases (
    user_id,
    workspace_id,
    au_pack_id,
    checkout_session_id,
    status,
    gross_amount_usd,
    currency,
    provider
  ) values (
    v_user_id,
    p_workspace_id,
    v_pack.id,
    v_checkout_id,
    'paid',
    v_pack.price_usd,
    v_pack.currency,
    'disabled'
  )
  returning id into v_purchase_id;

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
    p_workspace_id,
    v_checkout_id,
    v_purchase_id,
    'disabled',
    'checkout_session_created',
    v_pack.price_usd,
    v_pack.currency,
    jsonb_build_object(
      'checkout_kind', 'au_pack',
      'pack_code', v_pack.code,
      'simulation', true
    )
  );

  insert into public.au_wallets (workspace_id)
  values (p_workspace_id)
  on conflict (workspace_id) do nothing;

  update public.au_wallets
  set balance_micro = balance_micro + v_pack.amount_micro + v_pack.bonus_micro,
      lifetime_earned = lifetime_earned + v_pack.amount_micro + v_pack.bonus_micro
  where workspace_id = p_workspace_id
  returning id, balance_micro into v_wallet_id, v_balance_after;

  insert into public.au_transactions (
    wallet_id,
    transaction_type,
    amount_micro,
    balance_after,
    reference_type,
    reference_id,
    description
  ) values (
    v_wallet_id,
    'purchase',
    v_pack.amount_micro + v_pack.bonus_micro,
    v_balance_after,
    'pack_purchase',
    v_purchase_id,
    'AU pack purchase credited: ' || v_pack.name || ' (simulation)'
  )
  returning id into v_transaction_id;

  update public.au_pack_purchases
  set status = 'credited',
      credited_micro = v_pack.amount_micro,
      bonus_credited_micro = v_pack.bonus_micro,
      credited_at = now()
  where id = v_purchase_id;

  update public.billing_checkout_sessions
  set status = 'completed',
      provider_session_id = 'sim_checkout_' || replace(v_checkout_id::text, '-', ''),
      provider_payment_intent_id = 'sim_payment_' || replace(v_checkout_id::text, '-', ''),
      completed_at = now()
  where id = v_checkout_id;

  insert into public.billing_events (
    workspace_id,
    checkout_session_id,
    provider,
    event_type,
    amount_usd,
    currency,
    payload
  ) values (
    p_workspace_id,
    v_checkout_id,
    'disabled',
    'checkout_session_completed',
    v_pack.price_usd,
    v_pack.currency,
    jsonb_build_object(
      'checkout_kind', 'au_pack',
      'pack_code', v_pack.code,
      'simulation', true
    )
  );

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
    p_workspace_id,
    v_checkout_id,
    v_purchase_id,
    'disabled',
    'pack_purchase_completed',
    v_pack.price_usd,
    v_pack.currency,
    jsonb_build_object(
      'pack_code', v_pack.code,
      'simulation', true,
      'wallet_transaction_id', v_transaction_id
    )
  );

  return jsonb_build_object(
    'kind', 'au_pack',
    'status', 'completed',
    'checkoutSessionId', v_checkout_id,
    'packPurchaseId', v_purchase_id,
    'walletTransactionId', v_transaction_id,
    'packCode', v_pack.code,
    'message', 'Simulated checkout completed. The AU pack was credited to the wallet.'
  );
end;
$$ language plpgsql;

create or replace function public.simulate_billing_portal_session(
  p_workspace_id uuid
)
returns jsonb
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace public.workspaces%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if not public.user_has_workspace_access(p_workspace_id) then
    raise exception 'workspace access denied';
  end if;

  select *
  into v_workspace
  from public.workspaces
  where id = p_workspace_id;

  if not found then
    raise exception 'workspace % not found', p_workspace_id;
  end if;

  insert into public.billing_events (
    subscription_id,
    workspace_id,
    provider,
    event_type,
    payload
  ) values (
    v_workspace.subscription_id,
    p_workspace_id,
    'disabled',
    'portal_session_created',
    jsonb_build_object(
      'simulation', true,
      'status', 'open'
    )
  );

  return jsonb_build_object(
    'status', 'open',
    'url', null,
    'message', 'Simulation mode is active. Manage plans and AU directly from this screen.'
  );
end;
$$ language plpgsql;

revoke all on function public.simulate_billing_checkout(uuid, text, text, text) from public;
grant execute on function public.simulate_billing_checkout(uuid, text, text, text) to authenticated;

revoke all on function public.simulate_billing_portal_session(uuid) from public;
grant execute on function public.simulate_billing_portal_session(uuid) to authenticated;
