import { createClient, Client } from '@libsql/client'
import { readFileSync } from 'fs'
import { join } from 'path'
import bcrypt from 'bcryptjs'

const { v4: uuid } = require('uuid')

let client: Client | null = null

export async function initializeDatabase(dbPath: string = './vynex.db'): Promise<Client> {
  if (client) return client

  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN

  if (tursoUrl && tursoToken) {
    client = createClient({
      url: `file:${dbPath}`,
      syncUrl: tursoUrl,
      authToken: tursoToken,
    })
    // Pull latest from cloud before serving requests
    await client.sync()
    console.log('[db] embedded replica mode — synced with Turso')
  } else {
    client = createClient({ url: `file:${dbPath}` })
    console.log('[db] local-only mode')
  }

  const schemaPath = join(__dirname, 'schema.sql')
  const schema = readFileSync(schemaPath, 'utf-8')
  await client.executeMultiple(schema)

  // Migrations for existing databases
  await runMigrations()

  // Seed default venue if empty
  const venueResult = await client.execute('SELECT COUNT(*) as count FROM venues')
  const venueCount = Number(venueResult.rows[0]?.count ?? 0)

  if (venueCount === 0) {
    await seedDefaultVenue()
  }

  // Seed default admin user if no users exist
  const userResult = await client.execute('SELECT COUNT(*) as count FROM users')
  const userCount = Number(userResult.rows[0]?.count ?? 0)

  if (userCount === 0) {
    await seedDefaultAdmin()
  }

  return client
}

async function runMigrations(): Promise<void> {
  try {
    await client!.execute(
      "ALTER TABLE menu_items ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
    )
    console.log('[db] migration: added updated_at to menu_items')
  } catch {
    // column already exists — expected on fresh or already-migrated databases
  }

  // Add payment_method and closed_at to orders if missing (pre-M1 databases)
  try {
    const result = await client!.execute({
      sql: `SELECT name FROM pragma_table_info('orders') WHERE name IN ('payment_method', 'closed_at')`,
      args: [],
    })
    const existingCols = new Set(result.rows.map(r => r.name as string))

    if (!existingCols.has('payment_method')) {
      await client!.execute(
        "ALTER TABLE orders ADD COLUMN payment_method TEXT CHECK(payment_method IN ('cash', 'card'))"
      )
    }
    if (!existingCols.has('closed_at')) {
      await client!.execute('ALTER TABLE orders ADD COLUMN closed_at TEXT')
    }
  } catch {
    // Columns may already exist; safe to ignore
  }

  // Widen orders.payment_method CHECK to include 'cancelled' (M5 force-delete)
  try {
    const masterRow = await client!.execute({
      sql: `SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'`,
      args: [],
    })
    const ddl = (masterRow.rows[0]?.sql as string) ?? ''
    if (!ddl.includes('cancelled')) {
      await client!.execute('PRAGMA foreign_keys = OFF')
      await client!.execute(`
        CREATE TABLE IF NOT EXISTS orders_new (
          id TEXT PRIMARY KEY,
          table_id TEXT NOT NULL,
          routing_mode TEXT NOT NULL CHECK(routing_mode IN ('manual', 'auto')),
          status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
          payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'cancelled')),
          closed_at TEXT,
          opened_by TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (table_id) REFERENCES tables(id)
        )
      `)
      await client!.execute(
        `INSERT INTO orders_new SELECT id, table_id, routing_mode, status, payment_method,
           closed_at, opened_by, created_at, updated_at FROM orders`
      )
      await client!.execute('DROP TABLE orders')
      await client!.execute('ALTER TABLE orders_new RENAME TO orders')
      await client!.execute('CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id)')
      await client!.execute('PRAGMA foreign_keys = ON')
      console.log('[db] migration: orders.payment_method CHECK widened to include cancelled')
    }
  } catch (e) {
    console.error('[db] migration failed (orders CHECK):', e)
  }

  // Add opened_by/added_by traceability columns (M4)
  try {
    const ordCols = await client!.execute({ sql: `SELECT name FROM pragma_table_info('orders')`, args: [] })
    const ordColNames = new Set(ordCols.rows.map(r => r.name as string))
    if (!ordColNames.has('opened_by')) {
      await client!.execute('ALTER TABLE orders ADD COLUMN opened_by TEXT')
    }
  } catch { /* already exists */ }

  try {
    const itmCols = await client!.execute({ sql: `SELECT name FROM pragma_table_info('order_items')`, args: [] })
    const itmColNames = new Set(itmCols.rows.map(r => r.name as string))
    if (!itmColNames.has('added_by')) {
      await client!.execute('ALTER TABLE order_items ADD COLUMN added_by TEXT')
    }
  } catch { /* already exists */ }

  // Add eightysixed_at to menu_items (M5 86'd items)
  try {
    const miCols = await client!.execute({ sql: `SELECT name FROM pragma_table_info('menu_items')`, args: [] })
    const miColNames = new Set(miCols.rows.map(r => r.name as string))
    if (!miColNames.has('eightysixed_at')) {
      await client!.execute('ALTER TABLE menu_items ADD COLUMN eightysixed_at TEXT')
    }
  } catch { /* already exists */ }

  // Add priority to order_items (M5 priority levels)
  try {
    const oiCols = await client!.execute({ sql: `SELECT name FROM pragma_table_info('order_items')`, args: [] })
    const oiColNames = new Set(oiCols.rows.map(r => r.name as string))
    if (!oiColNames.has('priority')) {
      await client!.execute("ALTER TABLE order_items ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'")
    }
  } catch { /* already exists */ }

  // Add prep_time_seconds to menu_items (M5 prep time alerts)
  try {
    const miCols2 = await client!.execute({ sql: `SELECT name FROM pragma_table_info('menu_items')`, args: [] })
    const miColNames2 = new Set(miCols2.rows.map(r => r.name as string))
    if (!miColNames2.has('prep_time_seconds')) {
      await client!.execute('ALTER TABLE menu_items ADD COLUMN prep_time_seconds INTEGER')
    }
  } catch { /* already exists */ }
}

async function seedDefaultVenue(): Promise<void> {
  const venueId = uuid()
  await client!.execute({ sql: 'INSERT INTO venues (id, name) VALUES (?, ?)', args: [venueId, 'Demo Venue'] })

  for (let i = 1; i <= 6; i++) {
    await client!.execute({
      sql: 'INSERT INTO tables (id, venue_id, name, seats) VALUES (?, ?, ?, ?)',
      args: [uuid(), venueId, `Table ${i}`, 4],
    })
  }

  const kitchenCatId = uuid()
  const barCatId = uuid()
  await client!.execute({
    sql: 'INSERT INTO categories (id, venue_id, name, routing_zone) VALUES (?, ?, ?, ?)',
    args: [kitchenCatId, venueId, 'Kitchen', 'kitchen'],
  })
  await client!.execute({
    sql: 'INSERT INTO categories (id, venue_id, name, routing_zone) VALUES (?, ?, ?, ?)',
    args: [barCatId, venueId, 'Bar', 'bar'],
  })

  const now = new Date().toISOString()
  for (const name of ['Burger', 'Pasta', 'Salad']) {
    await client!.execute({
      sql: 'INSERT INTO menu_items (id, category_id, name, price, routing_zone, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [uuid(), kitchenCatId, name, 12.99, 'kitchen', 1, now, now],
    })
  }
  for (const name of ['Beer', 'Wine', 'Cocktail']) {
    await client!.execute({
      sql: 'INSERT INTO menu_items (id, category_id, name, price, routing_zone, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [uuid(), barCatId, name, 8.99, 'bar', 1, now, now],
    })
  }
}

async function seedDefaultAdmin(): Promise<void> {
  const passwordHash = await bcrypt.hash('admin', 10)
  await client!.execute({
    sql: `INSERT INTO users (id, name, username, pin_hash, password_hash, role, login_method, enabled, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    args: [uuid(), 'Admin', 'admin', null, passwordHash, 'owner', 'password',
           new Date().toISOString(), new Date().toISOString()],
  })
  console.warn('[SECURITY] Default admin user created — change the password immediately')
}

export function getClient(): Client {
  if (!client) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return client
}

export function isReplicaMode(): boolean {
  return !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN)
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    client.close()
    client = null
  }
}
