alter table public.subscription_plans add column if not exists limits jsonb not null default '{}'::jsonb;

update public.subscription_plans set limits = case plan_tier
 when 'trial' then '{"users":2,"products":100,"warehouses":1,"establishments":1,"history_months":1}'::jsonb
 when 'essential' then '{"users":2,"products":500,"warehouses":1,"establishments":1,"history_months":3}'::jsonb
 when 'business' then '{"users":5,"products":3000,"warehouses":3,"establishments":1,"history_months":12}'::jsonb
 when 'premium' then '{"users":15,"products":15000,"warehouses":10,"establishments":3,"history_months":36}'::jsonb
 when 'enterprise' then '{"users":null,"products":null,"warehouses":null,"establishments":null,"history_months":null}'::jsonb
 else limits end where limits='{}'::jsonb;

insert into public.subscription_plans(code,name,description,price_amount,currency_code,billing_interval,features,is_active,sort_order,plan_tier,limits)
values ('premium','Premium','Pour les entreprises qui pilotent des stocks avancés et plusieurs dépôts',null,'GNF','monthly',
 '["Toutes les fonctionnalités Business","Analyse des marges et valorisation du stock","Rapports avancés et indicateurs de performance","Jusqu’à 15 utilisateurs et 10 entrepôts"]'::jsonb,true,3,'premium',
 '{"users":15,"products":15000,"warehouses":10,"establishments":3,"history_months":36}'::jsonb)
on conflict(code) do update set plan_tier='premium',limits=excluded.limits,features=excluded.features;

create or replace function public.tenant_plan_limits(p_tenant_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_tenant_id uuid := coalesce(p_tenant_id,public.current_tenant_id()); v_limits jsonb;
begin
 if auth.uid() is null or v_tenant_id is null then raise exception 'Authentification et entreprise active requises' using errcode='42501'; end if;
 if p_tenant_id is not null and p_tenant_id <> public.current_tenant_id() and not public.is_platform_admin() then
  raise exception 'Accès refusé aux limites de cette entreprise' using errcode='42501';
 end if;
 select coalesce(sp.limits,'{}'::jsonb) into v_limits from public.tenant_subscriptions ts
 left join public.subscription_plans sp on sp.id=ts.plan_id where ts.tenant_id=v_tenant_id order by ts.updated_at desc limit 1;
 return coalesce(v_limits,'{"users":2,"products":100,"warehouses":1,"establishments":1,"history_months":1}'::jsonb);
end $$;
revoke all on function public.tenant_plan_limits(uuid) from public,anon;
grant execute on function public.tenant_plan_limits(uuid) to authenticated;

create or replace function public.enforce_tenant_plan_quota()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_limit integer; v_count bigint; v_tenant_id uuid:=new.tenant_id; v_status text;
begin
 select ts.status into v_status from public.tenant_subscriptions ts where ts.tenant_id=v_tenant_id order by ts.updated_at desc limit 1;
 if v_status in ('expired','cancelled','suspended','past_due') then
  raise exception 'Abonnement inactif : renouvellement nécessaire pour ajouter des ressources' using errcode='42501';
 end if;
 if tg_table_name='products' then
  v_limit:=nullif(public.tenant_plan_limits(v_tenant_id)->>'products','')::integer;
  select count(*) into v_count from public.products where tenant_id=v_tenant_id;
 elsif tg_table_name='warehouses' then
  v_limit:=nullif(public.tenant_plan_limits(v_tenant_id)->>'warehouses','')::integer;
  select count(*) into v_count from public.warehouses where tenant_id=v_tenant_id;
 elsif tg_table_name='tenant_members' then
  v_limit:=nullif(public.tenant_plan_limits(v_tenant_id)->>'users','')::integer;
  select count(*) into v_count from public.tenant_members where tenant_id=v_tenant_id and status='active';
 else return new; end if;
 if v_limit is not null and v_count>=v_limit then
  raise exception 'Limite de votre offre atteinte (%). Passez à une offre supérieure pour continuer.',v_limit using errcode='23514';
 end if;
 return new;
end $$;

drop trigger if exists enforce_plan_product_quota on public.products;
create trigger enforce_plan_product_quota before insert on public.products for each row execute function public.enforce_tenant_plan_quota();
drop trigger if exists enforce_plan_warehouse_quota on public.warehouses;
create trigger enforce_plan_warehouse_quota before insert on public.warehouses for each row execute function public.enforce_tenant_plan_quota();
drop trigger if exists enforce_plan_member_quota on public.tenant_members;
create trigger enforce_plan_member_quota before insert on public.tenant_members for each row execute function public.enforce_tenant_plan_quota();
revoke all on function public.enforce_tenant_plan_quota() from public,anon,authenticated;

create or replace function public.admin_save_subscription_plan(
 p_id uuid,p_code text,p_name text,p_description text,p_price numeric,p_currency text,p_interval text,
 p_features jsonb,p_active boolean,p_sort integer,p_tier text,p_limits jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Accès réservé au Super Administrateur' using errcode='42501'; end if;
 if nullif(trim(p_code),'') is null or nullif(trim(p_name),'') is null then raise exception 'Code et nom obligatoires'; end if;
 if p_interval not in ('monthly','quarterly','yearly','custom') then raise exception 'Périodicité invalide'; end if;
 if p_tier not in ('trial','essential','business','premium','enterprise') then raise exception 'Type de licence invalide'; end if;
 if p_price is not null and p_price<0 then raise exception 'Le tarif ne peut pas être négatif'; end if;
 if p_currency !~ '^[A-Za-z]{3}$' then raise exception 'Code devise invalide'; end if;
 if p_tier='trial' and p_interval<>'custom' then raise exception 'La formule Essai doit utiliser une périodicité personnalisée'; end if;
 if p_tier<>'trial' and p_interval='custom' then raise exception 'Une formule commerciale doit être mensuelle, trimestrielle ou annuelle'; end if;
 if jsonb_typeof(coalesce(p_limits,'{}'::jsonb))<>'object' then raise exception 'Les quotas doivent être un objet JSON'; end if;
 if exists(select 1 from jsonb_each(coalesce(p_limits,'{}'::jsonb)) e where e.key not in ('users','products','warehouses','establishments','history_months')
  or (e.value<>'null'::jsonb and (e.value::text !~ '^[0-9]+$' or (e.value::text)::integer<1))) then
  raise exception 'Quota invalide : utilisez un entier positif ou null pour illimité';
 end if;
 if p_id is null then
  insert into public.subscription_plans(code,name,description,price_amount,currency_code,billing_interval,features,is_active,sort_order,plan_tier,limits)
  values(lower(trim(p_code)),trim(p_name),nullif(trim(p_description),''),p_price,upper(p_currency),p_interval,coalesce(p_features,'[]'::jsonb),p_active,p_sort,p_tier,coalesce(p_limits,'{}'::jsonb)) returning id into v_id;
 else
  update public.subscription_plans set code=lower(trim(p_code)),name=trim(p_name),description=nullif(trim(p_description),''),price_amount=p_price,
   currency_code=upper(p_currency),billing_interval=p_interval,features=coalesce(p_features,'[]'::jsonb),is_active=p_active,sort_order=p_sort,
   plan_tier=p_tier,limits=coalesce(p_limits,'{}'::jsonb) where id=p_id returning id into v_id;
  if not found then raise exception 'Offre introuvable'; end if;
 end if;
 insert into public.platform_admin_audit_log(actor_user_id,action,entity_type,entity_id,details)
 values(auth.uid(),case when p_id is null then 'plan_created' else 'plan_updated' end,'subscription_plan',v_id,
 jsonb_build_object('code',p_code,'name',p_name,'active',p_active,'plan_tier',p_tier,'billing_interval',p_interval,'limits',p_limits));
 return v_id;
end $$;
revoke all on function public.admin_save_subscription_plan(uuid,text,text,text,numeric,text,text,jsonb,boolean,integer,text) from public,anon,authenticated;
revoke all on function public.admin_save_subscription_plan(uuid,text,text,text,numeric,text,text,jsonb,boolean,integer,text,jsonb) from public,anon;
grant execute on function public.admin_save_subscription_plan(uuid,text,text,text,numeric,text,text,jsonb,boolean,integer,text,jsonb) to authenticated;

create or replace function public.get_platform_admin_overview()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Accès réservé au Super Administrateur' using errcode='42501'; end if;
 select jsonb_build_object(
 'stats',jsonb_build_object('tenants',(select count(*) from public.tenants),'active_tenants',(select count(*) from public.tenants where status='active'),
 'subscriptions',(select count(*) from public.tenant_subscriptions),'pending_requests',(select count(*) from public.subscription_requests where status='pending'),
 'trial_subscriptions',(select count(*) from public.tenant_subscriptions where status='trial'),'expired_subscriptions',(select count(*) from public.tenant_subscriptions where status='expired')),
 'tenants',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug,'status',t.status,'country_code',t.country_code,
 'currency_code',t.currency_code,'created_at',t.created_at,'email',t.email,'phone',t.phone,'subscription_status',ts.status,'plan_id',ts.plan_id,
 'plan_name',sp.name,'plan_tier',sp.plan_tier,'period_end',ts.current_period_end,'trial_ends_at',ts.trial_ends_at) order by t.created_at desc)
 from public.tenants t left join lateral(select * from public.tenant_subscriptions s where s.tenant_id=t.id order by s.updated_at desc limit 1) ts on true
 left join public.subscription_plans sp on sp.id=ts.plan_id),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',sr.id,'tenant_id',sr.tenant_id,'tenant_name',t.name,'plan_name',sp.name,
 'requested_plan_id',sr.requested_plan_id,'payment_method',sr.payment_method,'payment_reference',sr.payment_reference,'note',sr.note,
 'status',sr.status,'created_at',sr.created_at,'review_note',sr.review_note) order by sr.created_at desc)
 from public.subscription_requests sr join public.tenants t on t.id=sr.tenant_id left join public.subscription_plans sp on sp.id=sr.requested_plan_id
 where sr.status='pending'),'[]'::jsonb),
 'plans',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'description',description,'price_amount',price_amount,
 'currency_code',currency_code,'billing_interval',billing_interval,'plan_tier',plan_tier,'features',features,'limits',limits,
 'is_active',is_active,'sort_order',sort_order) order by sort_order) from public.subscription_plans),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'action',l.action,'entity_type',l.entity_type,'entity_id',l.entity_id,
 'details',l.details,'created_at',l.created_at,'actor_email',u.email) order by l.created_at desc)
 from (select * from public.platform_admin_audit_log order by created_at desc limit 30) l left join auth.users u on u.id=l.actor_user_id),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.get_platform_admin_overview() from public,anon;
grant execute on function public.get_platform_admin_overview() to authenticated;
