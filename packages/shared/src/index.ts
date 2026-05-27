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
  updated_at: string
}

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
  created_at: string
  updated_at: string
}

export type Table = {
  id: string
  name: string
  seats: number
  created_at: string
  updated_at: string
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
}

export type AddOrderItemResponse = OrderItem

export type UpdateItemStatusRequest = {
  status: ItemStatus
}

export type UpdateItemStatusResponse = OrderItem

export type GetOrderResponse = Order & {
  items: (OrderItem & { menu_item: MenuItem })[]
}

export type GetQueueResponse = (OrderItem & {
  menu_item: MenuItem
  order: Order
})[]

// ============================================================================
// WEBSOCKET EVENT TYPES
// ============================================================================

export type WebSocketEvent =
  | OrderCreatedEvent
  | ItemAddedEvent
  | ItemStatusChangedEvent
  | QueueSnapshotEvent

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
  items: (OrderItem & { menu_item: MenuItem; order: Order })[]
}
