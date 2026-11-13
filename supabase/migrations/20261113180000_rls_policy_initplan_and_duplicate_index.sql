-- SIB Stock: safe RLS evaluation and duplicate index cleanup
-- These changes preserve policy predicates and existing data.

alter policy "users read own profile" on public.profiles
  using (id = (select auth.uid()));

alter policy "users update own profile" on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy "owners create subscription requests" on public.subscription_requests
  with check (
    tenant_id = current_tenant_id()
    and created_by = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and has_tenant_role(array['owner','admin'])
  );

-- The unique constraint owns tenant_subscriptions_tenant_id_key.
-- Remove only the redundant, non-constraint-backed duplicate index.
drop index if exists public.tenant_subscriptions_tenant_id_uidx;
