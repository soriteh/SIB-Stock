-- Apply each plan's history window at read time without deleting historical records.
create or replace function public.tenant_history_is_visible(p_tenant_id uuid, p_created_at timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_history_months integer;
begin
  if p_tenant_id is null or p_created_at is null then
    return false;
  end if;
  if p_tenant_id is distinct from public.current_tenant_id() then
    return false;
  end if;

  select nullif(sp.limits->>'history_months', '')::integer
    into v_history_months
  from public.tenant_subscriptions ts
  join public.subscription_plans sp on sp.id = ts.plan_id
  where ts.tenant_id = p_tenant_id
  order by ts.created_at desc
  limit 1;

  if not found then
    v_history_months := 1;
  end if;

  if v_history_months is null then
    return true;
  end if;
  return p_created_at >= (now() - make_interval(months => greatest(v_history_months, 0)));
end;
$$;

revoke all on function public.tenant_history_is_visible(uuid, timestamptz) from public, anon;
grant execute on function public.tenant_history_is_visible(uuid, timestamptz) to authenticated;

drop policy if exists plan_history_window_inventory_documents on public.inventory_documents;
create policy plan_history_window_inventory_documents on public.inventory_documents
as restrictive for select to authenticated
using (public.tenant_history_is_visible(tenant_id, created_at));

drop policy if exists plan_history_window_inventory_document_lines on public.inventory_document_lines;
create policy plan_history_window_inventory_document_lines on public.inventory_document_lines
as restrictive for select to authenticated
using (public.tenant_history_is_visible(tenant_id, created_at));

drop policy if exists plan_history_window_stock_movements on public.stock_movements;
create policy plan_history_window_stock_movements on public.stock_movements
as restrictive for select to authenticated
using (public.tenant_history_is_visible(tenant_id, created_at));

drop policy if exists plan_history_window_stock_transfers on public.stock_transfers;
create policy plan_history_window_stock_transfers on public.stock_transfers
as restrictive for select to authenticated
using (public.tenant_history_is_visible(tenant_id, created_at));

drop policy if exists plan_history_window_stock_counts on public.stock_counts;
create policy plan_history_window_stock_counts on public.stock_counts
as restrictive for select to authenticated
using (public.tenant_history_is_visible(tenant_id, created_at));

drop policy if exists plan_history_window_stock_count_lines on public.stock_count_lines;
create policy plan_history_window_stock_count_lines on public.stock_count_lines
as restrictive for select to authenticated
using (public.tenant_history_is_visible(tenant_id, created_at));

drop policy if exists plan_history_window_financial_transactions on public.financial_transactions;
create policy plan_history_window_financial_transactions on public.financial_transactions
as restrictive for select to authenticated
using (public.tenant_history_is_visible(tenant_id, created_at));

drop policy if exists plan_history_window_financial_transfers on public.financial_transfers;
create policy plan_history_window_financial_transfers on public.financial_transfers
as restrictive for select to authenticated
using (public.tenant_history_is_visible(tenant_id, created_at));
