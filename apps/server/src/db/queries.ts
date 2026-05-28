const { v4: uuid } = require('uuid')
import { getDatabase } from './init'
import {
  Order,
  OrderItem,
  MenuItem,
  Category,
  CategoryWithItems,
  Table,
  TableWithStatus,
  QueueItem,
  OpenOrder,
  OrderRoutingMode,
  ItemStatus,
  RoutingZone,
} from '@vynex/shared'

// ============================================================================
// VENUE HELPERS
// ============================================================================

export function getDefaultVenueId(): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT id FROM venues LIMIT 1').get() as { id: string } | undefined
  return row?.id ?? null
}

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

  return row ? mapOrder(row) : null
}

export function closeOrder(orderId: string, paymentMethod: 'cash' | 'card'): Order {
  const db = getDatabase()
  const now = new Date().toISOString()

  db.prepare(
    'UPDATE orders SET status = ?, payment_method = ?, closed_at = ?, updated_at = ? WHERE id = ?'
  ).run('closed', paymentMethod, now, now, orderId)

  return getOrder(orderId)!
}

export function listOpenOrders(): OpenOrder[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT o.*, t.name as table_name
       FROM orders o
       JOIN tables t ON o.table_id = t.id
       WHERE o.status = 'open'
       ORDER BY o.created_at DESC`
    )
    .all() as any[]

  return rows.map(row => {
    const items = getOrderItems(row.id)
    const total = items.reduce((sum, item) => sum + item.quantity * item.menu_item.price, 0)
    return {
      id: row.id,
      table_id: row.table_id,
      table_name: row.table_name,
      routing_mode: row.routing_mode as OrderRoutingMode,
      status: 'open' as const,
      created_at: row.created_at,
      updated_at: row.updated_at,
      items,
      total,
    }
  })
}

function mapOrder(row: any): Order {
  return {
    id: row.id,
    table_id: row.table_id,
    routing_mode: row.routing_mode as OrderRoutingMode,
    status: row.status as 'open' | 'closed',
    payment_method: row.payment_method ?? undefined,
    closed_at: row.closed_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
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

  return row ? mapOrderItem(row) : null
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
      `SELECT oi.*, mi.id as mi_id, mi.category_id, mi.name as mi_name, mi.price, mi.routing_zone, mi.enabled, mi.created_at as mi_created_at
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = ?
       ORDER BY oi.created_at`
    )
    .all(orderId) as any[]

  return rows.map(row => ({
    ...mapOrderItem(row),
    menu_item: mapMenuItemFromRow(row),
  }))
}

function mapOrderItem(row: any): OrderItem {
  return {
    id: row.id,
    order_id: row.order_id,
    menu_item_id: row.menu_item_id,
    quantity: row.quantity,
    status: row.status as ItemStatus,
    notes: row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ============================================================================
// QUEUE QUERIES
// ============================================================================

export function getQueueByZone(routingZone: RoutingZone): QueueItem[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT
        oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.status, oi.notes,
        oi.created_at as oi_created_at, oi.updated_at as oi_updated_at,
        mi.id as mi_id, mi.category_id, mi.name as mi_name, mi.price, mi.routing_zone, mi.enabled, mi.created_at as mi_created_at,
        o.id as o_id, o.table_id, o.routing_mode, o.status as o_status,
        o.payment_method, o.closed_at,
        o.created_at as o_created_at, o.updated_at as o_updated_at,
        t.name as table_name
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       JOIN orders o ON oi.order_id = o.id
       JOIN tables t ON o.table_id = t.id
       WHERE mi.routing_zone = ? AND o.status = 'open'
       ORDER BY oi.status, oi.created_at`
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
    menu_item: mapMenuItemFromRow(row),
    order: {
      id: row.o_id,
      table_id: row.table_id,
      routing_mode: row.routing_mode as OrderRoutingMode,
      status: row.o_status as 'open' | 'closed',
      payment_method: row.payment_method ?? undefined,
      closed_at: row.closed_at ?? undefined,
      created_at: row.o_created_at,
      updated_at: row.o_updated_at,
      table_name: row.table_name,
    },
  }))
}

// ============================================================================
// MENU ITEM QUERIES
// ============================================================================

export function getMenuItem(itemId: string): MenuItem | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(itemId) as any
  return row ? mapMenuItem(row) : null
}

export function listMenuItems(): MenuItem[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM menu_items WHERE enabled = 1 ORDER BY name').all() as any[]
  return rows.map(mapMenuItem)
}

export function listAllMenuItems(): MenuItem[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM menu_items ORDER BY name').all() as any[]
  return rows.map(mapMenuItem)
}

export function createMenuItem(
  categoryId: string,
  name: string,
  price: number,
  routingZone: RoutingZone
): MenuItem {
  const db = getDatabase()
  const id = uuid()
  const now = new Date().toISOString()

  db.prepare(
    'INSERT INTO menu_items (id, category_id, name, price, routing_zone, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, categoryId, name, price, routingZone, 1, now)

  return getMenuItem(id)!
}

export function updateMenuItem(
  itemId: string,
  name: string,
  price: number,
  routingZone: RoutingZone
): MenuItem {
  const db = getDatabase()
  db.prepare('UPDATE menu_items SET name = ?, price = ?, routing_zone = ? WHERE id = ?').run(
    name,
    price,
    routingZone,
    itemId
  )
  return getMenuItem(itemId)!
}

export function toggleMenuItem(itemId: string): MenuItem {
  const db = getDatabase()
  db.prepare('UPDATE menu_items SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ?').run(itemId)
  return getMenuItem(itemId)!
}

export function deleteMenuItem(itemId: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(itemId)
}

function mapMenuItem(row: any): MenuItem {
  return {
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    price: row.price,
    routing_zone: row.routing_zone as RoutingZone,
    enabled: row.enabled === 1,
    created_at: row.created_at,
    updated_at: row.created_at,
  }
}

function mapMenuItemFromRow(row: any): MenuItem {
  return {
    id: row.mi_id,
    category_id: row.category_id,
    name: row.mi_name,
    price: row.price,
    routing_zone: row.routing_zone as RoutingZone,
    enabled: row.enabled === 1,
    created_at: row.mi_created_at || '',
    updated_at: row.mi_created_at || '',
  }
}

// ============================================================================
// CATEGORY QUERIES
// ============================================================================

export function listCategories(): Category[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM categories ORDER BY name').all() as any[]
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    routing_zone: row.routing_zone as RoutingZone,
    created_at: row.created_at,
  }))
}

export function listCategoriesWithItems(): CategoryWithItems[] {
  const categories = listCategories()
  const db = getDatabase()

  return categories.map(cat => {
    const items = db
      .prepare('SELECT * FROM menu_items WHERE category_id = ? ORDER BY name')
      .all(cat.id) as any[]
    return {
      ...cat,
      items: items.map(mapMenuItem),
    }
  })
}

export function createCategory(venueId: string, name: string, routingZone: RoutingZone): Category {
  const db = getDatabase()
  const id = uuid()
  const now = new Date().toISOString()

  db.prepare(
    'INSERT INTO categories (id, venue_id, name, routing_zone, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, venueId, name, routingZone, now)

  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any
  return {
    id: row.id,
    name: row.name,
    routing_zone: row.routing_zone as RoutingZone,
    created_at: row.created_at,
  }
}

export function deleteCategory(categoryId: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId)
}

// ============================================================================
// TABLE QUERIES
// ============================================================================

export function listTables(): Table[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT id, name, seats, created_at FROM tables ORDER BY name').all() as any[]
  return rows.map(mapTable)
}

export function listTablesWithStatus(): TableWithStatus[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.seats, t.created_at,
              CASE WHEN o.id IS NOT NULL THEN 'occupied' ELSE 'free' END as status,
              o.id as order_id
       FROM tables t
       LEFT JOIN orders o ON o.table_id = t.id AND o.status = 'open'
       ORDER BY t.name`
    )
    .all() as any[]

  return rows.map(row => ({
    ...mapTable(row),
    status: row.status as 'free' | 'occupied',
    order_id: row.order_id ?? undefined,
  }))
}

export function getTable(tableId: string): Table | null {
  const db = getDatabase()
  const row = db.prepare('SELECT id, name, seats, created_at FROM tables WHERE id = ?').get(tableId) as any
  return row ? mapTable(row) : null
}

export function createTable(venueId: string, name: string, seats: number): Table {
  const db = getDatabase()
  const id = uuid()
  const now = new Date().toISOString()

  db.prepare('INSERT INTO tables (id, venue_id, name, seats, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    venueId,
    name,
    seats,
    now
  )

  return getTable(id)!
}

export function updateTable(tableId: string, name: string, seats: number): Table {
  const db = getDatabase()
  db.prepare('UPDATE tables SET name = ?, seats = ? WHERE id = ?').run(name, seats, tableId)
  return getTable(tableId)!
}

export function deleteTable(tableId: string): { ok: boolean; error?: string } {
  const db = getDatabase()
  const open = db
    .prepare("SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status = 'open'")
    .get(tableId) as { count: number }

  if (open.count > 0) {
    return { ok: false, error: 'Table has an open order — close it before deleting' }
  }

  db.prepare('DELETE FROM tables WHERE id = ?').run(tableId)
  return { ok: true }
}

function mapTable(row: any): Table {
  return {
    id: row.id,
    name: row.name,
    seats: row.seats,
    created_at: row.created_at,
  }
}
