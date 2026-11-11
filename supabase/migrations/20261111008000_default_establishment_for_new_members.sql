create or replace function public.assign_default_establishment_to_member()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_establishment_id uuid;
begin
select e.id into v_establishment_id from public.establishments e where e.tenant_id=new.tenant_id and e.is_primary and e.is_active limit 1;
if v_establishment_id is null then
insert into public.establishments(tenant_id,code,name,is_primary)
select new.tenant_id,'SITE-PRINCIPAL',coalesce(nullif(t.name,''),'Établissement principal'),true
from public.tenants t where t.id=new.tenant_id
on conflict(tenant_id,code) do update set is_primary=true,is_active=true
returning id into v_establishment_id;
end if;
new.establishment_id:=coalesce(new.establishment_id,v_establishment_id);return new;end;$$;
revoke all on function public.assign_default_establishment_to_member() from public,anon,authenticated;
drop trigger if exists a_assign_default_establishment_membership on public.tenant_members;
create trigger a_assign_default_establishment_membership before insert on public.tenant_members for each row execute function public.assign_default_establishment_to_member();

create or replace function public.set_initial_active_establishment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
update public.profiles set active_establishment_id=new.establishment_id where id=new.user_id and active_establishment_id is null;
return new;end;$$;
revoke all on function public.set_initial_active_establishment() from public,anon,authenticated;
drop trigger if exists tenant_member_set_initial_establishment on public.tenant_members;
create trigger tenant_member_set_initial_establishment after insert on public.tenant_members for each row execute function public.set_initial_active_establishment();
