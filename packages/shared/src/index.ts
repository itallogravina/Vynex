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
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  name: string
  routing_zone: RoutingZone
  created_at: string
}

export type CategoryWithItems = Category & { items: MenuItem[] }

export type OrderItem = {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  status: ItemStatus
  notes?: string
  created_at: string
  updated_at: string
}

export type Order = {
  id: string
  table_id: string
  routing_mode: OrderRoutingMode
  status: 'open' | 'closed'
  payment_method?: 'cash' | 'card'
  closed_at?: string
  created_at: string
  updated_at: string
}

export type Table = {
  id: string
  name: string
  seats: number
  created_at: string
}

export type TableWithStatus = Table & {
  status: 'free' | 'occupied'
  order_id?: string
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
  notes?: string | undefined
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
