-- Harden exposed SECURITY DEFINER RPC privileges.
-- Public clients must not invoke privileged functions anonymously.
revoke all on function public.apply_stock_movement(uuid,uuid,numeric,text,numeric,text,text) from public, anon;
revoke all on function public.create_tenant(text,text,char,char) from public, anon;
revoke all on function public.current_tenant_id() from public, anon;
revoke all on function public.has_tenant_role(text[]) from public, anon;
revoke all on function public.is_tenant_member(uuid) from public, anon;
revoke all on function public.set_active_tenant(uuid) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.apply_stock_movement(uuid,uuid,numeric,text,numeric,text,text) to authenticated;
grant execute on function public.create_tenant(text,text,char,char) to authenticated;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.has_tenant_role(text[]) to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.set_active_tenant(uuid) to authenticated;
