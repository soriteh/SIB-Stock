create or replace function public.enforce_active_establishment_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_active_id uuid; v_warehouse_id uuid; v_source_id uuid; v_destination_id uuid; v_account_id uuid; v_source_account_id uuid; v_destination_account_id uuid;
begin
v_active_id:=public.current_establishment_id();
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
drop trigger if exists active_establishment_inventory_documents on public.inventory_documents;
create trigger active_establishment_inventory_documents before insert or update on public.inventory_documents for each row execute function public.enforce_active_establishment_scope();
drop trigger if exists active_establishment_stock_movements on public.stock_movements;
create trigger active_establishment_stock_movements before insert or update on public.stock_movements for each row execute function public.enforce_active_establishment_scope();
drop trigger if exists active_establishment_stock_counts on public.stock_counts;
create trigger active_establishment_stock_counts before insert or update on public.stock_counts for each row execute function public.enforce_active_establishment_scope();
drop trigger if exists active_establishment_stock_transfers on public.stock_transfers;
create trigger active_establishment_stock_transfers before insert or update on public.stock_transfers for each row execute function public.enforce_active_establishment_scope();
drop trigger if exists active_establishment_financial_accounts on public.financial_accounts;
create trigger active_establishment_financial_accounts before insert or update on public.financial_accounts for each row execute function public.enforce_active_establishment_scope();
drop trigger if exists active_establishment_financial_transactions on public.financial_transactions;
create trigger active_establishment_financial_transactions before insert or update on public.financial_transactions for each row execute function public.enforce_active_establishment_scope();
drop trigger if exists active_establishment_financial_transfers on public.financial_transfers;
create trigger active_establishment_financial_transfers before insert or update on public.financial_transfers for each row execute function public.enforce_active_establishment_scope();
drop policy if exists establishment_scope_inventory_document_lines on public.inventory_document_lines;
create policy establishment_scope_inventory_document_lines on public.inventory_document_lines as restrictive for all to authenticated using(exists(select 1 from public.inventory_documents d join public.warehouses w on w.id=d.warehouse_id where d.id=inventory_document_lines.document_id and d.tenant_id=inventory_document_lines.tenant_id and w.establishment_id=public.current_establishment_id())) with check(exists(select 1 from public.inventory_documents d join public.warehouses w on w.id=d.warehouse_id where d.id=inventory_document_lines.document_id and d.tenant_id=inventory_document_lines.tenant_id and w.establishment_id=public.current_establishment_id()));
drop policy if exists establishment_scope_stock_count_lines on public.stock_count_lines;
create policy establishment_scope_stock_count_lines on public.stock_count_lines as restrictive for all to authenticated using(exists(select 1 from public.stock_counts c join public.warehouses w on w.id=c.warehouse_id where c.id=stock_count_lines.count_id and c.tenant_id=stock_count_lines.tenant_id and w.establishment_id=public.current_establishment_id())) with check(exists(select 1 from public.stock_counts c join public.warehouses w on w.id=c.warehouse_id where c.id=stock_count_lines.count_id and c.tenant_id=stock_count_lines.tenant_id and w.establishment_id=public.current_establishment_id()));
