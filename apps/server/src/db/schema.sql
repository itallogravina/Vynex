-- Vynex Order Routing Schema
-- SQLite database for M1 POS system

-- Venues (locations running Vynex)
CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  idle_alert_minutes INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tables in venue
CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  name TEXT NOT NULL,
  seats INTEGER NOT NULL,
  pos_x INTEGER NOT NULL DEFAULT 0,
  pos_y INTEGER NOT NULL DEFAULT 0,
  floor INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (venue_id) REFERENCES venues(id)
);

-- Menu item categories with routing rules
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  name TEXT NOT NULL,
  routing_zone TEXT NOT NULL CHECK(routing_zone IN ('kitchen', 'bar', 'cashier', 'table')),
  active_from TEXT,
  active_to TEXT,
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
  eightysixed_at TEXT,
  prep_time_seconds INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Variation groups per menu item (e.g. "Doneness", "Size")
CREATE TABLE IF NOT EXISTS item_variation_groups (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- Options within a variation group (e.g. "Rare", "Medium", "Well Done")
CREATE TABLE IF NOT EXISTS item_variation_options (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES item_variation_groups(id) ON DELETE CASCADE
);

-- Variations selected per order item
CREATE TABLE IF NOT EXISTS order_item_variations (
  order_item_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  PRIMARY KEY (order_item_id, option_id),
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (option_id) REFERENCES item_variation_options(id)
);

-- Daily cashier closing records
CREATE TABLE IF NOT EXISTS cashier_closings (
  id TEXT PRIMARY KEY,
  closed_by TEXT NOT NULL,
  closed_at TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  FOREIGN KEY (closed_by) REFERENCES users(id)
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
  payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'cancelled', 'merged')),
  closed_at TEXT,
  opened_by TEXT,
  split_group_id TEXT,
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
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal', 'urgent', 'vip')),
  notes TEXT,
  final_price REAL,
  discount_amount REAL NOT NULL DEFAULT 0,
  promotion_id TEXT,
  combo_group_id TEXT,
  routed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

-- Promotions: time-limited discounts on items or categories
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('percentage', 'fixed')),
  value REAL NOT NULL,
  applicable_to TEXT NOT NULL CHECK(applicable_to IN ('item', 'category')),
  applicable_id TEXT NOT NULL,
  active_from TEXT,
  active_to TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Combo bundles: fixed-price bundles of items
CREATE TABLE IF NOT EXISTS combo_bundles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  bundle_price REAL NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Items within a combo bundle
CREATE TABLE IF NOT EXISTS combo_bundle_items (
  id TEXT PRIMARY KEY,
  combo_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (combo_id) REFERENCES combo_bundles(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- Staff users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  pin_hash TEXT,
  password_hash TEXT,
  role TEXT NOT NULL CHECK(role IN ('owner', 'manager', 'cashier', 'waiter', 'bartender', 'kitchen')),
  login_method TEXT NOT NULL CHECK(login_method IN ('pin', 'password', 'list')),
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Auth sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tables_venue_id ON tables(venue_id);
CREATE INDEX IF NOT EXISTS idx_categories_venue_id ON categories(venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_routed_at ON order_items(order_id, routed_at);
CREATE INDEX IF NOT EXISTS idx_menu_changes_log_row ON menu_changes_log(table_name, row_id);
