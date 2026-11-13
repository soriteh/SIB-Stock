-- SIB Stock production performance hardening.
-- Additive and idempotent: no table, row, policy, or business record is deleted.
create index if not exists categories_parent_id_idx on public.categories (parent_id);
create index if not exists inventory_document_lines_product_id_idx on public.inventory_document_lines (product_id);
create index if not exists inventory_document_lines_tenant_id_idx on public.inventory_document_lines (tenant_id);
create index if not exists inventory_documents_partner_id_idx on public.inventory_documents (partner_id);
create index if not exists inventory_documents_warehouse_id_idx on public.inventory_documents (warehouse_id);
create index if not exists platform_admin_audit_log_actor_user_id_idx on public.platform_admin_audit_log (actor_user_id);
create index if not exists platform_admins_created_by_idx on public.platform_admins (created_by);
create index if not exists profiles_active_tenant_id_idx on public.profiles (active_tenant_id);
create index if not exists stock_count_lines_tenant_product_idx on public.stock_count_lines (tenant_id, product_id);
create index if not exists stock_counts_created_by_idx on public.stock_counts (created_by);
create index if not exists stock_counts_tenant_warehouse_idx on public.stock_counts (tenant_id, warehouse_id);
create index if not exists stock_movements_created_by_idx on public.stock_movements (created_by);
create index if not exists stock_movements_tenant_product_idx on public.stock_movements (tenant_id, product_id);
create index if not exists stock_transfers_created_by_idx on public.stock_transfers (created_by);
create index if not exists stock_transfers_tenant_destination_warehouse_idx on public.stock_transfers (tenant_id, destination_warehouse_id);
create index if not exists stock_transfers_tenant_product_idx on public.stock_transfers (tenant_id, product_id);
create index if not exists stock_transfers_tenant_source_warehouse_idx on public.stock_transfers (tenant_id, source_warehouse_id);
create index if not exists subscription_requests_created_by_idx on public.subscription_requests (created_by);
create index if not exists subscription_requests_requested_plan_id_idx on public.subscription_requests (requested_plan_id);
create index if not exists subscription_requests_reviewed_by_idx on public.subscription_requests (reviewed_by);
create index if not exists tenant_subscriptions_plan_id_idx on public.tenant_subscriptions (plan_id);
