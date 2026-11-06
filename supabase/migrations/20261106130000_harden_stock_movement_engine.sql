-- SIB Stock — Phase 2: harden transactional stock movements.
create or replace function public.apply_stock_movement(
  p_product_id uuid, p_warehouse_id uuid, p_quantity_delta numeric, p_movement_type text,
  p_unit_cost numeric default null, p_notes text default null, p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  active_tenant uuid := public.current_tenant_id();
  current_qty numeric(18,4); new_qty numeric(18,4); movement_id uuid;
  positive_types text[] := array['opening','receipt','transfer_in','adjustment_in','customer_return'];
  negative_types text[] := array['sale','transfer_out','adjustment_out','supplier_return'];
begin
  if auth.uid() is null or active_tenant is null then raise exception 'Active tenant required' using errcode = '42501'; end if;
  if not public.has_tenant_role(array['owner','admin','manager','warehouse_manager','storekeeper']) then raise exception 'Insufficient permission to change stock' using errcode = '42501'; end if;
  if p_quantity_delta is null or p_quantity_delta = 0 then raise exception 'Movement quantity must be non-zero' using errcode = '22023'; end if;
  if p_unit_cost is not null and p_unit_cost < 0 then raise exception 'Unit cost cannot be negative' using errcode = '22023'; end if;
  if p_movement_type is null or not (p_movement_type = any(positive_types) or p_movement_type = any(negative_types) or p_movement_type = 'reversal') then raise exception 'Invalid movement type' using errcode = '22023'; end if;
  if p_movement_type = any(positive_types) and p_quantity_delta < 0 then raise exception 'This movement type requires a positive quantity' using errcode = '22023'; end if;
  if p_movement_type = any(negative_types) and p_quantity_delta > 0 then raise exception 'This movement type requires a negative quantity' using errcode = '22023'; end if;
  if p_idempotency_key is not null then
    if length(p_idempotency_key) > 200 then raise exception 'Idempotency key is too long' using errcode = '22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended(active_tenant::text || ':' || p_idempotency_key, 0));
    select id into movement_id from public.stock_movements where tenant_id = active_tenant and idempotency_key = p_idempotency_key;
    if movement_id is not null then return movement_id; end if;
  end if;
  if not exists (select 1 from public.products where id = p_product_id and tenant_id = active_tenant and is_active = true) then raise exception 'Product not found or inactive in active company' using errcode = '23503'; end if;
  if not exists (select 1 from public.warehouses where id = p_warehouse_id and tenant_id = active_tenant and is_active = true) then raise exception 'Warehouse not found or inactive in active company' using errcode = '23503'; end if;
  insert into public.stock_levels(tenant_id,product_id,warehouse_id,quantity) values(active_tenant,p_product_id,p_warehouse_id,0) on conflict(tenant_id,product_id,warehouse_id) do nothing;
  select quantity into current_qty from public.stock_levels where tenant_id=active_tenant and product_id=p_product_id and warehouse_id=p_warehouse_id for update;
  new_qty := current_qty + p_quantity_delta;
  if new_qty < 0 then raise exception 'Insufficient available stock' using errcode = '23514'; end if;
  update public.stock_levels set quantity=new_qty,updated_at=now() where tenant_id=active_tenant and product_id=p_product_id and warehouse_id=p_warehouse_id;
  insert into public.stock_movements(tenant_id,product_id,warehouse_id,movement_type,quantity_delta,quantity_after,unit_cost,notes,idempotency_key,created_by)
  values(active_tenant,p_product_id,p_warehouse_id,p_movement_type,p_quantity_delta,new_qty,p_unit_cost,nullif(trim(p_notes),''),p_idempotency_key,auth.uid()) returning id into movement_id;
  return movement_id;
end; $$;
revoke all on function public.apply_stock_movement(uuid,uuid,numeric,text,numeric,text,text) from public, anon;
grant execute on function public.apply_stock_movement(uuid,uuid,numeric,text,numeric,text,text) to authenticated;
