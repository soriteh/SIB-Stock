-- SIB Stock: tenant subscription lifecycle and customer requests.
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_amount numeric(18,2) check (price_amount is null or price_amount >= 0),
  currency_code char(3) not null default 'GNF',
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','quarterly','yearly','custom')),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans(code,name,description,price_amount,currency_code,billing_interval,features,sort_order)
values
 ('trial','Essai gratuit','Découverte de SIB Stock pendant 33 jours',0,'GNF','custom','["Accès aux fonctionnalités principales","Données isolées par entreprise","Assistance par e-mail"]'::jsonb,0),
 ('essential','Essentiel','Pour démarrer et organiser la gestion de stock',null,'GNF','monthly','["Gestion des produits et entrepôts","Mouvements et inventaires","Rapports et alertes"]'::jsonb,1),
 ('business','Business','Pour les équipes qui gèrent plusieurs opérations',null,'GNF','monthly','["Toutes les fonctionnalités Essentiel","Achats, ventes et finances","Gestion des utilisateurs"]'::jsonb,2),
 ('enterprise','Entreprise','Pour les organisations avec des besoins avancés',null,'GNF','yearly','["Toutes les fonctionnalités Business","Accompagnement personnalisé","Configuration adaptée"]'::jsonb,3)
on conflict (code) do nothing;

create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id),
  status text not null default 'active' check (status in ('trial','active','past_due','expired','cancelled','suspended')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_plan_id uuid not null references public.subscription_plans(id),
  payment_method text not null check (payment_method in ('orange_money','mobile_money','bank_transfer','cash','other')),
  payment_reference text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists subscription_requests_tenant_created_idx
  on public.subscription_requests(tenant_id, created_at desc);

alter table public.subscription_plans enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.subscription_requests enable row level security;

drop policy if exists "authenticated read active subscription plans" on public.subscription_plans;
create policy "authenticated read active subscription plans"
on public.subscription_plans for select to authenticated
using (is_active = true);

drop policy if exists "members read own tenant subscription" on public.tenant_subscriptions;
create policy "members read own tenant subscription"
on public.tenant_subscriptions for select to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists "owners read subscription requests" on public.subscription_requests;
create policy "owners read subscription requests"
on public.subscription_requests for select to authenticated
using (tenant_id = public.current_tenant_id() and public.has_tenant_role(array['owner','admin']));

drop policy if exists "owners create subscription requests" on public.subscription_requests;
create policy "owners create subscription requests"
on public.subscription_requests for insert to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and created_by = auth.uid()
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and public.has_tenant_role(array['owner','admin'])
);

grant select on public.subscription_plans to authenticated;
grant select on public.tenant_subscriptions to authenticated;
grant select, insert on public.subscription_requests to authenticated;
revoke update, delete on public.subscription_requests from authenticated;

insert into public.tenant_subscriptions(tenant_id,status,current_period_start)
select t.id,'active',t.created_at
from public.tenants t
where not exists (select 1 from public.tenant_subscriptions s where s.tenant_id=t.id);

create or replace function public.create_tenant(
  p_name text,
  p_slug text,
  p_country_code char(2) default null,
  p_currency_code char(3) default 'GNF'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_tenant_id uuid;
  trial_plan_id uuid;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Company name must contain at least 2 characters' using errcode = '22023';
  end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'Invalid tenant slug' using errcode = '22023';
  end if;

  insert into public.tenants(name,slug,country_code,currency_code,status)
  values (trim(p_name),lower(p_slug),upper(p_country_code),upper(coalesce(p_currency_code,'GNF')),'trial')
  returning id into new_tenant_id;

  insert into public.tenant_members(tenant_id,user_id,role,status)
  values (new_tenant_id,actor,'owner','active');

  insert into public.profiles(id,active_tenant_id)
  values (actor,new_tenant_id)
  on conflict (id) do update
    set active_tenant_id=excluded.active_tenant_id,updated_at=now();

  select id into trial_plan_id from public.subscription_plans where code='trial' and is_active=true;
  insert into public.tenant_subscriptions(
    tenant_id,plan_id,status,trial_started_at,trial_ends_at,current_period_start,current_period_end
  ) values (
    new_tenant_id,trial_plan_id,'trial',now(),now()+interval '33 days',now(),now()+interval '33 days'
  );

  return new_tenant_id;
end;
$$;

revoke all on function public.create_tenant(text,text,char,char) from public;
grant execute on function public.create_tenant(text,text,char,char) to authenticated;
-- Enforce one outstanding request per tenant without privileged RPCs.
create unique index if not exists subscription_requests_one_pending_per_tenant
  on public.subscription_requests(tenant_id)
  where status='pending';
