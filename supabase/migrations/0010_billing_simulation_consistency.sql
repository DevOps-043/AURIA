alter table public.subscription_au_grants
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_subscription_au_grants_updated_at on public.subscription_au_grants;

create trigger trg_subscription_au_grants_updated_at
  before update on public.subscription_au_grants
  for each row execute function public.set_updated_at();

update public.subscriptions
set provider = coalesce(provider, 'disabled'),
    offer_code = coalesce(
      offer_code,
      (
        select code
        from public.billing_plan_offers offer
        where offer.plan_code = subscriptions.plan_code
          and offer.billing_cycle = subscriptions.billing_cycle
          and offer.is_active = true
        order by offer.sort_order
        limit 1
      )
    ),
    next_billing_at = coalesce(next_billing_at, current_period_end),
    status_reason = coalesce(status_reason, ''),
    plan_code = plan_code,
    billing_cycle = billing_cycle;

update public.workspaces workspace
set max_concurrent_agents = coalesce(subscription.agents_simultaneous, workspace.max_concurrent_agents)
from public.subscriptions subscription
where workspace.subscription_id = subscription.id;

insert into public.au_wallets (workspace_id)
select workspace.id
from public.workspaces workspace
left join public.au_wallets wallet on wallet.workspace_id = workspace.id
where wallet.id is null;

do $$
declare
  record_row record;
  v_cycle_micro bigint;
  v_adjustment_micro bigint;
  v_missing_micro bigint;
  v_wallet_id uuid;
  v_balance_after bigint;
  v_transaction_id uuid;
  v_adjustment_grant_id uuid;
begin
  for record_row in
    select
      subscription.id as subscription_id,
      workspace.id as workspace_id,
      subscription.plan_code,
      subscription.current_period_start::date as period_start,
      subscription.current_period_end::date as period_end,
      coalesce(subscription.au_included_monthly, allocation.monthly_micro, 0) as target_micro
    from public.subscriptions subscription
    join public.workspaces workspace on workspace.subscription_id = subscription.id
    left join public.plan_au_allocations allocation on allocation.plan_code = subscription.plan_code
    where subscription.status in ('trialing', 'active')
  loop
    if coalesce(record_row.target_micro, 0) <= 0 then
      continue;
    end if;

    v_cycle_micro := 0;
    v_adjustment_micro := 0;
    v_adjustment_grant_id := null;

    select coalesce(sum(amount_micro), 0)
    into v_cycle_micro
    from public.subscription_au_grants
    where subscription_id = record_row.subscription_id
      and workspace_id = record_row.workspace_id
      and period_start = record_row.period_start
      and source = 'cycle_reset';

    select id, coalesce(amount_micro, 0)
    into v_adjustment_grant_id, v_adjustment_micro
    from public.subscription_au_grants
    where subscription_id = record_row.subscription_id
      and workspace_id = record_row.workspace_id
      and period_start = record_row.period_start
      and source = 'manual_adjustment'
    order by created_at desc
    limit 1;

    v_missing_micro := greatest(
      record_row.target_micro - v_cycle_micro - coalesce(v_adjustment_micro, 0),
      0
    );

    if v_missing_micro <= 0 then
      continue;
    end if;

    update public.au_wallets
    set balance_micro = balance_micro + v_missing_micro,
        lifetime_earned = lifetime_earned + v_missing_micro
    where workspace_id = record_row.workspace_id
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
      v_missing_micro,
      v_balance_after,
      'subscription',
      record_row.subscription_id,
      'Subscription AU reconciliation for ' || record_row.plan_code || ' (0010)'
    )
    returning id into v_transaction_id;

    if v_cycle_micro = 0 then
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
        record_row.subscription_id,
        record_row.workspace_id,
        record_row.period_start,
        record_row.period_end,
        v_missing_micro,
        0,
        v_transaction_id,
        'cycle_reset'
      );
    elsif v_adjustment_grant_id is null then
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
        record_row.subscription_id,
        record_row.workspace_id,
        record_row.period_start,
        record_row.period_end,
        v_missing_micro,
        0,
        v_transaction_id,
        'manual_adjustment'
      );
    else
      update public.subscription_au_grants
      set amount_micro = amount_micro + v_missing_micro
      where id = v_adjustment_grant_id;
    end if;
  end loop;
end;
$$;
