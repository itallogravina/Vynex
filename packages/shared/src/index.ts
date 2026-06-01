export const VYNEX_VERSION = '0.1.0'

export type AppName = 'vynex'

// ============================================================================
// ENUMS — Status & Routing
// ============================================================================

export enum ItemStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  READY = 'ready',
  SERVED = 'served',
  BILLED = 'billed',
}

export enum RoutingZone {
  KITCHEN = 'kitchen',
  BAR = 'bar',
  CASHIER = 'cashier',
  TABLE = 'table',
}

export enum OrderRoutingMode {
  MANUAL = 'manual',
  AUTO = 'auto',
}

export enum Priority {
  NORMAL = 'normal',
  URGENT = 'urgent',
  VIP = 'vip',
}

// ============================================================================
// DOMAIN MODELS
// ============================================================================

export type MenuItem = {
  id: string
  category_id: string
  name: string
  price: number
  routing_zone: RoutingZone
  enabled: boolean
  eightysixed_at: string | null
  prep_time_seconds: number | null
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  name: string
  routing_zone: RoutingZone
  active_from: string | null
  active_to: string | null
  created_at: string
}

export type CategoryWithItems = Category & { items: MenuItem[] }

export type OrderItem = {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  status: ItemStatus
  priority: Priority
  notes?: string
  added_by?: string
  created_at: string
  updated_at: string
}

export type Order = {
  id: string
  table_id: string
  routing_mode: OrderRoutingMode
  status: 'open' | 'closed'
  payment_method?: 'cash' | 'card' | 'cancelled' | 'merged'
  closed_at?: string
  opened_by?: string
  created_at: string
  updated_at: string
}

export type Table = {
  id: string
  name: string
  seats: number
  pos_x: number
  pos_y: number
  floor: number
  created_at: string
}

export type TableWithStatus = Table & {
  status: 'free' | 'occupied'
  order_id?: string
}

export type TableFloorMapItem = Table & {
  status: 'free' | 'occupied'
  order_id?: string
  opened_at?: string
}

export type VariationGroup = {
  id: string
  menu_item_id: string
  name: string
  required: boolean
  options: VariationOption[]
  created_at: string
}

export type VariationOption = {
  id: string
  group_id: string
  name: string
  price_delta: number
  created_at: string
}

export type CashierClosingSummary = {
  total_revenue: number
  orders_closed: number
  orders_open: number
  revenue_by_payment: { cash: number; card: number }
  top_items: { name: string; quantity: number; revenue: number }[]
}

// Order shape returned in queue responses — includes resolved table_name
export type QueueOrder = Order & { table_name: string }

// Full queue item shape (order item + resolved menu item + order with table name)
export type QueueItem = OrderItem & {
  menu_item: MenuItem
  order: QueueOrder
}

// Open order shape for the cashier billing view
export type OpenOrder = {
  id: string
  table_id: string
  table_name: string
  routing_mode: OrderRoutingMode
  status: 'open'
  created_at: string
  updated_at: string
  items: (OrderItem & { menu_item: MenuItem })[]
  total: number
  split_group_id?: string
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export type CreateOrderRequest = {
  table_id: string
  routing_mode: OrderRoutingMode
}

export type CreateOrderResponse = Order

export type AddOrderItemRequest = {
  menu_item_id: string
  quantity: number
  notes?: string
  priority?: Priority
  variations?: string[]
}

export type TransferOrderRequest = {
  to_table_id: string
}

export type MergeOrderRequest = {
  into_order_id: string
}

export type SplitOrderRequest =
  | { mode: 'equal'; parts: number }
  | { mode: 'items'; item_ids: string[] }

export type UpdateTablePositionRequest = {
  pos_x: number
  pos_y: number
  floor?: number
}

export type CreateVariationGroupRequest = {
  name: string
  required?: boolean
}

export type CreateVariationOptionRequest = {
  name: string
  price_delta?: number
}

export type UpdateCategoryRequest = {
  name: string
  routing_zone: RoutingZone
  active_from?: string | null
  active_to?: string | null
}

export type AddOrderItemResponse = OrderItem

export type UpdateItemStatusRequest = {
  status: ItemStatus
}

export type UpdateItemStatusResponse = OrderItem

export type CloseOrderRequest = {
  payment_method: 'cash' | 'card'
}

export type CloseOrderResponse = Order

export type GetOrderResponse = Order & {
  items: (OrderItem & { menu_item: MenuItem })[]
}

export type GetQueueResponse = QueueItem[]

export type CreateTableRequest = {
  name: string
  seats: number
}

export type UpdateTableRequest = {
  name: string
  seats: number
}

export type CreateUserRequest = {
  name: string
  role: Role
  login_method: LoginMethod
  username?: string
  pin?: string
  password?: string
}

export type UpdateUserRequest = Partial<CreateUserRequest> & { enabled?: boolean }

export type BulkImportUsersRequest = {
  users: CreateUserRequest[]
}

export type BulkImportResult = {
  created: number
  failed: { index: number; name: string; error: string }[]
}

export type AutoGenerateUsersRequest = {
  role: Role
  login_method: LoginMethod
  count: number
  prefix?: string
}

export type CreateCategoryRequest = {
  name: string
  routing_zone: RoutingZone
}

export type CreateMenuItemRequest = {
  category_id: string
  name: string
  price: number
  routing_zone: RoutingZone
}

export type UpdateMenuItemRequest = {
  name: string
  price: number
  routing_zone: RoutingZone
}

// ============================================================================
// AUTH & USER TYPES
// ============================================================================

export type Role = 'owner' | 'manager' | 'cashier' | 'waiter' | 'bartender' | 'kitchen'

export type LoginMethod = 'pin' | 'password' | 'list'

export type User = {
  id: string
  name: string
  role: Role
  login_method: LoginMethod
  enabled: boolean
}

export type LoginRequest =
  | { login_method: 'pin'; pin: string }
  | { login_method: 'password'; username: string; password: string }
  | { login_method: 'list'; user_id: string }

export type AuthResponse = {
  token: string
  user: { id: string; name: string; role: Role }
  expires_at: string
}

// ============================================================================
// REPORT TYPES
// ============================================================================

export type SalesReport = {
  period: { from: string; to: string }
  total_revenue: number
  total_orders: number
  by_day: { date: string; revenue: number; orders: number }[]
}

export type TopItemsReport = {
  top_items: { menu_item_id: string; name: string; quantity_sold: number; revenue: number }[]
  top_categories: { category_id: string; name: string; revenue: number }[]
}

export type PerWaiterReport = {
  waiters: {
    user_id: string | null
    name: string
    orders_opened: number
    items_added: number
    revenue: number
  }[]
}

export type ShiftSummaryReport = {
  period: { from: string; to: string }
  orders_opened: number
  orders_closed: number
  orders_still_open: number
  total_revenue: number
  by_payment_method: { cash: number; card: number }
}

export type PeakHourReport = {
  hours: { hour: number; orders: number; revenue: number }[]
}

export type CancellationRateReport = {
  total_orders: number
  cancelled_orders: number
  cancellation_rate: number
}

export type PeriodComparison = {
  period: 'week' | 'month'
  current: { from: string; to: string; revenue: number; orders: number }
  previous: { from: string; to: string; revenue: number; orders: number }
  revenue_delta_pct: number | null
  orders_delta_pct: number | null
}

export type NeverOrderedReport = {
  items: { menu_item_id: string; name: string; category: string; price: number }[]
}

// ============================================================================
// OFFLINE ORDER QUEUE TYPES
// ============================================================================

export type OfflineOrderBundle = {
  id: string
  user_id: string
  table_id: string
  routing_mode: OrderRoutingMode
  items: AddOrderItemRequest[]
  queued_at: string
  attempt: number
}

// ============================================================================
// WEBSOCKET EVENT TYPES
// ============================================================================

export type WebSocketEvent =
  | OrderCreatedEvent
  | ItemAddedEvent
  | ItemStatusChangedEvent
  | QueueSnapshotEvent
  | OrderClosedEvent

export type OrderCreatedEvent = {
  type: 'order:created'
  order: Order
}

export type ItemAddedEvent = {
  type: 'item:added'
  item: OrderItem
  menu_item: MenuItem
  routing_zone: RoutingZone
}

export type ItemStatusChangedEvent = {
  type: 'item:status_changed'
  item_id: string
  old_status: ItemStatus
  new_status: ItemStatus
  routing_zone: RoutingZone
}

export type QueueSnapshotEvent = {
  type: 'queue:snapshot'
  routing_zone: RoutingZone
  items: QueueItem[]
}

export type OrderClosedEvent = {
  type: 'order:closed'
  order_id: string
  table_id: string
}
