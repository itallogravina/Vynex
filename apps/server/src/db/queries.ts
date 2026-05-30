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
  QueueItem,
  OpenOrder,
  OrderRoutingMode,
  ItemStatus,
  RoutingZone,
  User,
  Role,
  LoginMethod,
  SalesReport,
  TopItemsReport,
  PerWaiterReport,
  ShiftSummaryReport,
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
    `SELECT o.*, t.name as table_name
     FROM orders o
     JOIN tables t ON o.table_id = t.id
     WHERE o.status = 'open'
     ORDER BY o.created_at DESC`
  )

  return Promise.all(
    result.rows.map(async row => {
      const items = await getOrderItems(row.id as string)
      const total = items.reduce((sum, item) => sum + item.quantity * item.menu_item.price, 0)
      return {
        id: row.id as string,
        table_id: row.table_id as string,
        table_name: row.table_name as string,
        routing_mode: row.routing_mode as OrderRoutingMode,
        status: 'open' as const,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        items,
        total,
      }
    })
  )
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
  addedBy?: string
): Promise<OrderItem> {
  const client = getClient()
  const id = uuid()
  const now = new Date().toISOString()

  await client.execute({
    sql: 'INSERT INTO order_items (id, order_id, menu_item_id, quantity, status, notes, added_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, orderId, menuItemId, quantity, 'pending', notes ?? null, addedBy ?? null, now, now],
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
    sql: `SELECT oi.*, mi.id as mi_id, mi.category_id, mi.name as mi_name, mi.price, mi.routing_zone, mi.enabled, mi.created_at as mi_created_at, mi.updated_at as mi_updated_at
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
            oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.status, oi.notes,
            oi.created_at as oi_created_at, oi.updated_at as oi_updated_at,
            mi.id as mi_id, mi.category_id, mi.name as mi_name, mi.price, mi.routing_zone, mi.enabled,
            mi.created_at as mi_created_at, mi.updated_at as mi_updated_at,
            o.id as o_id, o.table_id, o.routing_mode, o.status as o_status,
            o.payment_method, o.closed_at,
            o.created_at as o_created_at, o.updated_at as o_updated_at,
            t.name as table_name
          FROM order_items oi
          JOIN menu_items mi ON oi.menu_item_id = mi.id
          JOIN orders o ON oi.order_id = o.id
          JOIN tables t ON o.table_id = t.id
          WHERE mi.routing_zone = ? AND o.status = 'open'
          ORDER BY oi.status, oi.created_at`,
    args: [routingZone],
  })

  return result.rows.map(row => {
    const queueItem: QueueItem = {
      id: row.id as string,
      order_id: row.order_id as string,
      menu_item_id: row.menu_item_id as string,
      quantity: row.quantity as number,
      status: row.status as ItemStatus,
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

export async function deleteMenuItem(itemId: string): Promise<void> {
  const client = getClient()
  await logMenuChange('menu_items', itemId, 'delete', null)
  await client.execute({ sql: 'DELETE FROM menu_items WHERE id = ?', args: [itemId] })
}

function mapMenuItem(row: Record<string, unknown>): MenuItem {
  return {
    id: row.id as string,
    category_id: row.category_id as string,
    name: row.name as string,
    price: row.price as number,
    routing_zone: row.routing_zone as RoutingZone,
    enabled: row.enabled === 1 || row.enabled === true,
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
    created_at: row.mi_created_at as string,
    updated_at: (row.mi_updated_at as string) || '',
  }
}

// ============================================================================
// CATEGORY QUERIES
// ============================================================================

export async function listCategories(): Promise<Category[]> {
  const client = getClient()
  const result = await client.execute('SELECT * FROM categories ORDER BY name')
  return result.rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    routing_zone: row.routing_zone as RoutingZone,
    created_at: row.created_at as string,
  }))
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
  return {
    id: row.id as string,
    name: row.name as string,
    routing_zone: row.routing_zone as RoutingZone,
    created_at: row.created_at as string,
  }
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
  const result = await client.execute('SELECT id, name, seats, created_at FROM tables ORDER BY name')
  return result.rows.map(mapTable)
}

export async function listTablesWithStatus(): Promise<TableWithStatus[]> {
  const client = getClient()
  const result = await client.execute(
    `SELECT t.id, t.name, t.seats, t.created_at,
            CASE WHEN o.id IS NOT NULL THEN 'occupied' ELSE 'free' END as status,
            o.id as order_id
     FROM tables t
     LEFT JOIN orders o ON o.table_id = t.id AND o.status = 'open'
     ORDER BY t.name`
  )

  return result.rows.map(row => ({
    ...mapTable(row),
    status: row.status as 'free' | 'occupied',
    order_id: (row.order_id as string) ?? undefined,
  }))
}

export async function getTable(tableId: string): Promise<Table | null> {
  const client = getClient()
  const result = await client.execute({
    sql: 'SELECT id, name, seats, created_at FROM tables WHERE id = ?',
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

export async function updateTable(tableId: string, name: string, seats: number): Promise<Table> {
  const client = getClient()
  await client.execute({
    sql: 'UPDATE tables SET name = ?, seats = ? WHERE id = ?',
    args: [name, seats, tableId],
  })
  return (await getTable(tableId))!
}

export async function deleteTable(tableId: string): Promise<{ ok: boolean; error?: string }> {
  const client = getClient()
  const result = await client.execute({
    sql: "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status = 'open'",
    args: [tableId],
  })
  const count = Number(result.rows[0]?.count ?? 0)

  if (count > 0) {
    return { ok: false, error: 'Table has an open order — close it before deleting' }
  }

  await client.execute({ sql: 'DELETE FROM tables WHERE id = ?', args: [tableId] })
  return { ok: true }
}

function mapTable(row: Record<string, unknown>): Table {
  return {
    id: row.id as string,
    name: row.name as string,
    seats: row.seats as number,
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
