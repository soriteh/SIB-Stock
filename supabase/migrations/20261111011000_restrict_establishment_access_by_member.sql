create or replace function public.current_establishment_id()
returns uuid language plpgsql stable security definer set search_path='' as $$
declare v_member_establishment uuid;v_member_role text;v_active_establishment uuid;
begin
select tm.establishment_id,tm.role into v_member_establishment,v_member_role
from public.tenant_members tm where tm.user_id=(select auth.uid()) and tm.tenant_id=public.current_tenant_id() and tm.status='active' limit 1;
if v_member_establishment is null then return null;end if;
select p.active_establishment_id into v_active_establishment from public.profiles p where p.id=(select auth.uid());
if v_member_role in ('owner','admin') then
if exists(select 1 from public.establishments e where e.id=v_active_establishment and e.tenant_id=public.current_tenant_id() and e.is_active) then return v_active_establishment;end if;
return (select e.id from public.establishments e where e.tenant_id=public.current_tenant_id() and e.is_primary and e.is_active limit 1);
end if;
if v_active_establishment=v_member_establishment and exists(select 1 from public.establishments e where e.id=v_active_establishment and e.tenant_id=public.current_tenant_id() and e.is_active) then return v_active_establishment;end if;
return (select e.id from public.establishments e where e.id=v_member_establishment and e.is_active limit 1);
end;$$;
revoke all on function public.current_establishment_id() from public,anon;
grant execute on function public.current_establishment_id() to authenticated;
