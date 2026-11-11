-- Establishment foundation: tenant-scoped sites with a default site for existing tenants.
create table if not exists public.establishments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null, name text not null, address text, phone text, email text,
  is_primary boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint establishments_tenant_code_unique unique (tenant_id, code),
  constraint establishments_id_tenant_unique unique (id, tenant_id)
);
create unique index if not exists establishments_one_primary_per_tenant on public.establishments(tenant_id) where is_primary;
alter table public.warehouses add column if not exists establishment_id uuid;
alter table public.financial_accounts add column if not exists establishment_id uuid;
alter table public.tenant_members add column if not exists establishment_id uuid;
alter table public.profiles add column if not exists active_establishment_id uuid;
insert into public.establishments (tenant_id,code,name,address,is_primary)
select t.id,'SITE-PRINCIPAL',coalesce(nullif(t.name,''),'Établissement principal'),t.address,true
from public.tenants t where not exists(select 1 from public.establishments e where e.tenant_id=t.id);
update public.warehouses w set establishment_id=e.id from public.establishments e where e.tenant_id=w.tenant_id and e.is_primary and w.establishment_id is null;
update public.financial_accounts a set establishment_id=e.id from public.establishments e where e.tenant_id=a.tenant_id and e.is_primary and a.establishment_id is null;
update public.tenant_members m set establishment_id=e.id from public.establishments e where e.tenant_id=m.tenant_id and e.is_primary and m.establishment_id is null;
update public.profiles p set active_establishment_id=e.id from public.tenant_members m join public.establishments e on e.tenant_id=m.tenant_id and e.is_primary where p.id=m.user_id and m.tenant_id=public.current_tenant_id() and p.active_establishment_id is null;
alter table public.warehouses alter column establishment_id set not null;
alter table public.financial_accounts alter column establishment_id set not null;
alter table public.tenant_members alter column establishment_id set not null;
alter table public.warehouses add constraint warehouses_establishment_tenant_fk foreign key(establishment_id,tenant_id) references public.establishments(id,tenant_id);
alter table public.financial_accounts add constraint financial_accounts_establishment_tenant_fk foreign key(establishment_id,tenant_id) references public.establishments(id,tenant_id);
alter table public.tenant_members add constraint tenant_members_establishment_tenant_fk foreign key(establishment_id,tenant_id) references public.establishments(id,tenant_id);
alter table public.profiles add constraint profiles_active_establishment_fk foreign key(active_establishment_id) references public.establishments(id) on delete set null;
create or replace function public.current_establishment_id() returns uuid language sql stable security definer set search_path='' as $$
select coalesce(
(select p.active_establishment_id from public.profiles p join public.establishments e on e.id=p.active_establishment_id where p.id=(select auth.uid()) and e.tenant_id=public.current_tenant_id() and e.is_active limit 1),
(select e.id from public.establishments e where e.tenant_id=public.current_tenant_id() and e.is_primary and e.is_active limit 1));
$$;
revoke all on function public.current_establishment_id() from public,anon;
grant execute on function public.current_establishment_id() to authenticated;
create or replace function public.enforce_establishment_quota() returns trigger language plpgsql security definer set search_path='' as $$
declare v_count integer; v_limit integer; v_plan_tier text;
begin
if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then raise exception 'Le rattachement d’un établissement à une autre entreprise est interdit.'; end if;
select count(*) into v_count from public.establishments e where e.tenant_id=new.tenant_id;
select sp.plan_tier,nullif(sp.limits->>'establishments','')::integer into v_plan_tier,v_limit from public.tenant_subscriptions ts join public.subscription_plans sp on sp.id=ts.plan_id where ts.tenant_id=new.tenant_id order by ts.created_at desc limit 1;
if not found then v_plan_tier:='trial';v_limit:=1;end if;
if v_limit is not null and (tg_op='INSERT' or (tg_op='UPDATE' and old.is_active=false and new.is_active=true)) and v_count>=v_limit then raise exception 'Quota d’établissements atteint pour votre offre (%).',coalesce(v_plan_tier,'trial') using errcode='42501';end if;
if new.is_primary then update public.establishments set is_primary=false where tenant_id=new.tenant_id and id<>new.id and is_primary=true;end if;
new.updated_at:=now();return new;end;$$;
revoke all on function public.enforce_establishment_quota() from public,anon,authenticated;
drop trigger if exists establishments_quota_guard on public.establishments;
create trigger establishments_quota_guard before insert or update on public.establishments for each row execute function public.enforce_establishment_quota();
alter table public.establishments enable row level security;
drop policy if exists establishments_read_tenant on public.establishments;
create policy establishments_read_tenant on public.establishments for select to authenticated using(tenant_id=public.current_tenant_id());
drop policy if exists establishments_admin_manage on public.establishments;
create policy establishments_admin_manage on public.establishments for all to authenticated using(tenant_id=public.current_tenant_id() and public.has_tenant_role(array['owner','admin','manager'])) with check(tenant_id=public.current_tenant_id() and public.has_tenant_role(array['owner','admin','manager']));
grant select,insert,update,delete on public.establishments to authenticated;
drop policy if exists establishment_scope_warehouses on public.warehouses;
create policy establishment_scope_warehouses on public.warehouses as restrictive for all to authenticated using(establishment_id=public.current_establishment_id()) with check(establishment_id=public.current_establishment_id());
drop policy if exists establishment_scope_inventory_documents on public.inventory_documents;
create policy establishment_scope_inventory_documents on public.inventory_documents as restrictive for all to authenticated using(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=public.current_establishment_id())) with check(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=public.current_establishment_id()));
drop policy if exists establishment_scope_stock_movements on public.stock_movements;
create policy establishment_scope_stock_movements on public.stock_movements as restrictive for all to authenticated using(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=public.current_establishment_id())) with check(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=public.current_establishment_id()));
drop policy if exists establishment_scope_stock_counts on public.stock_counts;
create policy establishment_scope_stock_counts on public.stock_counts as restrictive for all to authenticated using(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=public.current_establishment_id())) with check(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=public.current_establishment_id()));
drop policy if exists establishment_scope_stock_transfers on public.stock_transfers;
create policy establishment_scope_stock_transfers on public.stock_transfers as restrictive for all to authenticated using(exists(select 1 from public.warehouses w where w.id=source_warehouse_id and w.establishment_id=public.current_establishment_id()) and exists(select 1 from public.warehouses w where w.id=destination_warehouse_id and w.establishment_id=public.current_establishment_id())) with check(exists(select 1 from public.warehouses w where w.id=source_warehouse_id and w.establishment_id=public.current_establishment_id()) and exists(select 1 from public.warehouses w where w.id=destination_warehouse_id and w.establishment_id=public.current_establishment_id()));
drop policy if exists establishment_scope_financial_accounts on public.financial_accounts;
create policy establishment_scope_financial_accounts on public.financial_accounts as restrictive for all to authenticated using(establishment_id=public.current_establishment_id()) with check(establishment_id=public.current_establishment_id());
drop policy if exists establishment_scope_financial_transactions on public.financial_transactions;
create policy establishment_scope_financial_transactions on public.financial_transactions as restrictive for all to authenticated using(exists(select 1 from public.financial_accounts a where a.id=account_id and a.establishment_id=public.current_establishment_id())) with check(exists(select 1 from public.financial_accounts a where a.id=account_id and a.establishment_id=public.current_establishment_id()));
drop policy if exists establishment_scope_financial_transfers on public.financial_transfers;
create policy establishment_scope_financial_transfers on public.financial_transfers as restrictive for all to authenticated using(exists(select 1 from public.financial_accounts a where a.id=source_account_id and a.establishment_id=public.current_establishment_id()) and exists(select 1 from public.financial_accounts a where a.id=destination_account_id and a.establishment_id=public.current_establishment_id())) with check(exists(select 1 from public.financial_accounts a where a.id=source_account_id and a.establishment_id=public.current_establishment_id()) and exists(select 1 from public.financial_accounts a where a.id=destination_account_id and a.establishment_id=public.current_establishment_id()));
create index if not exists warehouses_establishment_idx on public.warehouses(establishment_id);
create index if not exists financial_accounts_establishment_idx on public.financial_accounts(establishment_id);
create index if not exists tenant_members_establishment_idx on public.tenant_members(establishment_id);
