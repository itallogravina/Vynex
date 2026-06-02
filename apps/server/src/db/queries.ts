const { v4: uuid } = require('uuid')
import { getClient } from './init'
import {
  Order,
  OrderItem,
  MenuItem,
  Category,
  CategoryWithItems,
  Table,
  TableWithStatus,
  TableFloorMapItem,
  QueueItem,
  OpenOrder,
  OrderRoutingMode,
  ItemStatus,
  Priority,
  RoutingZone,
  User,
  Role,
  LoginMethod,
  SalesReport,
  TopItemsReport,
  PerWaiterReport,
  ShiftSummaryReport,
  PeakHourReport,
  CancellationRateReport,
  PeriodComparison,
  NeverOrderedReport,
  VariationGroup,
  VariationOption,
  CashierClosingSummary,
} from '@vynex/shared'

// ============================================================================
// AUDIT LOG
// ============================================================================

async function logMenuChange(
  tableName: string,
  rowId: string,
  operation: 'insert' | 'update' | 'delete',
  changedFields: Record<string, unknown> | null = null
): Promise<void> {
  const client = getClient()
  await client.execute({
    sql: 'INSERT INTO menu_changes_log (id, table_name, row_id, operation, changed_fields, source, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [uuid(), tableName, rowId, operation, changedFields ? JSON.stringify(changedFields) : null, 'local', new Date().toISOString()],
  })
}

// ============================================================================
// VENUE HELPERS
// ============================================================================

export async function getDefaultVenueId(): Promise<string | null> {
  const client = getClient()
  const result = await client.execute('SELECT id FROM venues LIMIT 1')
  return (result.rows[0]?.id as string) ?? null
}

// ============================================================================
// ORDER QUERIES
// ============================================================================

export async function createOrder(
  tableId: string,
  routingMode: OrderRoutingMode,
  openedBy?: string
): Promise<Order> {
  const client = getClient()
  const id = uuid()
  const now = new Date().toISOString()

  await client.execute({
    sql: 'INSERT INTO orders (id, table_id, routing_mode, status, opened_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, tableId, routingMode, 'open', openedBy ?? null, now, now],
  })

  return (await getOrder(id))!
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const client = getClient()
  const result = await client.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [orderId] })
  const row = result.rows[0]
  return row ? mapOrder(row) : null
}

export async function closeOrder(orderId: string, paymentMethod: 'cash' | 'card'): Promise<Order> {
  const client = getClient()
  const now = new Date().toISOString()

  await client.execute({
    sql: 'UPDATE orders SET status = ?, payment_method = ?, closed_at = ?, updated_at = ? WHERE id = ?',
    args: ['closed', paymentMethod, now, now, orderId],
  })

  return (await getOrder(orderId))!
}

export async function listOpenOrders(): Promise<OpenOrder[]> {
  const client = getClient()
  const result = await client.execute(
    `SELECT o.*, t.name as table_name, t.min_consumption as table_min_consumption
     FROM orders o
     JOIN tables t ON o.table_id = t.id
     WHERE o.status = 'open'
     ORDER BY o.created_at DESC`
  )

  const orders: OpenOrder[] = []
  for (const row of result.rows) {
    const items = await getOrderItems(row.id as string)
    const total = items.reduce((sum, item) => sum + item.quantity * item.menu_item.price, 0)
    orders.push({
      id: row.id as string,
      table_id: row.table_id as string,
      table_name: row.table_name as string,
      routing_mode: row.routing_mode as OrderRoutingMode,
      status: 'open' as const,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      items,
      total,
      split_group_id: (row.split_group_id as string) ?? undefined,
      ...(row.tab_number != null ? { tab_number: row.tab_number as string } : {}),
      ...(row.table_min_consumption != null ? { min_consumption: row.table_min_consumption as number } : {}),
    })
  }
  return orders
}

function mapOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    table_id: row.table_id as string,
    routing_mode: row.routing_mode as OrderRoutingMode,
    status: row.status as 'open' | 'closed',
    payment_method: (row.payment_method as 'cash' | 'card') ?? undefined,
    closed_at: (row.closed_at as string) ?? undefined,
    opened_by: (row.opened_by as string) ?? undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

// ============================================================================
// ORDER ITEM QUERIES
// ============================================================================

export async function addOrderItem(
  orderId: string,
  menuItemId: string,
  quantity: number,
  notes?: string,
  addedBy?: string,
  priority: Priority = Priority.NORMAL
): Promise<OrderItem> {
  const client = getClient()
  const id = uuid()
  const now = new Date().toISOString()

  await client.execute({
    sql: 'INSERT INTO order_items (id, order_id, menu_item_id, quantity, status, priority, notes, added_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, orderId, menuItemId, quantity, 'pending', priority, notes ?? null, addedBy ?? null, now, now],
  })

  return (await getOrderItem(id))!
}

export async function getOrderItem(itemId: string): Promise<OrderItem | null> {
  const client = getClient()
  const result = await client.execute({ sql: 'SELECT * FROM order_items WHERE id = ?', args: [itemId] })
  const row = result.rows[0]
  return row ? mapOrderItem(row) : null
}

export async function updateOrderItemStatus(itemId: string, status: ItemStatus): Promise<OrderItem> {
  const client = getClient()
  const now = new Date().toISOString()

  await client.execute({
    sql: 'UPDATE order_items SET status = ?, updated_at = ? WHERE id = ?',
    args: [status, now, itemId],
  })

  return (await getOrderItem(itemId))!
}

export async function getOrderItems(orderId: string): Promise<(OrderItem & { menu_item: MenuItem })[]> {
  const client = getClient()
  const result = await client.execute({
    sql: `SELECT oi.*, mi.id as mi_id, mi.category_id, mi.name as mi_name, mi.price, mi.routing_zone, mi.enabled, mi.eightysixed_at, mi.prep_time_seconds, mi.created_at as mi_created_at, mi.updated_at as mi_updated_at
          FROM order_items oi
          JOIN menu_items mi ON oi.menu_item_id = mi.id
          WHERE oi.order_id = ?
          ORDER BY oi.created_at`,
    args: [orderId],
  })

  return result.rows.map(row => ({
    ...mapOrderItem(row),
    menu_item: mapMenuItemFromRow(row),
  }))
}

function mapOrderItem(row: Record<string, unknown>): OrderItem {
  const item: OrderItem = {
    id: row.id as string,
    order_id: row.order_id as string,
    menu_item_id: row.menu_item_id as string,
    quantity: row.quantity as number,
    status: row.status as ItemStatus,
    priority: (row.priority as Priority) ?? Priority.NORMAL,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
  if (row.notes) item.notes = row.notes as string
  if (row.added_by) item.added_by = row.added_by as string
  return item
}

// ============================================================================
// QUEUE QUERIES
// ============================================================================

export async function getQueueByZone(routingZone: RoutingZone): Promise<QueueItem[]> {
  const client = getClient()
  const result = await client.execute({
    sql: `SELECT
            oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.status, oi.priority, oi.notes,
            oi.created_at as oi_created_at, oi.updated_at as oi_updated_at,
            mi.id as mi_id, mi.category_id, mi.name as mi_name, mi.price, mi.routing_zone, mi.enabled,
            mi.eightysixed_at, mi.prep_time_seconds, mi.created_at as mi_created_at, mi.updated_at as mi_updated_at,
            o.id as o_id, o.table_id, o.routing_mode, o.status as o_status,
            o.payment_method, o.closed_at,
            o.created_at as o_created_at, o.updated_at as o_updated_at,
            t.name as table_name
          FROM order_items oi
          JOIN menu_items mi ON oi.menu_item_id = mi.id
          JOIN orders o ON oi.order_id = o.id
          JOIN tables t ON o.table_id = t.id
          WHERE mi.routing_zone = ? AND o.status = 'open'
          ORDER BY
            CASE oi.priority WHEN 'vip' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
            oi.status,
            oi.created_at`,
    args: [routingZone],
  })

  return result.rows.map(row => {
    const queueItem: QueueItem = {
      id: row.id as string,
      order_id: row.order_id as string,
      menu_item_id: row.menu_item_id as string,
      quantity: row.quantity as number,
      status: row.status as ItemStatus,
      priority: (row.priority as Priority) ?? Priority.NORMAL,
      created_at: row.oi_created_at as string,
      updated_at: row.oi_updated_at as string,
      menu_item: mapMenuItemFromRow(row),
      order: {
        id: row.o_id as string,
        table_id: row.table_id as string,
        routing_mode: row.routing_mode as OrderRoutingMode,
        status: row.o_status as 'open' | 'closed',
        created_at: row.o_created_at as string,
        updated_at: row.o_updated_at as string,
        table_name: row.table_name as string,
      },
    }
    if (row.notes) queueItem.notes = row.notes as string
    if (row.payment_method) queueItem.order.payment_method = row.payment_method as 'cash' | 'card'
    if (row.closed_at) queueItem.order.closed_at = row.closed_at as string
    return queueItem
  })
}

// ============================================================================
// MENU ITEM QUERIES
// ============================================================================

export async function getMenuItem(itemId: string): Promise<MenuItem | null> {
  const client = getClient()
  const result = await client.execute({ sql: 'SELECT * FROM menu_items WHERE id = ?', args: [itemId] })
  const row = result.rows[0]
  return row ? mapMenuItem(row) : null
}

export async function listMenuItems(): Promise<MenuItem[]> {
  const client = getClient()
  const result = await client.execute('SELECT * FROM menu_items WHERE enabled = 1 ORDER BY name')
  return result.rows.map(mapMenuItem)
}

export async function listAllMenuItems(): Promise<MenuItem[]> {
  const client = getClient()
  const result = await client.execute('SELECT * FROM menu_items ORDER BY name')
  return result.rows.map(mapMenuItem)
}

export async function createMenuItem(
  categoryId: string | null,
  name: string,
  price: number,
  routingZone: RoutingZone
): Promise<MenuItem> {
  const client = getClient()
  const id = uuid()
  const now = new Date().toISOString()

  await client.execute({
    sql: 'INSERT INTO menu_items (id, category_id, name, price, routing_zone, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, categoryId, name, price, routingZone, 1, now, now],
  })

  await logMenuChange('menu_items', id, 'insert', { name, price, routing_zone: routingZone, category_id: categoryId })
  return (await getMenuItem(id))!
}

export async function updateMenuItem(
  itemId: string,
  name: string,
  price: number,
  routingZone: RoutingZone
): Promise<MenuItem> {
  const client = getClient()
  const now = new Date().toISOString()

  await client.execute({
    sql: 'UPDATE menu_items SET name = ?, price = ?, routing_zone = ?, updated_at = ? WHERE id = ?',
    args: [name, price, routingZone, now, itemId],
  })

  await logMenuChange('menu_items', itemId, 'update', { name, price, routing_zone: routingZone })
  return (await getMenuItem(itemId))!
}

export async function toggleMenuItem(itemId: string): Promise<MenuItem> {
  const client = getClient()
  const now = new Date().toISOString()

  await client.execute({
    sql: 'UPDATE menu_items SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?',
    args: [now, itemId],
  })

  const item = (await getMenuItem(itemId))!
  await logMenuChange('menu_items', itemId, 'update', { enabled: item.enabled })
  return item
}

export async function eightySixMenuItem(itemId: string): Promise<MenuItem> {
  const client = getClient()
  const item = await getMenuItem(itemId)
  if (!item) throw new Error('Item not found')

  const now = new Date().toISOString()
  // Toggle: already 86'd today → clear; otherwise → set to now
  const newValue = item.eightysixed_at ? null : now

  await client.execute({
    sql: 'UPDATE menu_items SET eightysixed_at = ?, updated_at = ? WHERE id = ?',
    args: [newValue, now, itemId],
  })

  await logMenuChange('menu_items', itemId, 'update', { eightysixed_at: newValue })
  return (await getMenuItem(itemId))!
}

export async function setPrepTime(itemId: string, seconds: number | null): Promise<MenuItem> {
  const client = getClient()
  const now = new Date().toISOString()
  await client.execute({
    sql: 'UPDATE menu_items SET prep_time_seconds = ?, updated_at = ? WHERE id = ?',
    args: [seconds, now, itemId],
  })
  await logMenuChange('menu_items', itemId, 'update', { prep_time_seconds: seconds })
  return (await getMenuItem(itemId))!
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  const client = getClient()
  await logMenuChange('menu_items', itemId, 'delete', null)
  await client.execute({ sql: 'DELETE FROM menu_items WHERE id = ?', args: [itemId] })
}

function todayPrefix(): string {
  return new Date().toISOString().slice(0, 10)
}

function resolveEightySixedAt(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null
  return raw.startsWith(todayPrefix()) ? raw : null
}

function mapMenuItem(row: Record<string, unknown>): MenuItem {
  return {
    id: row.id as string,
    category_id: row.category_id as string,
    name: row.name as string,
    price: row.price as number,
    routing_zone: row.routing_zone as RoutingZone,
    enabled: row.enabled === 1 || row.enabled === true,
    eightysixed_at: resolveEightySixedAt(row.eightysixed_at),
    prep_time_seconds: (row.prep_time_seconds as number | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function mapMenuItemFromRow(row: Record<string, unknown>): MenuItem {
  return {
    id: row.mi_id as string,
    category_id: row.category_id as string,
    name: row.mi_name as string,
    price: row.price as number,
    routing_zone: row.routing_zone as RoutingZone,
    enabled: row.enabled === 1 || row.enabled === true,
    eightysixed_at: resolveEightySixedAt(row.eightysixed_at),
    prep_time_seconds: (row.prep_time_seconds as number | null) ?? null,
    created_at: row.mi_created_at as string,
    updated_at: (row.mi_updated_at as string) || '',
  }
}

// ============================================================================
// CATEGORY QUERIES
// ============================================================================

function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    name: row.name as string,
    routing_zone: row.routing_zone as RoutingZone,
    active_from: (row.active_from as string) ?? null,
    active_to: (row.active_to as string) ?? null,
    created_at: row.created_at as string,
  }
}

export async function listCategories(): Promise<Category[]> {
  const client = getClient()
  const result = await client.execute('SELECT * FROM categories ORDER BY name')
  return result.rows.map(mapCategory)
}

export async function listCategoriesWithItems(): Promise<CategoryWithItems[]> {
  const client = getClient()
  const categories = await listCategories()

  return Promise.all(
    categories.map(async cat => {
      const result = await client.execute({
        sql: 'SELECT * FROM menu_items WHERE category_id = ? ORDER BY name',
        args: [cat.id],
      })
      return {
        ...cat,
        items: result.rows.map(mapMenuItem),
      }
    })
  )
}

export async function createCategory(venueId: string, name: string, routingZone: RoutingZone): Promise<Category> {
  const client = getClient()
  const id = uuid()
  const now = new Date().toISOString()

  await client.execute({
    sql: 'INSERT INTO categories (id, venue_id, name, routing_zone, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, venueId, name, routingZone, now],
  })

  await logMenuChange('categories', id, 'insert', { name, routing_zone: routingZone, venue_id: venueId })

  const result = await client.execute({ sql: 'SELECT * FROM categories WHERE id = ?', args: [id] })
  const row = result.rows[0]!
  return mapCategory(row)
}

export async function updateCategory(
  categoryId: string,
  name: string,
  routingZone: RoutingZone,
  activeFrom: string | null,
  activeTo: string | null
): Promise<Category> {
  const client = getClient()
  await client.execute({
    sql: 'UPDATE categories SET name = ?, routing_zone = ?, active_from = ?, active_to = ? WHERE id = ?',
    args: [name, routingZone, activeFrom ?? null, activeTo ?? null, categoryId],
  })
  await logMenuChange('categories', categoryId, 'update', { name, routing_zone: routingZone, active_from: activeFrom, active_to: activeTo })
  const result = await client.execute({ sql: 'SELECT * FROM categories WHERE id = ?', args: [categoryId] })
  return mapCategory(result.rows[0]!)
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const client = getClient()
  await logMenuChange('categories', categoryId, 'delete', null)
  await client.execute({ sql: 'DELETE FROM categories WHERE id = ?', args: [categoryId] })
}

// ============================================================================
// TABLE QUERIES
// ============================================================================

export async function listTables(): Promise<Table[]> {
  const client = getClient()
  const result = await client.execute('SELECT id, name, seats, pos_x, pos_y, floor, created_at FROM tables ORDER BY name')
  return result.rows.map(mapTable)
}

export async function listTablesWithStatus(): Promise<TableWithStatus[]> {
  const client = getClient()
  const result = await client.execute(
    `SELECT t.id, t.name, t.seats, t.pos_x, t.pos_y, t.floor, t.created_at,
            CASE WHEN COUNT(o.id) > 0 THEN 'occupied' ELSE 'free' END as status,
            MAX(o.id) as order_id
     FROM tables t
     LEFT JOIN orders o ON o.table_id = t.id AND o.status = 'open'
     GROUP BY t.id
     ORDER BY t.name`
  )

  return result.rows.map(row => ({
    ...mapTable(row),
    status: row.status as 'free' | 'occupied',
    order_id: (row.order_id as string) ?? undefined,
  }))
}

export async function listTablesForFloorMap(): Promise<TableFloorMapItem[]> {
  const client = getClient()
  const result = await client.execute(
    `SELECT t.id, t.name, t.seats, t.pos_x, t.pos_y, t.floor, t.created_at,
            CASE WHEN COUNT(o.id) > 0 THEN 'occupied' ELSE 'free' END as status,
            MAX(o.id) as order_id,
            MIN(o.created_at) as order_created_at
     FROM tables t
     LEFT JOIN orders o ON o.table_id = t.id AND o.status = 'open'
     GROUP BY t.id
     ORDER BY t.floor, t.name`
  )

  return result.rows.map(row => ({
    ...mapTable(row),
    status: row.status as 'free' | 'occupied',
    order_id: (row.order_id as string) ?? undefined,
    opened_at: (row.order_created_at as string) ?? undefined,
  }))
}

export async function updateTablePosition(tableId: string, posX: number, posY: number, floor: number): Promise<Table> {
  const client = getClient()
  await client.execute({
    sql: 'UPDATE tables SET pos_x = ?, pos_y = ?, floor = ? WHERE id = ?',
    args: [posX, posY, floor, tableId],
  })
  return (await getTable(tableId))!
}

export async function listIdleTables(idleMinutes: number): Promise<TableFloorMapItem[]> {
  const client = getClient()
  const cutoff = new Date(Date.now() - idleMinutes * 60 * 1000).toISOString()
  const result = await client.execute({
    sql: `SELECT t.id, t.name, t.seats, t.pos_x, t.pos_y, t.floor, t.created_at,
                 'occupied' as status, o.id as order_id, o.created_at as order_created_at
          FROM tables t
          JOIN orders o ON o.table_id = t.id AND o.status = 'open'
          WHERE o.created_at < ?
            AND NOT EXISTS (
              SELECT 1 FROM order_items oi
              WHERE oi.order_id = o.id AND oi.created_at > ?
            )`,
    args: [cutoff, cutoff],
  })
  return result.rows.map(row => ({
    ...mapTable(row),
    status: 'occupied' as const,
    order_id: (row.order_id as string) ?? undefined,
    opened_at: (row.order_created_at as string) ?? undefined,
  }))
}

export async function getTable(tableId: string): Promise<Table | null> {
  const client = getClient()
  const result = await client.execute({
    sql: 'SELECT id, name, seats, pos_x, pos_y, floor, min_consumption, created_at FROM tables WHERE id = ?',
    args: [tableId],
  })
  const row = result.rows[0]
  return row ? mapTable(row) : null
}

export async function createTable(venueId: string, name: string, seats: number): Promise<Table> {
  const client = getClient()
  const id = uuid()
  const now = new Date().toISOString()

  await client.execute({
    sql: 'INSERT INTO tables (id, venue_id, name, seats, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, venueId, name, seats, now],
  })

  return (await getTable(id))!
}

export async function updateTable(tableId: string, name: string, seats: number, minConsumption?: number | null): Promise<Table> {
  const client = getClient()
  await client.execute({
    sql: 'UPDATE tables SET name = ?, seats = ?, min_consumption = ? WHERE id = ?',
    args: [name, seats, minConsumption ?? null, tableId],
  })
  return (await getTable(tableId))!
}

export async function setOrderTabNumber(orderId: string, tabNumber: string | null): Promise<void> {
  const client = getClient()
  await client.execute({
    sql: 'UPDATE orders SET tab_number = ?, updated_at = ? WHERE id = ?',
    args: [tabNumber, new Date().toISOString(), orderId],
  })
}

export async function deleteTable(
  tableId: string
): Promise<{ ok: true } | { ok: false; code: 'TABLE_HAS_OPEN_ORDERS'; open_orders: number }> {
  const client = getClient()

  const openResult = await client.execute({
    sql: "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status = 'open'",
    args: [tableId],
  })
  const openCount = Number(openResult.rows[0]?.count ?? 0)

  if (openCount > 0) {
    return { ok: false, code: 'TABLE_HAS_OPEN_ORDERS', open_orders: openCount }
  }

  // Delete closed orders referencing this table (FK constraint), then delete table
  await client.execute({ sql: 'DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE table_id = ?)', args: [tableId] })
  await client.execute({ sql: 'DELETE FROM orders WHERE table_id = ?', args: [tableId] })
  await client.execute({ sql: 'DELETE FROM tables WHERE id = ?', args: [tableId] })
  return { ok: true }
}

export async function forceDeleteTable(tableId: string): Promise<void> {
  const client = getClient()
  const now = new Date().toISOString()
  await client.execute({
    sql: `UPDATE orders SET status = 'closed', payment_method = 'cancelled', closed_at = ?, updated_at = ?
          WHERE table_id = ? AND status = 'open'`,
    args: [now, now, tableId],
  })
  // Delete all orders (now all closed) and their items before removing the table
  await client.execute({ sql: 'DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE table_id = ?)', args: [tableId] })
  await client.execute({ sql: 'DELETE FROM orders WHERE table_id = ?', args: [tableId] })
  await client.execute({ sql: 'DELETE FROM tables WHERE id = ?', args: [tableId] })
}

function mapTable(row: Record<string, unknown>): Table {
  return {
    id: row.id as string,
    name: row.name as string,
    seats: row.seats as number,
    pos_x: (row.pos_x as number) ?? 0,
    pos_y: (row.pos_y as number) ?? 0,
    floor: (row.floor as number) ?? 0,
    ...(row.min_consumption != null ? { min_consumption: row.min_consumption as number } : {}),
    created_at: row.created_at as string,
  }
}

// ============================================================================
// USER QUERIES
// ============================================================================

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    name: row.name as string,
    role: row.role as Role,
    login_method: row.login_method as LoginMethod,
    enabled: row.enabled === 1 || row.enabled === true,
  }
}

export async function createUser(
  name: string,
  role: Role,
  loginMethod: LoginMethod,
  pinHash?: string,
  passwordHash?: string,
  username?: string
): Promise<User> {
  const client = getClient()
  const id = uuid()
  const now = new Date().toISOString()

  await client.execute({
    sql: `INSERT INTO users (id, name, username, role, login_method, pin_hash, password_hash, enabled, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    args: [id, name, username ?? null, role, loginMethod, pinHash ?? null, passwordHash ?? null, now, now],
  })

  return (await getUser(id))!
}

export async function listUsers(): Promise<User[]> {
  const client = getClient()
  const result = await client.execute(
    'SELECT id, name, role, login_method, enabled FROM users ORDER BY name'
  )
  return result.rows.map(mapUser)
}

export async function getUser(id: string): Promise<User | null> {
  const client = getClient()
  const result = await client.execute({
    sql: 'SELECT id, name, role, login_method, enabled FROM users WHERE id = ?',
    args: [id],
  })
  const row = result.rows[0]
  return row ? mapUser(row) : null
}

export async function getUserByName(name: string): Promise<(User & { password_hash: string | null }) | null> {
  const client = getClient()
  const result = await client.execute({
    sql: `SELECT id, name, role, login_method, enabled, password_hash
          FROM users WHERE name = ? AND login_method = 'password' AND enabled = 1`,
    args: [name],
  })
  const row = result.rows[0]
  if (!row) return null
  return { ...mapUser(row), password_hash: (row.password_hash as string) ?? null }
}

export async function getAllPinUsers(): Promise<(User & { pin_hash: string | null })[]> {
  const client = getClient()
  const result = await client.execute(
    `SELECT id, name, role, login_method, enabled, pin_hash
     FROM users WHERE login_method = 'pin' AND enabled = 1`
  )
  return result.rows.map(row => ({ ...mapUser(row), pin_hash: (row.pin_hash as string) ?? null }))
}

export async function getListLoginUsers(): Promise<{ id: string; name: string }[]> {
  const client = getClient()
  const result = await client.execute(
    `SELECT id, name FROM users WHERE login_method = 'list' AND enabled = 1 ORDER BY name`
  )
  return result.rows.map(row => ({ id: row.id as string, name: row.name as string }))
}

export async function updateUser(
  id: string,
  fields: Partial<{
    name: string
    role: Role
    login_method: LoginMethod
    pin_hash: string | null
    password_hash: string | null
    enabled: boolean
  }>
): Promise<User> {
  const client = getClient()
  const now = new Date().toISOString()
  const sets: string[] = ['updated_at = ?']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args: any[] = [now]

  if (fields.name !== undefined) { sets.push('name = ?'); args.push(fields.name) }
  if (fields.role !== undefined) { sets.push('role = ?'); args.push(fields.role) }
  if (fields.login_method !== undefined) { sets.push('login_method = ?'); args.push(fields.login_method) }
  if ('pin_hash' in fields) { sets.push('pin_hash = ?'); args.push(fields.pin_hash ?? null) }
  if ('password_hash' in fields) { sets.push('password_hash = ?'); args.push(fields.password_hash ?? null) }
  if (fields.enabled !== undefined) { sets.push('enabled = ?'); args.push(fields.enabled ? 1 : 0) }

  args.push(id)
  await client.execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args })
  return (await getUser(id))!
}

export async function disableUser(id: string): Promise<void> {
  const client = getClient()
  const now = new Date().toISOString()
  await client.execute({
    sql: 'UPDATE users SET enabled = 0, updated_at = ? WHERE id = ?',
    args: [now, id],
  })
}

export async function deleteUser(id: string): Promise<void> {
  const client = getClient()
  await client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] })
}

export async function userHasOrders(id: string): Promise<boolean> {
  const client = getClient()
  const [r1, r2] = await Promise.all([
    client.execute({ sql: 'SELECT COUNT(*) as count FROM orders WHERE opened_by = ?', args: [id] }),
    client.execute({ sql: 'SELECT COUNT(*) as count FROM order_items WHERE added_by = ?', args: [id] }),
  ])
  return Number(r1.rows[0]?.count ?? 0) > 0 || Number(r2.rows[0]?.count ?? 0) > 0
}

// Alias for external callers that expect getUserById
export const getUserById = getUser

export async function getUserByUsername(username: string): Promise<(User & { pin_hash: string | null; password_hash: string | null }) | null> {
  const client = getClient()
  const result = await client.execute({
    sql: `SELECT id, name, role, login_method, enabled, pin_hash, password_hash
          FROM users WHERE username = ? AND enabled = 1`,
    args: [username],
  })
  const row = result.rows[0]
  if (!row) return null
  return {
    ...mapUser(row),
    pin_hash: (row.pin_hash as string | null) ?? null,
    password_hash: (row.password_hash as string | null) ?? null,
  }
}

export async function listUsersForLogin(): Promise<User[]> {
  const client = getClient()
  const result = await client.execute(
    "SELECT id, name, role, login_method, enabled FROM users WHERE enabled = 1 AND login_method = 'list' ORDER BY name"
  )
  return result.rows.map(mapUser)
}

export async function countUsers(): Promise<number> {
  const client = getClient()
  const result = await client.execute('SELECT COUNT(*) as count FROM users')
  return Number(result.rows[0]?.count ?? 0)
}

export async function softOrHardDeleteUser(id: string): Promise<{ ok: boolean; error?: string }> {
  const hasActivity = await userHasOrders(id)
  if (hasActivity) {
    await disableUser(id)
  } else {
    const client = getClient()
    await client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] })
  }
  return { ok: true }
}

// ============================================================================
// SESSION QUERIES
// ============================================================================

export async function createSession(token: string, userId: string, ttlHours: number): Promise<void> {
  const client = getClient()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString()

  await client.execute({
    sql: 'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    args: [token, userId, now.toISOString(), expiresAt],
  })
}

export async function getSessionUser(token: string): Promise<User | null> {
  const client = getClient()
  const result = await client.execute({
    sql: `SELECT u.id, u.name, u.role, u.login_method, u.enabled
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.id = ? AND s.expires_at > ? AND u.enabled = 1`,
    args: [token, new Date().toISOString()],
  })
  const row = result.rows[0]
  return row ? mapUser(row) : null
}

export async function deleteSession(token: string): Promise<void> {
  const client = getClient()
  await client.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [token] })
}

export async function deleteExpiredSessions(): Promise<void> {
  const client = getClient()
  await client.execute({
    sql: 'DELETE FROM sessions WHERE expires_at <= ?',
    args: [new Date().toISOString()],
  })
}

// ============================================================================
// REPORT QUERIES
// ============================================================================

export async function getSalesReport(
  from: string,
  to: string,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<SalesReport> {
  const client = getClient()
  const fmtMap = { day: '%Y-%m-%d', week: '%Y-W%W', month: '%Y-%m' }
  const fmt = fmtMap[groupBy]

  const totals = await client.execute({
    sql: `SELECT COALESCE(SUM(oi.quantity * mi.price), 0) as revenue, COUNT(DISTINCT o.id) as orders
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE o.status = 'closed' AND o.closed_at >= ? AND o.closed_at < ?`,
    args: [from, to],
  })

  const byGroup = await client.execute({
    sql: `SELECT strftime(?, o.closed_at) as date,
                 COALESCE(SUM(oi.quantity * mi.price), 0) as revenue,
                 COUNT(DISTINCT o.id) as orders
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE o.status = 'closed' AND o.closed_at >= ? AND o.closed_at < ?
          GROUP BY date
          ORDER BY date`,
    args: [fmt, from, to],
  })

  return {
    period: { from, to },
    total_revenue: Math.round(Number(totals.rows[0]?.revenue ?? 0) * 100) / 100,
    total_orders: Number(totals.rows[0]?.orders ?? 0),
    by_day: byGroup.rows.map(row => ({
      date: row.date as string,
      revenue: Math.round(Number(row.revenue) * 100) / 100,
      orders: Number(row.orders),
    })),
  }
}

export async function getTopItemsReport(
  from: string,
  to: string,
  limit: number = 10
): Promise<TopItemsReport> {
  const client = getClient()

  const items = await client.execute({
    sql: `SELECT oi.menu_item_id, mi.name,
                 SUM(oi.quantity) as quantity_sold,
                 SUM(oi.quantity * mi.price) as revenue
          FROM order_items oi
          JOIN menu_items mi ON mi.id = oi.menu_item_id
          JOIN orders o ON o.id = oi.order_id
          WHERE o.status = 'closed' AND o.closed_at >= ? AND o.closed_at < ?
          GROUP BY oi.menu_item_id
          ORDER BY revenue DESC
          LIMIT ?`,
    args: [from, to, limit],
  })

  const categories = await client.execute({
    sql: `SELECT mi.category_id, c.name,
                 SUM(oi.quantity * mi.price) as revenue
          FROM order_items oi
          JOIN menu_items mi ON mi.id = oi.menu_item_id
          JOIN categories c ON c.id = mi.category_id
          JOIN orders o ON o.id = oi.order_id
          WHERE o.status = 'closed' AND o.closed_at >= ? AND o.closed_at < ?
          GROUP BY mi.category_id
          ORDER BY revenue DESC
          LIMIT ?`,
    args: [from, to, limit],
  })

  return {
    top_items: items.rows.map(row => ({
      menu_item_id: row.menu_item_id as string,
      name: row.name as string,
      quantity_sold: Number(row.quantity_sold),
      revenue: Math.round(Number(row.revenue) * 100) / 100,
    })),
    top_categories: categories.rows.map(row => ({
      category_id: row.category_id as string,
      name: row.name as string,
      revenue: Math.round(Number(row.revenue) * 100) / 100,
    })),
  }
}

export async function getPerWaiterReport(from: string, to: string): Promise<PerWaiterReport> {
  const client = getClient()

  const rows = await client.execute({
    sql: `SELECT
            o.opened_by as user_id,
            COALESCE(u.name, 'Unknown') as name,
            COUNT(DISTINCT o.id) as orders_opened,
            COUNT(oi.id) as items_added,
            COALESCE(SUM(CASE WHEN o.status = 'closed' THEN oi.quantity * mi.price ELSE 0 END), 0) as revenue
          FROM orders o
          LEFT JOIN users u ON u.id = o.opened_by
          LEFT JOIN order_items oi ON oi.order_id = o.id
          LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE o.created_at >= ? AND o.created_at < ?
          GROUP BY o.opened_by
          ORDER BY revenue DESC`,
    args: [from, to],
  })

  return {
    waiters: rows.rows.map(row => ({
      user_id: (row.user_id as string) ?? null,
      name: row.name as string,
      orders_opened: Number(row.orders_opened),
      items_added: Number(row.items_added),
      revenue: Math.round(Number(row.revenue) * 100) / 100,
    })),
  }
}

// ============================================================================
// TABLE OPS — TRANSFER, MERGE, SPLIT
// ============================================================================

export async function transferOrder(orderId: string, toTableId: string): Promise<Order> {
  const client = getClient()
  const now = new Date().toISOString()
  await client.execute({
    sql: 'UPDATE orders SET table_id = ?, updated_at = ? WHERE id = ?',
    args: [toTableId, now, orderId],
  })
  return (await getOrder(orderId))!
}

export async function mergeOrders(sourceOrderId: string, targetOrderId: string): Promise<Order> {
  const client = getClient()
  const now = new Date().toISOString()
  await client.execute({
    sql: 'UPDATE order_items SET order_id = ?, updated_at = ? WHERE order_id = ?',
    args: [targetOrderId, now, sourceOrderId],
  })
  await client.execute({
    sql: `UPDATE orders SET status = 'closed', payment_method = 'merged', closed_at = ?, updated_at = ? WHERE id = ?`,
    args: [now, now, sourceOrderId],
  })
  return (await getOrder(targetOrderId))!
}

export async function splitOrderEqual(orderId: string, tableId: string, parts: number, openedBy?: string): Promise<Order[]> {
  const client = getClient()
  const items = await getOrderItems(orderId)
  if (items.length === 0) throw new Error('No items to split')

  const now = new Date().toISOString()
  const splitGroupId = uuid()
  const chunkSize = Math.ceil(items.length / parts)
  const newOrders: Order[] = []

  for (let i = 0; i < parts - 1; i++) {
    const chunk = items.slice(i * chunkSize, (i + 1) * chunkSize)
    if (chunk.length === 0) continue
    const newOrderId = uuid()
    await client.execute({
      sql: 'INSERT INTO orders (id, table_id, routing_mode, status, opened_by, split_group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [newOrderId, tableId, 'auto', 'open', openedBy ?? null, splitGroupId, now, now],
    })
    for (const item of chunk) {
      await client.execute({
        sql: 'UPDATE order_items SET order_id = ?, updated_at = ? WHERE id = ?',
        args: [newOrderId, now, item.id],
      })
    }
    newOrders.push((await getOrder(newOrderId))!)
  }

  await client.execute({
    sql: 'UPDATE orders SET split_group_id = ?, updated_at = ? WHERE id = ?',
    args: [splitGroupId, now, orderId],
  })

  newOrders.push((await getOrder(orderId))!)
  return newOrders
}

export async function splitOrderByItems(
  orderId: string,
  tableId: string,
  itemIds: string[],
  openedBy?: string
): Promise<{ original: Order; split: Order }> {
  const client = getClient()
  const now = new Date().toISOString()
  const newOrderId = uuid()
  const splitGroupId = uuid()

  await client.execute({
    sql: 'INSERT INTO orders (id, table_id, routing_mode, status, opened_by, split_group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [newOrderId, tableId, 'auto', 'open', openedBy ?? null, splitGroupId, now, now],
  })

  for (const itemId of itemIds) {
    await client.execute({
      sql: 'UPDATE order_items SET order_id = ?, updated_at = ? WHERE id = ? AND order_id = ?',
      args: [newOrderId, now, itemId, orderId],
    })
  }

  await client.execute({
    sql: 'UPDATE orders SET split_group_id = ?, updated_at = ? WHERE id = ?',
    args: [splitGroupId, now, orderId],
  })

  return {
    original: (await getOrder(orderId))!,
    split: (await getOrder(newOrderId))!,
  }
}

// ============================================================================
// VENUE SETTINGS
// ============================================================================

export async function getVenueSettings(): Promise<{ idle_alert_minutes: number | null }> {
  const client = getClient()
  const result = await client.execute('SELECT idle_alert_minutes FROM venues LIMIT 1')
  return { idle_alert_minutes: (result.rows[0]?.idle_alert_minutes as number) ?? null }
}

export async function updateVenueIdleAlert(minutes: number | null): Promise<void> {
  const client = getClient()
  await client.execute({
    sql: 'UPDATE venues SET idle_alert_minutes = ?',
    args: [minutes],
  })
}

// ============================================================================
// PRODUCT VARIATIONS
// ============================================================================

export async function listVariationGroups(menuItemId: string): Promise<VariationGroup[]> {
  const client = getClient()
  const groups = await client.execute({
    sql: 'SELECT * FROM item_variation_groups WHERE menu_item_id = ? ORDER BY created_at',
    args: [menuItemId],
  })
  return Promise.all(groups.rows.map(async row => {
    const opts = await client.execute({
      sql: 'SELECT * FROM item_variation_options WHERE group_id = ? ORDER BY created_at',
      args: [row.id as string],
    })
    return {
      id: row.id as string,
      menu_item_id: row.menu_item_id as string,
      name: row.name as string,
      required: row.required === 1,
      options: opts.rows.map(o => ({
        id: o.id as string,
        group_id: o.group_id as string,
        name: o.name as string,
        price_delta: o.price_delta as number,
        created_at: o.created_at as string,
      } as VariationOption)),
      created_at: row.created_at as string,
    } as VariationGroup
  }))
}

export async function createVariationGroup(
  menuItemId: string,
  name: string,
  required: boolean
): Promise<VariationGroup> {
  const client = getClient()
  const id = uuid()
  const now = new Date().toISOString()
  await client.execute({
    sql: 'INSERT INTO item_variation_groups (id, menu_item_id, name, required, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, menuItemId, name, required ? 1 : 0, now],
  })
  const groups = await listVariationGroups(menuItemId)
  return groups.find(g => g.id === id)!
}

export async function deleteVariationGroup(groupId: string): Promise<void> {
  const client = getClient()
  await client.execute({ sql: 'DELETE FROM item_variation_options WHERE group_id = ?', args: [groupId] })
  await client.execute({ sql: 'DELETE FROM item_variation_groups WHERE id = ?', args: [groupId] })
}

export async function createVariationOption(
  groupId: string,
  name: string,
  priceDelta: number
): Promise<VariationOption> {
  const client = getClient()
  const id = uuid()
  const now = new Date().toISOString()
  await client.execute({
    sql: 'INSERT INTO item_variation_options (id, group_id, name, price_delta, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, groupId, name, priceDelta, now],
  })
  const result = await client.execute({ sql: 'SELECT * FROM item_variation_options WHERE id = ?', args: [id] })
  const row = result.rows[0]!
  return {
    id: row.id as string,
    group_id: row.group_id as string,
    name: row.name as string,
    price_delta: row.price_delta as number,
    created_at: row.created_at as string,
  }
}

export async function deleteVariationOption(optionId: string): Promise<void> {
  const client = getClient()
  await client.execute({ sql: 'DELETE FROM item_variation_options WHERE id = ?', args: [optionId] })
}

export async function addOrderItemVariations(orderItemId: string, optionIds: string[]): Promise<void> {
  if (optionIds.length === 0) return
  const client = getClient()
  for (const optionId of optionIds) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO order_item_variations (order_item_id, option_id) VALUES (?, ?)',
      args: [orderItemId, optionId],
    })
  }
}

export async function listMenuItemsWithTimeFilter(currentTime: string): Promise<MenuItem[]> {
  const client = getClient()
  const result = await client.execute({
    sql: `SELECT mi.* FROM menu_items mi
          JOIN categories c ON mi.category_id = c.id
          WHERE mi.enabled = 1
            AND (
              c.active_from IS NULL OR c.active_to IS NULL
              OR (? >= c.active_from AND ? <= c.active_to)
            )
          ORDER BY mi.name`,
    args: [currentTime, currentTime],
  })
  return result.rows.map(mapMenuItem)
}

// ============================================================================
// CASHIER CLOSING
// ============================================================================

export async function getCashierClosingSummary(): Promise<CashierClosingSummary> {
  const client = getClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const from = todayStart.toISOString()
  const to = new Date().toISOString()

  const [revenue, openCount, topItems] = await Promise.all([
    client.execute({
      sql: `SELECT
              COUNT(DISTINCT o.id) as orders_closed,
              COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN oi.quantity * mi.price ELSE 0 END), 0) as cash,
              COALESCE(SUM(CASE WHEN o.payment_method = 'card' THEN oi.quantity * mi.price ELSE 0 END), 0) as card,
              COALESCE(SUM(oi.quantity * mi.price), 0) as total
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE o.status = 'closed' AND o.closed_at >= ? AND o.closed_at <= ?
              AND o.payment_method IN ('cash', 'card')`,
      args: [from, to],
    }),
    client.execute({
      sql: `SELECT COUNT(*) as count FROM orders WHERE status = 'open'`,
      args: [],
    }),
    client.execute({
      sql: `SELECT mi.name, SUM(oi.quantity) as qty, SUM(oi.quantity * mi.price) as rev
            FROM order_items oi
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            JOIN orders o ON o.id = oi.order_id
            WHERE o.status = 'closed' AND o.closed_at >= ? AND o.closed_at <= ?
            GROUP BY oi.menu_item_id ORDER BY rev DESC LIMIT 5`,
      args: [from, to],
    }),
  ])

  const rev = revenue.rows[0]!
  return {
    total_revenue: Math.round(Number(rev.total ?? 0) * 100) / 100,
    orders_closed: Number(rev.orders_closed ?? 0),
    orders_open: Number(openCount.rows[0]?.count ?? 0),
    revenue_by_payment: {
      cash: Math.round(Number(rev.cash ?? 0) * 100) / 100,
      card: Math.round(Number(rev.card ?? 0) * 100) / 100,
    },
    top_items: topItems.rows.map(r => ({
      name: r.name as string,
      quantity: Number(r.qty),
      revenue: Math.round(Number(r.rev) * 100) / 100,
    })),
  }
}

export async function createCashierClosing(closedBy: string, summary: CashierClosingSummary): Promise<void> {
  const client = getClient()
  const id = uuid()
  const now = new Date().toISOString()
  await client.execute({
    sql: 'INSERT INTO cashier_closings (id, closed_by, closed_at, summary_json) VALUES (?, ?, ?, ?)',
    args: [id, closedBy, now, JSON.stringify(summary)],
  })
}

export async function getShiftSummaryReport(from: string, to: string): Promise<ShiftSummaryReport> {
  const client = getClient()

  const [opened, closed, stillOpen, revenue] = await Promise.all([
    client.execute({
      sql: 'SELECT COUNT(*) as count FROM orders WHERE created_at >= ? AND created_at < ?',
      args: [from, to],
    }),
    client.execute({
      sql: `SELECT COUNT(*) as count FROM orders WHERE status = 'closed' AND closed_at >= ? AND closed_at < ?`,
      args: [from, to],
    }),
    client.execute({
      sql: `SELECT COUNT(*) as count FROM orders WHERE status = 'open' AND created_at >= ? AND created_at < ?`,
      args: [from, to],
    }),
    client.execute({
      sql: `SELECT
              COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN oi.quantity * mi.price ELSE 0 END), 0) as cash,
              COALESCE(SUM(CASE WHEN o.payment_method = 'card' THEN oi.quantity * mi.price ELSE 0 END), 0) as card,
              COALESCE(SUM(oi.quantity * mi.price), 0) as total
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE o.status = 'closed' AND o.closed_at >= ? AND o.closed_at < ?`,
      args: [from, to],
    }),
  ])

  const rev = revenue.rows[0]!
  return {
    period: { from, to },
    orders_opened: Number(opened.rows[0]?.count ?? 0),
    orders_closed: Number(closed.rows[0]?.count ?? 0),
    orders_still_open: Number(stillOpen.rows[0]?.count ?? 0),
    total_revenue: Math.round(Number(rev.total ?? 0) * 100) / 100,
    by_payment_method: {
      cash: Math.round(Number(rev.cash ?? 0) * 100) / 100,
      card: Math.round(Number(rev.card ?? 0) * 100) / 100,
    },
  }
}

export async function getPeakHourReport(from: string, to: string): Promise<PeakHourReport> {
  const client = getClient()

  const rows = await client.execute({
    sql: `SELECT
            CAST(strftime('%H', o.closed_at) AS INTEGER) as hour,
            COUNT(DISTINCT o.id) as orders,
            COALESCE(SUM(oi.quantity * mi.price), 0) as revenue
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE o.status = 'closed' AND o.closed_at >= ? AND o.closed_at < ?
          GROUP BY hour
          ORDER BY hour`,
    args: [from, to],
  })

  const byHour = new Map<number, { orders: number; revenue: number }>()
  for (const row of rows.rows) {
    byHour.set(Number(row.hour), {
      orders: Number(row.orders),
      revenue: Math.round(Number(row.revenue) * 100) / 100,
    })
  }

  return {
    hours: Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      orders: byHour.get(h)?.orders ?? 0,
      revenue: byHour.get(h)?.revenue ?? 0,
    })),
  }
}

export async function getCancellationRateReport(
  from: string,
  to: string
): Promise<CancellationRateReport> {
  const client = getClient()

  const rows = await client.execute({
    sql: `SELECT
            COUNT(*) as total,
            SUM(CASE WHEN payment_method = 'cancelled' THEN 1 ELSE 0 END) as cancelled
          FROM orders
          WHERE created_at >= ? AND created_at < ?`,
    args: [from, to],
  })

  const total = Number(rows.rows[0]?.total ?? 0)
  const cancelled = Number(rows.rows[0]?.cancelled ?? 0)
  return {
    total_orders: total,
    cancelled_orders: cancelled,
    cancellation_rate: total > 0 ? Math.round((cancelled / total) * 10000) / 100 : 0,
  }
}

export async function getPeriodComparison(period: 'week' | 'month'): Promise<PeriodComparison> {
  const now = new Date()
  let curFrom: string, curTo: string, prevFrom: string, prevTo: string

  if (period === 'week') {
    const today = new Date(now.toISOString().slice(0, 10))
    const cur0 = new Date(today); cur0.setDate(today.getDate() - 6)
    const prev1 = new Date(cur0); prev1.setDate(cur0.getDate() - 1)
    const prev0 = new Date(prev1); prev0.setDate(prev1.getDate() - 6)
    curFrom = cur0.toISOString().slice(0, 10)
    curTo = new Date(today.getTime() + 86400000).toISOString().slice(0, 10)
    prevFrom = prev0.toISOString().slice(0, 10)
    prevTo = cur0.toISOString().slice(0, 10)
  } else {
    const y = now.getFullYear(), m = now.getMonth()
    curFrom = `${y}-${String(m + 1).padStart(2, '0')}-01`
    curTo = new Date(y, m + 1, 1).toISOString().slice(0, 10)
    const pm = m === 0 ? 12 : m, py = m === 0 ? y - 1 : y
    prevFrom = `${py}-${String(pm).padStart(2, '0')}-01`
    prevTo = curFrom
  }

  const query = (from: string, to: string) =>
    getClient().execute({
      sql: `SELECT
              COALESCE(SUM(oi.quantity * mi.price), 0) as revenue,
              COUNT(DISTINCT o.id) as orders
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE o.status = 'closed' AND o.closed_at >= ? AND o.closed_at < ?`,
      args: [from, to],
    })

  const [cur, prev] = await Promise.all([query(curFrom, curTo), query(prevFrom, prevTo)])

  const curRev = Math.round(Number(cur.rows[0]?.revenue ?? 0) * 100) / 100
  const prevRev = Math.round(Number(prev.rows[0]?.revenue ?? 0) * 100) / 100
  const curOrd = Number(cur.rows[0]?.orders ?? 0)
  const prevOrd = Number(prev.rows[0]?.orders ?? 0)

  const pct = (cur: number, prev: number) =>
    prev === 0 ? null : Math.round(((cur - prev) / prev) * 10000) / 100

  return {
    period,
    current: { from: curFrom, to: curTo, revenue: curRev, orders: curOrd },
    previous: { from: prevFrom, to: prevTo, revenue: prevRev, orders: prevOrd },
    revenue_delta_pct: pct(curRev, prevRev),
    orders_delta_pct: pct(curOrd, prevOrd),
  }
}

export async function getNeverOrderedReport(from: string, to: string): Promise<NeverOrderedReport> {
  const client = getClient()

  const rows = await client.execute({
    sql: `SELECT mi.id as menu_item_id, mi.name, c.name as category, mi.price
          FROM menu_items mi
          JOIN categories c ON c.id = mi.category_id
          WHERE mi.enabled = 1
            AND mi.id NOT IN (
              SELECT DISTINCT oi.menu_item_id
              FROM order_items oi
              JOIN orders o ON o.id = oi.order_id
              WHERE o.status = 'closed' AND o.closed_at >= ? AND o.closed_at < ?
            )
          ORDER BY c.name, mi.name`,
    args: [from, to],
  })

  return {
    items: rows.rows.map(row => ({
      menu_item_id: row.menu_item_id as string,
      name: row.name as string,
      category: row.category as string,
      price: Number(row.price),
    })),
  }
}
