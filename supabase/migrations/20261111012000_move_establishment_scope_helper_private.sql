create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
create or replace function private.current_establishment_id()
returns uuid language plpgsql stable security definer set search_path='' as $$
declare v_member_establishment uuid;v_member_role text;v_active_establishment uuid;
begin
select tm.establishment_id,tm.role into v_member_establishment,v_member_role from public.tenant_members tm where tm.user_id=(select auth.uid()) and tm.tenant_id=public.current_tenant_id() and tm.status='active' limit 1;
if v_member_establishment is null then return null;end if;
select p.active_establishment_id into v_active_establishment from public.profiles p where p.id=(select auth.uid());
if v_member_role in ('owner','admin') then
if exists(select 1 from public.establishments e where e.id=v_active_establishment and e.tenant_id=public.current_tenant_id() and e.is_active) then return v_active_establishment;end if;
return (select e.id from public.establishments e where e.tenant_id=public.current_tenant_id() and e.is_primary and e.is_active limit 1);
end if;
if v_active_establishment=v_member_establishment and exists(select 1 from public.establishments e where e.id=v_active_establishment and e.tenant_id=public.current_tenant_id() and e.is_active) then return v_active_establishment;end if;
return (select e.id from public.establishments e where e.id=v_member_establishment and e.is_active limit 1);
end;$$;
revoke all on function private.current_establishment_id() from public,anon;
grant execute on function private.current_establishment_id() to authenticated;
drop policy if exists establishment_scope_warehouses on public.warehouses;
create policy establishment_scope_warehouses on public.warehouses as restrictive for all to authenticated using(establishment_id=private.current_establishment_id()) with check(establishment_id=private.current_establishment_id());
drop policy if exists establishment_scope_inventory_documents on public.inventory_documents;
create policy establishment_scope_inventory_documents on public.inventory_documents as restrictive for all to authenticated using(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=private.current_establishment_id())) with check(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=private.current_establishment_id()));
drop policy if exists establishment_scope_stock_movements on public.stock_movements;
create policy establishment_scope_stock_movements on public.stock_movements as restrictive for all to authenticated using(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=private.current_establishment_id())) with check(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=private.current_establishment_id()));
drop policy if exists establishment_scope_stock_counts on public.stock_counts;
create policy establishment_scope_stock_counts on public.stock_counts as restrictive for all to authenticated using(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=private.current_establishment_id())) with check(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=private.current_establishment_id()));
drop policy if exists establishment_scope_stock_transfers on public.stock_transfers;
create policy establishment_scope_stock_transfers on public.stock_transfers as restrictive for all to authenticated using(exists(select 1 from public.warehouses w where w.id=source_warehouse_id and w.establishment_id=private.current_establishment_id()) and exists(select 1 from public.warehouses w where w.id=destination_warehouse_id and w.establishment_id=private.current_establishment_id())) with check(exists(select 1 from public.warehouses w where w.id=source_warehouse_id and w.establishment_id=private.current_establishment_id()) and exists(select 1 from public.warehouses w where w.id=destination_warehouse_id and w.establishment_id=private.current_establishment_id()));
drop policy if exists establishment_scope_financial_accounts on public.financial_accounts;
create policy establishment_scope_financial_accounts on public.financial_accounts as restrictive for all to authenticated using(establishment_id=private.current_establishment_id()) with check(establishment_id=private.current_establishment_id());
drop policy if exists establishment_scope_financial_transactions on public.financial_transactions;
create policy establishment_scope_financial_transactions on public.financial_transactions as restrictive for all to authenticated using(exists(select 1 from public.financial_accounts a where a.id=account_id and a.establishment_id=private.current_establishment_id())) with check(exists(select 1 from public.financial_accounts a where a.id=account_id and a.establishment_id=private.current_establishment_id()));
drop policy if exists establishment_scope_financial_transfers on public.financial_transfers;
create policy establishment_scope_financial_transfers on public.financial_transfers as restrictive for all to authenticated using(exists(select 1 from public.financial_accounts a where a.id=source_account_id and a.establishment_id=private.current_establishment_id()) and exists(select 1 from public.financial_accounts a where a.id=destination_account_id and a.establishment_id=private.current_establishment_id())) with check(exists(select 1 from public.financial_accounts a where a.id=source_account_id and a.establishment_id=private.current_establishment_id()) and exists(select 1 from public.financial_accounts a where a.id=destination_account_id and a.establishment_id=private.current_establishment_id()));
drop policy if exists establishment_scope_inventory_document_lines on public.inventory_document_lines;
create policy establishment_scope_inventory_document_lines on public.inventory_document_lines as restrictive for all to authenticated using(exists(select 1 from public.inventory_documents d join public.warehouses w on w.id=d.warehouse_id where d.id=inventory_document_lines.document_id and d.tenant_id=inventory_document_lines.tenant_id and w.establishment_id=private.current_establishment_id())) with check(exists(select 1 from public.inventory_documents d join public.warehouses w on w.id=d.warehouse_id where d.id=inventory_document_lines.document_id and d.tenant_id=inventory_document_lines.tenant_id and w.establishment_id=private.current_establishment_id()));
drop policy if exists establishment_scope_stock_count_lines on public.stock_count_lines;
create policy establishment_scope_stock_count_lines on public.stock_count_lines as restrictive for all to authenticated using(exists(select 1 from public.stock_counts c join public.warehouses w on w.id=c.warehouse_id where c.id=stock_count_lines.count_id and c.tenant_id=stock_count_lines.tenant_id and w.establishment_id=private.current_establishment_id())) with check(exists(select 1 from public.stock_counts c join public.warehouses w on w.id=c.warehouse_id where c.id=stock_count_lines.count_id and c.tenant_id=stock_count_lines.tenant_id and w.establishment_id=private.current_establishment_id()));
drop policy if exists establishment_scope_stock_levels on public.stock_levels;
create policy establishment_scope_stock_levels on public.stock_levels as restrictive for all to authenticated using(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=private.current_establishment_id())) with check(exists(select 1 from public.warehouses w where w.id=warehouse_id and w.establishment_id=private.current_establishment_id()));
create or replace function public.enforce_active_establishment_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_active_id uuid;v_warehouse_id uuid;v_source_id uuid;v_destination_id uuid;v_account_id uuid;v_source_account_id uuid;v_destination_account_id uuid;
begin
v_active_id:=private.current_establishment_id();
if v_active_id is null then raise exception 'Aucun établissement actif sélectionné.' using errcode='42501';end if;
if tg_table_name in ('inventory_documents','stock_movements','stock_counts') then
v_warehouse_id:=(to_jsonb(new)->>'warehouse_id')::uuid;
if not exists(select 1 from public.warehouses w where w.id=v_warehouse_id and w.establishment_id=v_active_id) then raise exception 'Cette opération ne correspond pas à l’établissement actif.' using errcode='42501';end if;
elsif tg_table_name='stock_transfers' then
v_source_id:=(to_jsonb(new)->>'source_warehouse_id')::uuid;v_destination_id:=(to_jsonb(new)->>'destination_warehouse_id')::uuid;
if not exists(select 1 from public.warehouses w where w.id=v_source_id and w.establishment_id=v_active_id) or not exists(select 1 from public.warehouses w where w.id=v_destination_id and w.establishment_id=v_active_id) then raise exception 'Les deux entrepôts doivent appartenir à l’établissement actif.' using errcode='42501';end if;
elsif tg_table_name='financial_accounts' then
if (to_jsonb(new)->>'establishment_id')::uuid is distinct from v_active_id then raise exception 'Ce compte financier ne correspond pas à l’établissement actif.' using errcode='42501';end if;
elsif tg_table_name='financial_transactions' then
v_account_id:=(to_jsonb(new)->>'account_id')::uuid;
if not exists(select 1 from public.financial_accounts a where a.id=v_account_id and a.establishment_id=v_active_id) then raise exception 'Ce compte financier ne correspond pas à l’établissement actif.' using errcode='42501';end if;
elsif tg_table_name='financial_transfers' then
v_source_account_id:=(to_jsonb(new)->>'source_account_id')::uuid;v_destination_account_id:=(to_jsonb(new)->>'destination_account_id')::uuid;
if not exists(select 1 from public.financial_accounts a where a.id=v_source_account_id and a.establishment_id=v_active_id) or not exists(select 1 from public.financial_accounts a where a.id=v_destination_account_id and a.establishment_id=v_active_id) then raise exception 'Les comptes doivent appartenir à l’établissement actif.' using errcode='42501';end if;
end if;return new;end;$$;
revoke all on function public.enforce_active_establishment_scope() from public,anon,authenticated;
drop function if exists public.current_establishment_id();
