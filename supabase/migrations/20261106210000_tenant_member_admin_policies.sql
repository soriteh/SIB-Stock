drop policy if exists tenant_members_admin_update on public.tenant_members;
create policy tenant_members_admin_update on public.tenant_members for update to authenticated
using(tenant_id=(select public.current_tenant_id()) and user_id<>(select auth.uid()) and public.has_tenant_role(array['owner','admin']) and role<>'owner')
with check(tenant_id=(select public.current_tenant_id()) and role<>'owner' and status in('active','invited','suspended') and (role<>'admin' or public.has_tenant_role(array['owner'])));
grant select,update on public.tenant_members to authenticated;
drop policy if exists profiles_same_tenant_read on public.profiles;
create policy profiles_same_tenant_read on public.profiles for select to authenticated using(id in(select tm.user_id from public.tenant_members tm where tm.tenant_id=(select public.current_tenant_id()) and tm.status='active'));
grant select on public.profiles to authenticated;