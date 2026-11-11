-- Enforce Business-tier access at the database boundary for paid operational modules.
-- Existing records remain readable according to the tenant's existing RLS policies.
create or replace function public.enforce_tenant_plan_feature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_plan_tier text;
  v_status text;
  v_required_tier text := coalesce(nullif(tg_argv[0], ''), 'business');
  v_current_rank integer;
  v_required_rank integer;
begin
  v_tenant_id := (to_jsonb(new)->>'tenant_id')::uuid;
  if v_tenant_id is null then
    raise exception 'Entreprise introuvable pour vérifier les droits de votre abonnement.'
      using errcode = '23514';
  end if;

  select coalesce(sp.plan_tier, 'trial'), ts.status
    into v_plan_tier, v_status
  from public.tenant_subscriptions ts
  left join public.subscription_plans sp on sp.id = ts.plan_id
  where ts.tenant_id = v_tenant_id
  order by ts.created_at desc
  limit 1;

  if not found then
    v_plan_tier := 'trial';
    v_status := 'trial';
  end if;

  if v_status in ('expired', 'cancelled', 'suspended', 'past_due') then
    raise exception 'Votre abonnement ne permet plus cette opération. Veuillez renouveler votre offre.'
      using errcode = '42501';
  end if;

  v_current_rank := case v_plan_tier
    when 'trial' then 0
    when 'essential' then 1
    when 'business' then 2
    when 'premium' then 3
    when 'enterprise' then 4
    else 0
  end;
  v_required_rank := case v_required_tier
    when 'trial' then 0
    when 'essential' then 1
    when 'business' then 2
    when 'premium' then 3
    when 'enterprise' then 4
    else 2
  end;

  if v_current_rank < v_required_rank then
    raise exception 'Cette fonctionnalité nécessite au minimum l’offre %.', upper(v_required_tier)
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_tenant_plan_feature() from public, anon, authenticated;

drop trigger if exists require_business_inventory_documents on public.inventory_documents;
create trigger require_business_inventory_documents
before insert or update of tenant_id, document_type on public.inventory_documents
for each row
when (new.document_type in ('purchase', 'sale'))
execute function public.enforce_tenant_plan_feature('business');

drop trigger if exists require_business_stock_transfers on public.stock_transfers;
create trigger require_business_stock_transfers
before insert or update of tenant_id on public.stock_transfers
for each row execute function public.enforce_tenant_plan_feature('business');

drop trigger if exists require_business_financial_transactions on public.financial_transactions;
create trigger require_business_financial_transactions
before insert or update of tenant_id on public.financial_transactions
for each row execute function public.enforce_tenant_plan_feature('business');

drop trigger if exists require_business_financial_transfers on public.financial_transfers;
create trigger require_business_financial_transfers
before insert or update of tenant_id on public.financial_transfers
for each row execute function public.enforce_tenant_plan_feature('business');

drop trigger if exists require_business_tenant_members on public.tenant_members;
create trigger require_business_tenant_members
before insert on public.tenant_members
for each row execute function public.enforce_tenant_plan_feature('business');
