import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'

const { v4: uuid } = require('uuid')

let db: Database.Database | null = null

export function initializeDatabase(dbPath: string = './vynex.db'): Database.Database {
  if (db) return db

  db = new Database(dbPath)

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Load and execute schema
  const schemaPath = join(__dirname, 'schema.sql')
  const schema = readFileSync(schemaPath, 'utf-8')
  db.exec(schema)

  // Seed default venue if empty
  const venueCount = db!.prepare('SELECT COUNT(*) as count FROM venues').get() as { count: number }
  if (venueCount.count === 0) {
    const venueId = uuid()
    db!.prepare('INSERT INTO venues (id, name) VALUES (?, ?)').run(venueId, 'Demo Venue')

    // Seed tables
    for (let i = 1; i <= 6; i++) {
      db!.prepare('INSERT INTO tables (id, venue_id, name, seats) VALUES (?, ?, ?, ?)')
        .run(uuid(), venueId, `Table ${i}`, 4)
    }

    // Seed categories
    const kitchenCatId = uuid()
    const barCatId = uuid()
    db!.prepare('INSERT INTO categories (id, venue_id, name, routing_zone) VALUES (?, ?, ?, ?)')
      .run(kitchenCatId, venueId, 'Kitchen', 'kitchen')
    db!.prepare('INSERT INTO categories (id, venue_id, name, routing_zone) VALUES (?, ?, ?, ?)')
      .run(barCatId, venueId, 'Bar', 'bar')

    // Seed menu items
    const kitchenItems = ['Burger', 'Pasta', 'Salad']
    kitchenItems.forEach(item => {
      db!.prepare(
        'INSERT INTO menu_items (id, category_id, name, price, routing_zone, enabled) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuid(), kitchenCatId, item, 12.99, 'kitchen', 1)
    })

    const barItems = ['Beer', 'Wine', 'Cocktail']
    barItems.forEach(item => {
      db!.prepare(
        'INSERT INTO menu_items (id, category_id, name, price, routing_zone, enabled) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuid(), barCatId, item, 8.99, 'bar', 1)
    })
  }

  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
