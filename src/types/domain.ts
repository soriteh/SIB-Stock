export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled'

export type TenantRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'warehouse_manager'
  | 'storekeeper'
  | 'buyer'
  | 'sales'
  | 'cashier'
  | 'accountant'
  | 'viewer'

export type StockMovementType =
  | 'opening'
  | 'receipt'
  | 'sale'
  | 'transfer_in'
  | 'transfer_out'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'customer_return'
  | 'supplier_return'
  | 'reversal'

export interface Tenant {
  id: string
  name: string
  slug: string
  country_code: string | null
  currency_code: string
  status: TenantStatus
}

export interface Product {
  id: string
  tenant_id: string
  sku: string
  name: string
  unit_name: string
  purchase_price: number
  sale_price: number
  minimum_stock: number
  is_active: boolean
}

export interface Warehouse {
  id: string
  tenant_id: string
  code: string
  name: string
  address: string | null
}

export interface StockLevel {
  product_id: string
  warehouse_id: string
  quantity: number
  reserved_quantity: number
}

export interface StockMovement {
  id: string
  tenant_id: string
  product_id: string
  warehouse_id: string
  movement_type: StockMovementType
  quantity_delta: number
  quantity_after: number
  created_at: string
}
