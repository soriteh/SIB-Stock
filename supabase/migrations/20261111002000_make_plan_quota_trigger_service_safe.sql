create or replace function public.enforce_tenant_plan_quota()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
 v_limit integer; v_count bigint; v_tenant_id uuid:=new.tenant_id; v_status text; v_limits jsonb;
begin
 select ts.status,coalesce(sp.limits,'{"users":2,"products":100,"warehouses":1,"establishments":1,"history_months":1}'::jsonb)
 into v_status,v_limits from public.tenant_subscriptions ts
 left join public.subscription_plans sp on sp.id=ts.plan_id
 where ts.tenant_id=v_tenant_id order by ts.updated_at desc limit 1;
 if not found then v_limits:='{"users":2,"products":100,"warehouses":1,"establishments":1,"history_months":1}'::jsonb; end if;
 if v_status in ('expired','cancelled','suspended','past_due') then
  raise exception 'Abonnement inactif : renouvellement nécessaire pour ajouter des ressources' using errcode='42501';
 end if;
 if tg_table_name='products' then
  v_limit:=nullif(v_limits->>'products','')::integer;
  select count(*) into v_count from public.products where tenant_id=v_tenant_id;
 elsif tg_table_name='warehouses' then
  v_limit:=nullif(v_limits->>'warehouses','')::integer;
  select count(*) into v_count from public.warehouses where tenant_id=v_tenant_id;
 elsif tg_table_name='tenant_members' then
  v_limit:=nullif(v_limits->>'users','')::integer;
  select count(*) into v_count from public.tenant_members where tenant_id=v_tenant_id and status='active';
 else return new; end if;
 if v_limit is not null and v_count>=v_limit then
  raise exception 'Limite de votre offre atteinte (%). Passez à une offre supérieure pour continuer.',v_limit using errcode='23514';
 end if;
 return new;
end $$;