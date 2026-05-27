const { v4: uuid } = require('uuid')
import { getDatabase } from './init'
import {
  Order,
  OrderItem,
  MenuItem,
  Category,
  Table,
  OrderRoutingMode,
  ItemStatus,
  RoutingZone,
} from '@vynex/shared'

// ============================================================================
// ORDER QUERIES
// ============================================================================

export function createOrder(tableId: string, routingMode: OrderRoutingMode): Order {
  const db = getDatabase()
  const id = uuid()
  const now = new Date().toISOString()

  db.prepare(
    'INSERT INTO orders (id, table_id, routing_mode, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, tableId, routingMode, 'open', now, now)

  return getOrder(id)!
}

export function getOrder(orderId: string): Order | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any

  return row
    ? {
        id: row.id,
        table_id: row.table_id,
        routing_mode: row.routing_mode as OrderRoutingMode,
        status: row.status as 'open' | 'closed',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    : null
}

export function closeOrder(orderId: string): Order {
  const db = getDatabase()
  const now = new Date().toISOString()

  db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run('closed', now, orderId)

  return getOrder(orderId)!
}

// ============================================================================
// ORDER ITEM QUERIES
// ============================================================================

export function addOrderItem(
  orderId: string,
  menuItemId: string,
  quantity: number,
  notes?: string
): OrderItem {
  const db = getDatabase()
  const id = uuid()
  const now = new Date().toISOString()

  db.prepare(
    'INSERT INTO order_items (id, order_id, menu_item_id, quantity, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, orderId, menuItemId, quantity, 'pending', notes || null, now, now)

  return getOrderItem(id)!
}

export function getOrderItem(itemId: string): OrderItem | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId) as any

  return row
    ? {
        id: row.id,
        order_id: row.order_id,
        menu_item_id: row.menu_item_id,
        quantity: row.quantity,
        status: row.status as ItemStatus,
        notes: row.notes || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    : null
}

export function updateOrderItemStatus(itemId: string, status: ItemStatus): OrderItem {
  const db = getDatabase()
  const now = new Date().toISOString()

  db.prepare('UPDATE order_items SET status = ?, updated_at = ? WHERE id = ?').run(status, now, itemId)

  return getOrderItem(itemId)!
}

export function getOrderItems(orderId: string): (OrderItem & { menu_item: MenuItem })[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `
    SELECT oi.*, mi.id as mi_id, mi.category_id, mi.name as mi_name, mi.price, mi.routing_zone, mi.enabled
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id = ?
    ORDER BY oi.created_at
  `
    )
    .all(orderId) as any[]

  return rows.map(row => ({
    id: row.id,
    order_id: row.order_id,
    menu_item_id: row.menu_item_id,
    quantity: row.quantity,
    status: row.status as ItemStatus,
    notes: row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    menu_item: {
      id: row.mi_id,
      category_id: row.category_id,
      name: row.mi_name,
      price: row.price,
      routing_zone: row.routing_zone as RoutingZone,
      enabled: row.enabled === 1,
      created_at: '', // Not fetched, will be added if needed
      updated_at: '',
    },
  }))
}

// ============================================================================
// QUEUE QUERIES
// ============================================================================

export function getQueueByZone(
  routingZone: RoutingZone
): (OrderItem & { menu_item: MenuItem; order: Order })[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `
    SELECT
      oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.status, oi.notes, oi.created_at as oi_created_at, oi.updated_at as oi_updated_at,
      mi.id as mi_id, mi.category_id, mi.name as mi_name, mi.price, mi.routing_zone, mi.enabled,
      o.id as o_id, o.table_id, o.routing_mode, o.status as o_status, o.created_at as o_created_at, o.updated_at as o_updated_at
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    JOIN orders o ON oi.order_id = o.id
    WHERE mi.routing_zone = ? AND o.status = 'open'
    ORDER BY oi.status, oi.created_at
  `
    )
    .all(routingZone) as any[]

  return rows.map(row => ({
    id: row.id,
    order_id: row.order_id,
    menu_item_id: row.menu_item_id,
    quantity: row.quantity,
    status: row.status as ItemStatus,
    notes: row.notes || undefined,
    created_at: row.oi_created_at,
    updated_at: row.oi_updated_at,
    menu_item: {
      id: row.mi_id,
      category_id: row.category_id,
      name: row.mi_name,
      price: row.price,
      routing_zone: row.routing_zone as RoutingZone,
      enabled: row.enabled === 1,
      created_at: '',
      updated_at: '',
    },
    order: {
      id: row.o_id,
      table_id: row.table_id,
      routing_mode: row.routing_mode as OrderRoutingMode,
      status: row.o_status as 'open' | 'closed',
      created_at: row.o_created_at,
      updated_at: row.o_updated_at,
    },
  }))
}

// ============================================================================
// MENU ITEM QUERIES
// ============================================================================

export function getMenuItem(itemId: string): MenuItem | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(itemId) as any

  return row
    ? {
        id: row.id,
        category_id: row.category_id,
        name: row.name,
        price: row.price,
        routing_zone: row.routing_zone as RoutingZone,
        enabled: row.enabled === 1,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    : null
}

export function listMenuItems(): MenuItem[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM menu_items WHERE enabled = 1 ORDER BY name').all() as any[]

  return rows.map(row => ({
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    price: row.price,
    routing_zone: row.routing_zone as RoutingZone,
    enabled: row.enabled === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))
}

// ============================================================================
// TABLE QUERIES
// ============================================================================

export function listTables(): Table[] {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT id, name, seats, created_at, updated_at FROM tables ORDER BY name')
    .all() as any[]

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    seats: row.seats,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))
}

export function getTable(tableId: string): Table | null {
  const db = getDatabase()
  const row = db
    .prepare('SELECT id, name, seats, created_at, updated_at FROM tables WHERE id = ?')
    .get(tableId) as any

  return row
    ? {
        id: row.id,
        name: row.name,
        seats: row.seats,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    : null
}
