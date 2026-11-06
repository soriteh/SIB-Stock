-- Company profile and tenant settings
alter table public.tenants
  add column if not exists legal_name text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists tax_number text,
  add column if not exists legal_form text,
  add column if not exists timezone text not null default 'Africa/Conakry';

drop policy if exists "owners admins update tenant settings" on public.tenants;
create policy "owners admins update tenant settings"
on public.tenants for update to authenticated
using (
  public.is_tenant_member(id)
  and id = public.current_tenant_id()
  and public.has_tenant_role(array['owner','admin'])
)
with check (
  id = public.current_tenant_id()
  and public.has_tenant_role(array['owner','admin'])
);
grant select, update on public.tenants to authenticated;
