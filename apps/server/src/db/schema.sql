-- Vynex Order Routing Schema
-- SQLite database for M1 POS system

-- Venues (locations running Vynex)
CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tables in venue
CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  name TEXT NOT NULL,
  seats INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (venue_id) REFERENCES venues(id)
);

-- Menu item categories with routing rules
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  name TEXT NOT NULL,
  routing_zone TEXT NOT NULL CHECK(routing_zone IN ('kitchen', 'bar', 'cashier', 'table')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (venue_id) REFERENCES venues(id)
);

-- Menu items
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  routing_zone TEXT NOT NULL CHECK(routing_zone IN ('kitchen', 'bar', 'cashier', 'table')),
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Audit log for menu and category changes (used for manual conflict detection)
CREATE TABLE IF NOT EXISTS menu_changes_log (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('insert', 'update', 'delete')),
  changed_fields TEXT,
  source TEXT NOT NULL DEFAULT 'local',
  changed_at TEXT NOT NULL
);

-- Orders (customer orders at a table)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL,
  routing_mode TEXT NOT NULL CHECK(routing_mode IN ('manual', 'auto')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  payment_method TEXT CHECK(payment_method IN ('cash', 'card')),
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES tables(id)
);

-- Order items (individual items in an order)
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'preparing', 'ready', 'served', 'billed')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

-- Staff users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','manager','cashier','waiter','bartender','kitchen')),
  login_method TEXT NOT NULL CHECK(login_method IN ('pin','password','list')),
  pin_hash TEXT,
  password_hash TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Auth sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Venue-level key-value settings (locale, etc.)
CREATE TABLE IF NOT EXISTS venue_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tables_venue_id ON tables(venue_id);
CREATE INDEX IF NOT EXISTS idx_categories_venue_id ON categories(venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_changes_log_row ON menu_changes_log(table_name, row_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
