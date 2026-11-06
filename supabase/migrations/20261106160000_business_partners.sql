-- SIB Stock: business partners (suppliers and customers)
create table if not exists public.business_partners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  partner_type text not null check (partner_type in ('supplier','customer','both')),
  partner_code text,
  name text not null check (length(trim(name)) between 2 and 180),
  contact_person text,
  phone text,
  email text,
  address text,
  tax_number text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, partner_code)
);
create index if not exists business_partners_tenant_type_idx
  on public.business_partners (tenant_id, partner_type, name);
create index if not exists business_partners_tenant_name_idx
  on public.business_partners (tenant_id, name);
alter table public.business_partners enable row level security;
grant select, insert, update, delete on public.business_partners to authenticated;
create policy "members read business partners"
on public.business_partners for select to authenticated
using (tenant_id = (select public.current_tenant_id()));
create policy "managers manage business partners"
on public.business_partners for all to authenticated
using (
  tenant_id = (select public.current_tenant_id())
  and (select public.has_tenant_role(array['owner','admin','manager','buyer','sales']))
)
with check (
  tenant_id = (select public.current_tenant_id())
  and (select public.has_tenant_role(array['owner','admin','manager','buyer','sales']))
);
drop trigger if exists set_updated_at on public.business_partners;
create trigger set_updated_at before update on public.business_partners
for each row execute function public.set_updated_at();
