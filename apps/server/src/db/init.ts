import { createClient, Client } from '@libsql/client'
import { readFileSync } from 'fs'
import { join } from 'path'

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
