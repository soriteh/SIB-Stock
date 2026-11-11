-- Keep initial owner membership possible during tenant onboarding.
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

  if tg_table_name = 'tenant_members'
     and not exists (
       select 1 from public.tenant_members tm
       where tm.tenant_id = v_tenant_id and tm.status = 'active'
     ) then
    return new;
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
    when 'trial' then 0 when 'essential' then 1 when 'business' then 2
    when 'premium' then 3 when 'enterprise' then 4 else 0 end;
  v_required_rank := case v_required_tier
    when 'trial' then 0 when 'essential' then 1 when 'business' then 2
    when 'premium' then 3 when 'enterprise' then 4 else 2 end;

  if v_current_rank < v_required_rank then
    raise exception 'Cette fonctionnalité nécessite au minimum l’offre %.', upper(v_required_tier)
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_tenant_plan_feature() from public, anon, authenticated;
