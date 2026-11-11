drop policy if exists establishment_scope_stock_levels on public.stock_levels;
create policy establishment_scope_stock_levels on public.stock_levels as restrictive for all to authenticated
using(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=public.current_establishment_id()))
with check(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=public.current_establishment_id()));
create index if not exists stock_levels_warehouse_id_idx on public.stock_levels(warehouse_id);
