-- SIB Stock: transactional purchase and sales documents
create table if not exists public.inventory_documents (id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,document_type text not null check(document_type in('purchase','sale')),reference text not null,partner_id uuid not null references public.business_partners(id),warehouse_id uuid not null references public.warehouses(id),status text not null default 'draft' check(status in('draft','posted','cancelled')),document_date date not null default current_date,due_date date,subtotal numeric(18,2) not null default 0 check(subtotal>=0),discount_amount numeric(18,2) not null default 0 check(discount_amount>=0),tax_amount numeric(18,2) not null default 0 check(tax_amount>=0),total_amount numeric(18,2) not null default 0 check(total_amount>=0),notes text,created_by uuid not null default auth.uid(),posted_by uuid,created_at timestamptz not null default now(),posted_at timestamptz,unique(tenant_id,reference));
create table if not exists public.inventory_document_lines(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,document_id uuid not null references public.inventory_documents(id) on delete cascade,product_id uuid not null references public.products(id),quantity numeric(18,4) not null check(quantity>0),unit_price numeric(18,2) not null check(unit_price>=0),line_total numeric(18,2) generated always as(round(quantity*unit_price,2)) stored,created_at timestamptz not null default now());
create index if not exists inventory_documents_tenant_date_idx on public.inventory_documents(tenant_id,document_date desc);
create index if not exists inventory_document_lines_document_idx on public.inventory_document_lines(document_id);
alter table public.inventory_documents enable row level security; alter table public.inventory_document_lines enable row level security;
drop policy if exists inventory_documents_read on public.inventory_documents;
create policy inventory_documents_read on public.inventory_documents for select to authenticated using(tenant_id=(select public.current_tenant_id()));
drop policy if exists inventory_documents_insert on public.inventory_documents;
create policy inventory_documents_insert on public.inventory_documents for insert to authenticated with check(tenant_id=(select public.current_tenant_id()) and created_by=(select auth.uid()) and ((document_type='purchase' and public.has_tenant_role(array['owner','admin','manager','buyer'])) or (document_type='sale' and public.has_tenant_role(array['owner','admin','manager','sales']))));
drop policy if exists inventory_documents_update on public.inventory_documents;
create policy inventory_documents_update on public.inventory_documents for update to authenticated using(tenant_id=(select public.current_tenant_id()) and status='draft') with check(tenant_id=(select public.current_tenant_id()) and status='draft');
drop policy if exists inventory_lines_read on public.inventory_document_lines;
create policy inventory_lines_read on public.inventory_document_lines for select to authenticated using(tenant_id=(select public.current_tenant_id()));
drop policy if exists inventory_lines_insert on public.inventory_document_lines;
create policy inventory_lines_insert on public.inventory_document_lines for insert to authenticated with check(tenant_id=(select public.current_tenant_id()) and exists(select 1 from public.inventory_documents d where d.id=document_id and d.tenant_id=inventory_document_lines.tenant_id and d.status='draft') and exists(select 1 from public.products p where p.id=product_id and p.tenant_id=inventory_document_lines.tenant_id and p.is_active));
drop policy if exists inventory_lines_update on public.inventory_document_lines;
create policy inventory_lines_update on public.inventory_document_lines for update to authenticated using(tenant_id=(select public.current_tenant_id()) and exists(select 1 from public.inventory_documents d where d.id=document_id and d.tenant_id=inventory_document_lines.tenant_id and d.status='draft')) with check(tenant_id=(select public.current_tenant_id()));
drop policy if exists inventory_lines_delete on public.inventory_document_lines;
create policy inventory_lines_delete on public.inventory_document_lines for delete to authenticated using(tenant_id=(select public.current_tenant_id()) and exists(select 1 from public.inventory_documents d where d.id=document_id and d.tenant_id=inventory_document_lines.tenant_id and d.status='draft'));
grant select,insert,update on public.inventory_documents to authenticated; grant select,insert,update,delete on public.inventory_document_lines to authenticated;
create or replace function public.post_inventory_document(p_document_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid:=public.current_tenant_id(); v_doc public.inventory_documents%rowtype; v_line record; v_qty numeric(18,4); v_new numeric(18,4); v_partner_type text;
begin
if auth.uid() is null or v_tenant is null then raise exception 'Active tenant required' using errcode='42501'; end if;
select * into v_doc from public.inventory_documents where id=p_document_id and tenant_id=v_tenant for update;
if not found then raise exception 'Document not found'; end if;
if v_doc.status='posted' then return v_doc.id; end if;
if v_doc.status<>'draft' then raise exception 'Only draft documents can be posted'; end if;
if v_doc.document_type='purchase' then if not public.has_tenant_role(array['owner','admin','manager','buyer']) then raise exception 'Insufficient permission' using errcode='42501'; end if;
else if not public.has_tenant_role(array['owner','admin','manager','sales']) then raise exception 'Insufficient permission' using errcode='42501'; end if; end if;
select partner_type into v_partner_type from public.business_partners where id=v_doc.partner_id and tenant_id=v_tenant and is_active;
if v_partner_type is null or (v_doc.document_type='purchase' and v_partner_type not in('supplier','both')) or (v_doc.document_type='sale' and v_partner_type not in('customer','both')) then raise exception 'Invalid or inactive partner'; end if;
if not exists(select 1 from public.warehouses where id=v_doc.warehouse_id and tenant_id=v_tenant and is_active) then raise exception 'Invalid warehouse'; end if;
if not exists(select 1 from public.inventory_document_lines where document_id=v_doc.id and tenant_id=v_tenant) then raise exception 'Document must contain at least one line'; end if;
for v_line in select l.*,p.is_active from public.inventory_document_lines l join public.products p on p.id=l.product_id and p.tenant_id=l.tenant_id where l.document_id=v_doc.id and l.tenant_id=v_tenant order by l.id loop
if not v_line.is_active then raise exception 'Inactive product in document'; end if;
insert into public.stock_levels(tenant_id,product_id,warehouse_id,quantity) values(v_tenant,v_line.product_id,v_doc.warehouse_id,0) on conflict(tenant_id,product_id,warehouse_id) do nothing;
select quantity into v_qty from public.stock_levels where tenant_id=v_tenant and product_id=v_line.product_id and warehouse_id=v_doc.warehouse_id for update;
if v_doc.document_type='sale' and v_qty<v_line.quantity then raise exception 'Insufficient available stock for product %',v_line.product_id using errcode='23514'; end if;
v_new:=v_qty+case when v_doc.document_type='purchase' then v_line.quantity else -v_line.quantity end;
update public.stock_levels set quantity=v_new,updated_at=now() where tenant_id=v_tenant and product_id=v_line.product_id and warehouse_id=v_doc.warehouse_id;
insert into public.stock_movements(tenant_id,product_id,warehouse_id,movement_type,quantity_delta,quantity_after,unit_cost,source_type,source_id,idempotency_key,notes,created_by)
values(v_tenant,v_line.product_id,v_doc.warehouse_id,case when v_doc.document_type='purchase' then 'receipt' else 'sale' end,case when v_doc.document_type='purchase' then v_line.quantity else -v_line.quantity end,v_new,case when v_doc.document_type='purchase' then v_line.unit_price else null end,v_doc.document_type,v_doc.id,'document:'||v_doc.id::text||':'||v_line.id::text,v_doc.reference,auth.uid());
end loop;
update public.inventory_documents set status='posted',posted_by=auth.uid(),posted_at=now() where id=v_doc.id and tenant_id=v_tenant; return v_doc.id;
end; $$;
revoke all on function public.post_inventory_document(uuid) from public,anon; grant execute on function public.post_inventory_document(uuid) to authenticated;