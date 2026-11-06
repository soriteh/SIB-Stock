create table if not exists public.stock_counts (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 reference text not null, warehouse_id uuid not null, status text not null default 'draft' check(status in ('draft','completed','cancelled')),
 notes text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), completed_at timestamptz,
 unique(tenant_id,id),unique(tenant_id,reference),foreign key(tenant_id,warehouse_id) references public.warehouses(tenant_id,id)
);
create table if not exists public.stock_count_lines (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
 count_id uuid not null,product_id uuid not null,system_quantity numeric(18,4) not null default 0,
 counted_quantity numeric(18,4),difference numeric(18,4),created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,count_id,product_id),
 foreign key(tenant_id,count_id) references public.stock_counts(tenant_id,id) on delete cascade,
 foreign key(tenant_id,product_id) references public.products(tenant_id,id)
);
create index if not exists stock_counts_tenant_created_idx on public.stock_counts(tenant_id,created_at desc);
create index if not exists stock_count_lines_count_idx on public.stock_count_lines(tenant_id,count_id);
alter table public.stock_counts enable row level security; alter table public.stock_count_lines enable row level security;
grant select on public.stock_counts,public.stock_count_lines to authenticated;
drop policy if exists "members read stock counts" on public.stock_counts;
create policy "members read stock counts" on public.stock_counts for select to authenticated using(tenant_id=(select public.current_tenant_id()));
drop policy if exists "members read stock count lines" on public.stock_count_lines;
create policy "members read stock count lines" on public.stock_count_lines for select to authenticated using(tenant_id=(select public.current_tenant_id()));
create or replace function public.start_stock_count(p_warehouse_id uuid,p_notes text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid:=public.current_tenant_id(); count_id uuid; ref text;
begin
 if auth.uid() is null or t is null then raise exception 'Active tenant required' using errcode='42501'; end if;
 if not public.has_tenant_role(array['owner','admin','manager','warehouse_manager','storekeeper']) then raise exception 'Insufficient permission' using errcode='42501'; end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse_id and tenant_id=t and is_active) then raise exception 'Warehouse not found or inactive' using errcode='23503'; end if;
 ref:='INV-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.stock_counts(tenant_id,reference,warehouse_id,notes,created_by) values(t,ref,p_warehouse_id,nullif(trim(p_notes),''),auth.uid()) returning id into count_id;
 insert into public.stock_count_lines(tenant_id,count_id,product_id,system_quantity)
 select t,count_id,p.id,coalesce(sl.quantity,0) from public.products p left join public.stock_levels sl on sl.tenant_id=t and sl.product_id=p.id and sl.warehouse_id=p_warehouse_id where p.tenant_id=t and p.is_active order by p.name;
 return count_id;
end; $$;
create or replace function public.set_stock_count_line(p_count_id uuid,p_product_id uuid,p_counted_quantity numeric) returns void language plpgsql security definer set search_path='' as $$
declare t uuid:=public.current_tenant_id();
begin
 if auth.uid() is null or t is null then raise exception 'Active tenant required' using errcode='42501'; end if;
 if not public.has_tenant_role(array['owner','admin','manager','warehouse_manager','storekeeper']) then raise exception 'Insufficient permission' using errcode='42501'; end if;
 if p_counted_quantity is null or p_counted_quantity<0 then raise exception 'Counted quantity must be zero or greater' using errcode='22023'; end if;
 update public.stock_count_lines l set counted_quantity=p_counted_quantity from public.stock_counts c where l.tenant_id=t and l.count_id=p_count_id and l.product_id=p_product_id and c.tenant_id=t and c.id=l.count_id and c.status='draft';
 if not found then raise exception 'Draft count line not found' using errcode='P0002'; end if;
end; $$;
create or replace function public.finalize_stock_count(p_count_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare t uuid:=public.current_tenant_id(); c public.stock_counts%rowtype; l record; delta numeric;
begin
 if auth.uid() is null or t is null then raise exception 'Active tenant required' using errcode='42501'; end if;
 if not public.has_tenant_role(array['owner','admin','manager','warehouse_manager','storekeeper']) then raise exception 'Insufficient permission' using errcode='42501'; end if;
 select * into c from public.stock_counts where id=p_count_id and tenant_id=t for update;
 if not found or c.status<>'draft' then raise exception 'Draft inventory count not found' using errcode='P0002'; end if;
 if exists(select 1 from public.stock_count_lines where tenant_id=t and count_id=p_count_id and counted_quantity is null) then raise exception 'All products must be counted before finalization' using errcode='22023'; end if;
 for l in select cl.*,p.purchase_price from public.stock_count_lines cl join public.products p on p.id=cl.product_id and p.tenant_id=t where cl.tenant_id=t and cl.count_id=p_count_id order by cl.product_id loop
  delta:=l.counted_quantity-l.system_quantity; update public.stock_count_lines set difference=delta where id=l.id;
  if delta>0 then perform public.apply_stock_movement(l.product_id,c.warehouse_id,delta,'adjustment_in',l.purchase_price,'Inventaire '||c.reference,'count:'||p_count_id::text||':'||l.product_id::text||':in');
  elsif delta<0 then perform public.apply_stock_movement(l.product_id,c.warehouse_id,delta,'adjustment_out',l.purchase_price,'Inventaire '||c.reference,'count:'||p_count_id::text||':'||l.product_id::text||':out'); end if;
 end loop;
 update public.stock_counts set status='completed',completed_at=now() where id=p_count_id and tenant_id=t;
end; $$;
revoke all on function public.start_stock_count(uuid,text) from public,anon;
revoke all on function public.set_stock_count_line(uuid,uuid,numeric) from public,anon;
revoke all on function public.finalize_stock_count(uuid) from public,anon;
grant execute on function public.start_stock_count(uuid,text),public.set_stock_count_line(uuid,uuid,numeric),public.finalize_stock_count(uuid) to authenticated;