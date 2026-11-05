-- SIB Stock — Phase 1: multi-tenant foundation.
-- Apply in a dedicated Supabase development project before production.

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  country_code char(2),
  currency_code char(3) not null default 'GNF',
  status text not null default 'active' check (status in ('active','suspended','trial','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  active_tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','manager','warehouse_manager','storekeeper','buyer','sales','cashier','accountant','viewer')),
  status text not null default 'active' check (status in ('invited','active','suspended')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists tenant_members_user_idx on public.tenant_members(user_id, status);
create index if not exists tenant_members_tenant_idx on public.tenant_members(tenant_id, status);

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.active_tenant_id
  from public.profiles p
  join public.tenant_members tm
    on tm.tenant_id = p.active_tenant_id
   and tm.user_id = auth.uid()
   and tm.status = 'active'
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = target_tenant_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  );
$$;

create or replace function public.has_tenant_role(target_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.current_tenant_id()
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and tm.role = any(target_roles)
  );
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid,
  sku text not null,
  name text not null,
  description text,
  unit_name text not null default 'unité',
  purchase_price numeric(18,4) not null default 0 check (purchase_price >= 0),
  sale_price numeric(18,4) not null default 0 check (sale_price >= 0),
  minimum_stock numeric(18,4) not null default 0 check (minimum_stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, sku),
  constraint products_category_tenant_fk
    foreign key (tenant_id, category_id) references public.categories(tenant_id, id)
);

create index if not exists products_tenant_name_idx on public.products(tenant_id, name);
create index if not exists products_tenant_category_idx on public.products(tenant_id, category_id);

create table if not exists public.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null,
  barcode text not null,
  barcode_type text not null default 'CODE128' check (barcode_type in ('EAN13','EAN8','UPC','CODE128','QR','INTERNAL')),
  created_at timestamptz not null default now(),
  unique (tenant_id, barcode),
  foreign key (tenant_id, product_id) references public.products(tenant_id, id) on delete cascade
);

create index if not exists product_barcodes_product_idx on public.product_barcodes(tenant_id, product_id);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code)
);

create table if not exists public.stock_levels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null,
  warehouse_id uuid not null,
  quantity numeric(18,4) not null default 0 check (quantity >= 0),
  reserved_quantity numeric(18,4) not null default 0 check (reserved_quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (tenant_id, product_id, warehouse_id),
  foreign key (tenant_id, product_id) references public.products(tenant_id, id),
  foreign key (tenant_id, warehouse_id) references public.warehouses(tenant_id, id),
  check (reserved_quantity <= quantity)
);

create index if not exists stock_levels_warehouse_idx on public.stock_levels(tenant_id, warehouse_id);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null,
  warehouse_id uuid not null,
  movement_type text not null check (movement_type in ('opening','receipt','sale','transfer_in','transfer_out','adjustment_in','adjustment_out','customer_return','supplier_return','reversal')),
  quantity_delta numeric(18,4) not null check (quantity_delta <> 0),
  quantity_after numeric(18,4) not null check (quantity_after >= 0),
  unit_cost numeric(18,4) check (unit_cost is null or unit_cost >= 0),
  source_type text,
  source_id uuid,
  idempotency_key text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, product_id) references public.products(tenant_id, id),
  foreign key (tenant_id, warehouse_id) references public.warehouses(tenant_id, id),
  unique (tenant_id, idempotency_key)
);

create index if not exists stock_movements_history_idx
  on public.stock_movements(tenant_id, warehouse_id, product_id, created_at desc);

-- Tenant creation is performed server-side in one transaction.
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

  insert into public.tenants(name, slug, country_code, currency_code)
  values (trim(p_name), lower(p_slug), upper(p_country_code), upper(coalesce(p_currency_code, 'GNF')))
  returning id into new_tenant_id;

  insert into public.tenant_members(tenant_id, user_id, role, status)
  values (new_tenant_id, actor, 'owner', 'active');

  insert into public.profiles(id, active_tenant_id)
  values (actor, new_tenant_id)
  on conflict (id) do update
    set active_tenant_id = excluded.active_tenant_id,
        updated_at = now();

  return new_tenant_id;
end;
$$;

create or replace function public.set_active_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Tenant access denied' using errcode = '42501';
  end if;

  insert into public.profiles(id, active_tenant_id)
  values (auth.uid(), p_tenant_id)
  on conflict (id) do update
    set active_tenant_id = excluded.active_tenant_id,
        updated_at = now();
end;
$$;

-- Atomic stock adjustment. Only authorized warehouse roles can execute it.
create or replace function public.apply_stock_movement(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity_delta numeric,
  p_movement_type text,
  p_unit_cost numeric default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_tenant uuid := public.current_tenant_id();
  current_qty numeric(18,4);
  new_qty numeric(18,4);
  movement_id uuid;
begin
  if auth.uid() is null or active_tenant is null then
    raise exception 'Active tenant required' using errcode = '42501';
  end if;

  if not public.has_tenant_role(array['owner','admin','manager','warehouse_manager','storekeeper']) then
    raise exception 'Insufficient permission to change stock' using errcode = '42501';
  end if;

  if p_quantity_delta = 0 or p_quantity_delta is null then
    raise exception 'Movement quantity must be non-zero' using errcode = '22023';
  end if;

  if p_movement_type not in ('opening','receipt','sale','transfer_in','transfer_out','adjustment_in','adjustment_out','customer_return','supplier_return','reversal') then
    raise exception 'Invalid movement type' using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select id into movement_id
    from public.stock_movements
    where tenant_id = active_tenant and idempotency_key = p_idempotency_key;

    if movement_id is not null then
      return movement_id;
    end if;
  end if;

  insert into public.stock_levels(tenant_id, product_id, warehouse_id, quantity)
  values (active_tenant, p_product_id, p_warehouse_id, 0)
  on conflict (tenant_id, product_id, warehouse_id) do nothing;

  select quantity into current_qty
  from public.stock_levels
  where tenant_id = active_tenant
    and product_id = p_product_id
    and warehouse_id = p_warehouse_id
  for update;

  new_qty := current_qty + p_quantity_delta;
  if new_qty < 0 then
    raise exception 'Insufficient available stock' using errcode = '23514';
  end if;

  update public.stock_levels
  set quantity = new_qty, updated_at = now()
  where tenant_id = active_tenant
    and product_id = p_product_id
    and warehouse_id = p_warehouse_id;

  insert into public.stock_movements(
    tenant_id, product_id, warehouse_id, movement_type,
    quantity_delta, quantity_after, unit_cost, notes,
    idempotency_key, created_by
  ) values (
    active_tenant, p_product_id, p_warehouse_id, p_movement_type,
    p_quantity_delta, new_qty, p_unit_cost, p_notes,
    p_idempotency_key, auth.uid()
  )
  returning id into movement_id;

  return movement_id;
end;
$$;

-- Immutable movement history: no direct updates or deletes.
create or replace function public.reject_stock_movement_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Stock movements are immutable; create a compensating movement';
end;
$$;

drop trigger if exists stock_movements_immutable on public.stock_movements;
create trigger stock_movements_immutable
before update or delete on public.stock_movements
for each row execute function public.reject_stock_movement_mutation();

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['tenants','profiles','products','stock_levels'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Enable RLS everywhere in the tenant core.
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_barcodes enable row level security;
alter table public.warehouses enable row level security;
alter table public.stock_levels enable row level security;
alter table public.stock_movements enable row level security;

create policy "members can read their tenants"
on public.tenants for select to authenticated
using (public.is_tenant_member(id));

create policy "users read own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

create policy "users update own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "members read tenant membership"
on public.tenant_members for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy "members read categories"
on public.categories for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy "managers manage categories"
on public.categories for all to authenticated
using (tenant_id = public.current_tenant_id() and public.has_tenant_role(array['owner','admin','manager']))
with check (tenant_id = public.current_tenant_id() and public.has_tenant_role(array['owner','admin','manager']));

create policy "members read products"
on public.products for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy "managers manage products"
on public.products for all to authenticated
using (tenant_id = public.current_tenant_id() and public.has_tenant_role(array['owner','admin','manager','warehouse_manager']))
with check (tenant_id = public.current_tenant_id() and public.has_tenant_role(array['owner','admin','manager','warehouse_manager']));

create policy "members read product barcodes"
on public.product_barcodes for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy "managers manage product barcodes"
on public.product_barcodes for all to authenticated
using (tenant_id = public.current_tenant_id() and public.has_tenant_role(array['owner','admin','manager','warehouse_manager']))
with check (tenant_id = public.current_tenant_id() and public.has_tenant_role(array['owner','admin','manager','warehouse_manager']));

create policy "members read warehouses"
on public.warehouses for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy "admins manage warehouses"
on public.warehouses for all to authenticated
using (tenant_id = public.current_tenant_id() and public.has_tenant_role(array['owner','admin','manager']))
with check (tenant_id = public.current_tenant_id() and public.has_tenant_role(array['owner','admin','manager']));

create policy "members read stock levels"
on public.stock_levels for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy "members read stock movements"
on public.stock_movements for select to authenticated
using (tenant_id = public.current_tenant_id());

revoke all on function public.create_tenant(text,text,char,char) from public;
grant execute on function public.create_tenant(text,text,char,char) to authenticated;
revoke all on function public.set_active_tenant(uuid) from public;
grant execute on function public.set_active_tenant(uuid) to authenticated;
revoke all on function public.apply_stock_movement(uuid,uuid,numeric,text,numeric,text,text) from public;
grant execute on function public.apply_stock_movement(uuid,uuid,numeric,text,numeric,text,text) to authenticated;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.has_tenant_role(text[]) to authenticated;

-- Auth user profile bootstrap.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
