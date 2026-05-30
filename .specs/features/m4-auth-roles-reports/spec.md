# M4 — Auth, Roles & Sales Reports

**Status:** Specifying  
**Milestone goal:** Make Vynex ready for real multi-staff use — access control, order traceability, and financial visibility for owners and managers.

---

## Architecture Decisions (recorded 2026-05-29)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Session strategy | Server-side sessions in SQLite | Offline-first, auditable, clean logout, no JWT expiry edge cases |
| Login methods | PIN + Username/Password + Select from list | QR code deferred to post-v1 |
| Auth enforcement | Split — admin protected, operational auth-required | Kitchen/bar displays need auth but not admin checks |
| Reports delivery | In-app screen + CSV export | Owner can take data to spreadsheet; PDF deferred |

---

## Roles & Access Matrix

| Role | Order Taking | Queue Screens | Close Orders | Menu Mgmt | User Mgmt | Reports | Venue Config |
|------|-------------|---------------|--------------|-----------|-----------|---------|--------------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Manager** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ critical settings |
| **Cashier** | ✅ | ✅ | ✅ | ✗ | ✗ | ✅ | ✗ |
| **Waiter** | ✅ | ✗ (own orders) | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Bartender** | ✗ | Bar only | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Kitchen** | ✗ | Kitchen only | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## Data Model Changes

### New table: `users`

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','manager','cashier','waiter','bartender','kitchen')),
  login_method TEXT NOT NULL CHECK(login_method IN ('pin','password','list')),
  pin_hash TEXT,           -- bcrypt hash, nullable (only for login_method = 'pin')
  password_hash TEXT,      -- bcrypt hash, nullable (only for login_method = 'password')
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### New table: `sessions`

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,     -- random UUID (the token clients send)
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,  -- 8 hours from creation (one shift)
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Modified: `orders`

```sql
ALTER TABLE orders ADD COLUMN opened_by TEXT REFERENCES users(id);
-- nullable for backward compat with existing data
```

### Modified: `order_items`

```sql
ALTER TABLE order_items ADD COLUMN added_by TEXT REFERENCES users(id);
-- nullable for backward compat with existing data
```

---

## Requirements

### AUTH-1 — Login endpoint

`POST /login`  
**Public** (no session required).

Request body (PIN login):
```json
{ "login_method": "pin", "pin": "1234" }
```

Request body (password login):
```json
{ "login_method": "password", "username": "admin", "password": "secret" }
```

Request body (list login):
```json
{ "login_method": "list", "user_id": "uuid-..." }
```

Response on success:
```json
{
  "token": "uuid-session-token",
  "user": { "id": "...", "name": "João", "role": "waiter" },
  "expires_at": "2026-05-29T23:00:00Z"
}
```

Response on failure: `401 { "error": "Invalid credentials" }`

**PIN login behavior:** For PIN, the server iterates all PIN-enabled users and bcrypt-compares (PIN is not a username lookup — staff enter only their PIN). Conflict resolution: if two users share the same PIN, return `409 { "error": "PIN conflict — contact manager" }`.

**List login behavior:** Server returns the list of `login_method = 'list'` users via `GET /users/list-login` (public) — client renders them; user taps one, client sends `user_id`.

---

### AUTH-2 — Logout endpoint

`DELETE /logout`  
**Requires session.**  
Deletes the session row from the DB. Returns `204`.

---

### AUTH-3 — Session middleware

Fastify `preHandler` hook applied to protected routes.

1. Read `X-Session-Token` header.
2. `SELECT sessions JOIN users WHERE sessions.id = ? AND expires_at > now()`.
3. If found: attach `request.user = { id, name, role }` and continue.
4. If not found or expired: return `401 { "error": "Unauthorized" }`.

---

### AUTH-4 — Role guard

Fastify `preHandler` applied after session middleware on admin-only routes.

```
allowRoles('manager', 'owner') — blocks with 403 { "error": "Forbidden" }
```

---

### AUTH-5 — Route protection map

| Route | Protection |
|-------|-----------|
| `POST /login` | Public |
| `GET /health` | Public |
| `GET /users/list-login` | Public (returns name+id only, no hashes) |
| `DELETE /logout` | Session required |
| `GET /tables`, `GET /tables/status` | Session required |
| `POST /orders`, `GET /orders/open` | Session required |
| `POST /orders/:id/items` | Session required |
| `PATCH /orders/:id/items/:itemId` | Session required |
| `PATCH /orders/:id` (close) | Session required |
| `GET /queues/:zone` | Session required |
| `GET /menu-items`, `GET /categories` | Session required |
| `GET /ws` | Session required (token via query param `?token=`) |
| `POST /menu-items`, `PATCH /menu-items/:id`, `DELETE /menu-items/:id` | Manager/Owner |
| `POST /categories`, `DELETE /categories/:id` | Manager/Owner |
| `GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` | Manager/Owner |
| `POST /users/bulk-import` | Manager/Owner |
| `GET /reports/*` | Cashier/Manager/Owner |
| `GET /reports/export` | Cashier/Manager/Owner |
| `POST /admin/sync` | Owner only |

**WebSocket auth:** Token passed as query param `GET /ws?token=<session-token>`. Server validates on upgrade; rejects with `401` if invalid. Once connected, `request.user` is attached to the WS connection context.

---

### USER-1 — User management API

**`GET /users`** — List all users (id, name, role, login_method, enabled). No hashes returned.

**`POST /users`** — Create a user.
```json
{
  "name": "Maria",
  "role": "waiter",
  "login_method": "pin",
  "pin": "5678"           // plaintext — server hashes with bcrypt
}
```

**`PATCH /users/:id`** — Update name, role, login_method, PIN, password, or enabled flag.

**`DELETE /users/:id`** — Soft-disable or hard-delete. If user has associated orders, soft-disable only (set `enabled = 0`). If no orders, hard-delete.

**`POST /users/bulk-import`** — Accept JSON array of users (same shape as POST /users). Returns `{ created: N, errors: [...] }`.

**`GET /users/list-login`** — Public. Returns `[{ id, name }]` for all `login_method = 'list'` enabled users. Used by the "select from list" login screen.

---

### USER-2 — User management screen (desktop)

New screen: **Users** (accessible to Manager/Owner after login).

- Table of all users: name, role, login method, enabled status
- Add user button → inline form or modal
- Edit/disable/delete per row
- Bulk import: upload CSV or paste CSV text
  - CSV columns: `name,role,login_method,pin` (pin optional, auto-generated if blank for PIN users)
- Auto-generate users: "Waiter 1, Waiter 2..." form with count + role + login method

---

### TRACE-1 — Order traceability

When a session is active:
- `POST /orders` — save `opened_by = request.user.id` on the created order
- `POST /orders/:id/items` — save `added_by = request.user.id` on each created item

Existing orders and items where `opened_by / added_by = NULL` are displayed as "Unknown" in reports.

---

### REPORT-1 — Sales by period

`GET /reports/sales?from=2026-05-01&to=2026-05-31`

Response:
```json
{
  "period": { "from": "2026-05-01", "to": "2026-05-31" },
  "total_revenue": 4320.00,
  "total_orders": 47,
  "by_day": [
    { "date": "2026-05-01", "revenue": 320.00, "orders": 12 }
  ]
}
```

Grouped by: day (default), week, or month via `?group_by=day|week|month`.  
Source: closed orders within the date range (`orders.closed_at BETWEEN ? AND ?`).

---

### REPORT-2 — Top items and categories

`GET /reports/top-items?from=...&to=...&limit=10`

Response:
```json
{
  "top_items": [
    { "menu_item_id": "...", "name": "Caipirinha", "quantity_sold": 83, "revenue": 1245.00 }
  ],
  "top_categories": [
    { "category_id": "...", "name": "Drinks", "revenue": 2100.00 }
  ]
}
```

Source: `order_items JOIN menu_items JOIN orders WHERE orders.status = 'closed'`.

---

### REPORT-3 — Productivity per waiter

`GET /reports/per-waiter?from=...&to=...`

Response:
```json
{
  "waiters": [
    {
      "user_id": "...",
      "name": "Maria",
      "orders_opened": 18,
      "items_added": 72,
      "revenue": 1440.00
    }
  ]
}
```

Source: `orders.opened_by` + `order_items.added_by`. NULL entries grouped as "Unknown".

---

### REPORT-4 — Shift summary

`GET /reports/shift?from=2026-05-29T18:00:00&to=2026-05-30T02:00:00`

Response:
```json
{
  "period": { "from": "...", "to": "..." },
  "orders_opened": 24,
  "orders_closed": 22,
  "orders_still_open": 2,
  "total_revenue": 1820.00,
  "by_payment_method": {
    "cash": 980.00,
    "card": 840.00
  }
}
```

---

### REPORT-5 — CSV export

`GET /reports/export?type=sales|top-items|per-waiter|shift&from=...&to=...`

Returns `text/csv` with `Content-Disposition: attachment; filename="vynex-report-{type}-{date}.csv"`.

No external library — Node.js built-in string formatting of CSV rows.

---

### UI-1 — Login screen (desktop + mobile)

**Desktop:** Full-screen login shown before any other screen.  
- Tab selector: PIN | Password | Select from list  
- PIN tab: numpad UI (digits 0–9 + backspace), submit on 4–6 digits entered  
- Password tab: username + password text inputs  
- List tab: scrollable list of staff names, tap to log in  
- "Log in" button / auto-submit on PIN complete  
- Error message on failed attempt  

**Mobile:** Same layout adapted for touch — numpad takes full width.

---

### UI-2 — Auth context (desktop + mobile)

New `AuthContext` alongside existing `ServerUrlContext`.

```ts
type AuthContext = {
  user: { id: string; name: string; role: Role } | null
  token: string | null
  login: (token, user) => void
  logout: () => void
}
```

- Token persisted in `localStorage` (desktop) / `AsyncStorage` (mobile) across app restarts
- On app start: if stored token exists, validate with `GET /health` (or a new `GET /me` endpoint) — if expired, redirect to login
- Logout: call `DELETE /logout`, clear storage, redirect to login

---

### UI-3 — Role-based screen access (desktop)

After login, show only screens the role is allowed:

| Screen | Roles |
|--------|-------|
| Order | All |
| Kitchen | Kitchen, Manager, Owner |
| Bar | Bartender, Manager, Owner |
| Cashier | Cashier, Manager, Owner |
| Tables | Waiter, Cashier, Manager, Owner |
| Menu Management | Manager, Owner |
| Users | Manager, Owner |
| Reports | Cashier, Manager, Owner |
| Settings | Manager, Owner |

Navigation header shows logged-in user name and a logout button.

---

### UI-4 — Reports screen (desktop only)

New **Reports** screen (manager/owner/cashier).

- Date range picker (from / to)
- Tab selector: Sales | Top Items | Per Waiter | Shift
- Each tab renders its data as a table
- "Export CSV" button per tab — triggers `GET /reports/export?type=...`

---

## Out of Scope for M4

- QR code login
- PDF export
- Multi-venue reports
- Loyalty programs
- Table transfer permissions per manager
- Advanced analytics / BI

---

## Non-Functional Requirements

- bcrypt cost factor: 10 (fast enough for PIN lookup across all users, secure enough for passwords)
- Session TTL: 8 hours (one shift). Configurable via `SESSION_TTL_HOURS` env var.
- PIN uniqueness: enforced at application layer (warn on conflict, reject if PIN already in use by another enabled user)
- All new routes follow existing Fastify `registerXRoutes(app)` pattern
- Schema changes use the existing migration pattern in `db/init.ts` (try-catch ALTER TABLE)
- No new npm packages for CSV export (built-in string formatting only)
- bcrypt: use `bcryptjs` (pure JS, no native bindings — compatible with pkg bundling for Windows)
