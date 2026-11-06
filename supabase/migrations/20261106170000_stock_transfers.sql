create table if not exists public.stock_transfers (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 reference text not null,
 product_id uuid not null,
 source_warehouse_id uuid not null,
 destination_warehouse_id uuid not null,
 quantity numeric(18,4) not null check(quantity>0),
 source_movement_id uuid,
 destination_movement_id uuid,
 idempotency_key text not null,
 status text not null default 'completed' check(status in ('completed','cancelled')),
 notes text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,reference),unique(tenant_id,idempotency_key),
 check(source_warehouse_id<>destination_warehouse_id),
 foreign key(tenant_id,product_id) references public.products(tenant_id,id),
 foreign key(tenant_id,source_warehouse_id) references public.warehouses(tenant_id,id),
 foreign key(tenant_id,destination_warehouse_id) references public.warehouses(tenant_id,id)
);
create index if not exists stock_transfers_tenant_created_idx on public.stock_transfers(tenant_id,created_at desc);
alter table public.stock_transfers enable row level security;
grant select on public.stock_transfers to authenticated;
drop policy if exists "members read stock transfers" on public.stock_transfers;
create policy "members read stock transfers" on public.stock_transfers for select to authenticated using(tenant_id=(select public.current_tenant_id()));
create or replace function public.execute_stock_transfer(p_product_id uuid,p_source_warehouse_id uuid,p_destination_warehouse_id uuid,p_quantity numeric,p_notes text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare active_tenant uuid:=public.current_tenant_id(); transfer_id uuid; movement_out uuid; movement_in uuid; transfer_ref text;
begin
 if auth.uid() is null or active_tenant is null then raise exception 'Active tenant required' using errcode='42501'; end if;
 if not public.has_tenant_role(array['owner','admin','manager','warehouse_manager','storekeeper']) then raise exception 'Insufficient permission to transfer stock' using errcode='42501'; end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'Transfer quantity must be positive' using errcode='22023'; end if;
 if p_source_warehouse_id=p_destination_warehouse_id then raise exception 'Source and destination must differ' using errcode='22023'; end if;
 if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'A valid idempotency key is required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(active_tenant::text||':transfer:'||p_idempotency_key,0));
 select id into transfer_id from public.stock_transfers where tenant_id=active_tenant and idempotency_key=p_idempotency_key;
 if transfer_id is not null then return transfer_id; end if;
 if not exists(select 1 from public.products where id=p_product_id and tenant_id=active_tenant and is_active) then raise exception 'Product not found or inactive' using errcode='23503'; end if;
 if not exists(select 1 from public.warehouses where id=p_source_warehouse_id and tenant_id=active_tenant and is_active) then raise exception 'Source warehouse not found or inactive' using errcode='23503'; end if;
 if not exists(select 1 from public.warehouses where id=p_destination_warehouse_id and tenant_id=active_tenant and is_active) then raise exception 'Destination warehouse not found or inactive' using errcode='23503'; end if;
 perform pg_advisory_xact_lock(hashtextextended(active_tenant::text||':'||p_product_id::text||':'||least(p_source_warehouse_id::text,p_destination_warehouse_id::text),0));
 perform pg_advisory_xact_lock(hashtextextended(active_tenant::text||':'||p_product_id::text||':'||greatest(p_source_warehouse_id::text,p_destination_warehouse_id::text),0));
 transfer_ref:='TRF-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.stock_transfers(tenant_id,reference,product_id,source_warehouse_id,destination_warehouse_id,quantity,idempotency_key,notes,created_by)
 values(active_tenant,transfer_ref,p_product_id,p_source_warehouse_id,p_destination_warehouse_id,p_quantity,p_idempotency_key,nullif(trim(p_notes),''),auth.uid()) returning id into transfer_id;
 movement_out:=public.apply_stock_movement(p_product_id,p_source_warehouse_id,-p_quantity,'transfer_out',null,'Transfert '||transfer_ref||coalesce(' — '||p_notes,''),p_idempotency_key||':out');
 movement_in:=public.apply_stock_movement(p_product_id,p_destination_warehouse_id,p_quantity,'transfer_in',null,'Transfert '||transfer_ref||coalesce(' — '||p_notes,''),p_idempotency_key||':in');
 update public.stock_transfers set source_movement_id=movement_out,destination_movement_id=movement_in where id=transfer_id;
 return transfer_id;
end; $$;
revoke all on function public.execute_stock_transfer(uuid,uuid,uuid,numeric,text,text) from public,anon;
grant execute on function public.execute_stock_transfer(uuid,uuid,uuid,numeric,text,text) to authenticated;