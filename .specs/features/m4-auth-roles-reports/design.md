# M4 — Design

## Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│ packages/shared                                                  │
│  index.ts — Role, User, LoginRequest, AuthResponse, report types│
└───────────────────────────┬─────────────────────────────────────┘
                            │ (types consumed by all)
          ┌─────────────────┴──────────────────┐
          ▼                                     ▼
┌─────────────────────────┐         ┌──────────────────────────────┐
│ apps/server             │         │ apps/desktop + apps/mobile   │
│                         │         │                              │
│ db/                     │         │ context/AuthContext.tsx       │
│   schema.sql ← +users   │         │ lib/api.ts (fetch wrapper)   │
│              ← +sessions│         │ screens/LoginScreen.tsx      │
│   init.ts  ← migrations │         │ screens/UsersScreen.tsx      │
│   queries.ts ← +user/   │         │ screens/ReportsScreen.tsx    │
│               session/  │         │ App.tsx ← role-based nav     │
│               report fns│         │          + auth gate         │
│                         │         └──────────────────────────────┘
│ middleware/             │
│   session.ts            │
│   roles.ts              │
│                         │
│ routes/                 │
│   auth.ts   (new)       │
│   users.ts  (new)       │
│   reports.ts(new)       │
│   orders.ts ← +opened_by│
│                         │
│ ws/handler.ts ← token   │
│                 auth    │
│                         │
│ index.ts ← wire routes  │
└─────────────────────────┘
```

---

## Server Design

### Middleware

**`middleware/session.ts`**

```ts
// Fastify preHandler — attach request.user or return 401
export async function requireSession(request, reply) {
  const token = request.headers['x-session-token']
  if (!token) return reply.status(401).send({ error: 'Unauthorized' })
  const user = await getSessionUser(token)   // queries.ts
  if (!user) return reply.status(401).send({ error: 'Unauthorized' })
  request.user = user
}
```

**`middleware/roles.ts`**

```ts
// Returns a preHandler that checks request.user.role
export function requireRole(...roles: Role[]) {
  return async (request, reply) => {
    if (!roles.includes(request.user?.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }
}
```

Usage on protected routes:
```ts
app.post('/menu-items', {
  preHandler: [requireSession, requireRole('manager', 'owner')]
}, handler)
```

### Auth Routes (`routes/auth.ts`)

```
POST /login                     — public
DELETE /logout                  — requireSession
GET  /users/list-login          — public (returns id + name only)
```

**PIN login flow:**
1. Fetch all users where `login_method = 'pin' AND enabled = 1`
2. `bcrypt.compare(input, user.pin_hash)` for each (linear scan, acceptable at ≤30 staff)
3. PIN uniqueness enforced at registration → at most 1 match
4. If 0 matches → 401; if >1 → 409 (data integrity error, shouldn't happen)

**Password login flow:**
1. `SELECT * FROM users WHERE name = ? AND login_method = 'password' AND enabled = 1`
2. `bcrypt.compare(password, user.password_hash)`

**List login flow:**
1. `SELECT * FROM users WHERE id = ? AND login_method = 'list' AND enabled = 1`
2. No password check — trust is granted by physical presence on device

**Session creation** (all methods on success):
```ts
const token = uuid()
await createSession(token, user.id, SESSION_TTL_HOURS)
return { token, user: { id, name, role }, expires_at }
```

### DB Schema additions

**New tables** added to `schema.sql`:
```sql
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

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
```

**Migrations** in `init.ts` (try-catch ALTER TABLE pattern, same as M1/M2):
```ts
// Add opened_by to orders
await db.execute(`ALTER TABLE orders ADD COLUMN opened_by TEXT REFERENCES users(id)`)
// Add added_by to order_items
await db.execute(`ALTER TABLE order_items ADD COLUMN added_by TEXT REFERENCES users(id)`)
```

### WebSocket auth

Token passed as query param: `GET /ws?zones=kitchen&token=<session-token>`

In `ws/handler.ts`, before accepting the connection:
```ts
const token = request.query.token
if (!token) return reply.status(401).send({ error: 'Unauthorized' })
const user = await getSessionUser(token)
if (!user) return reply.status(401).send({ error: 'Unauthorized' })
// store user on the WS client context for future broadcasts
```

### Reports queries

All queries operate on `orders WHERE status = 'closed'` within a date range using `closed_at`.

```ts
// REPORT-1: revenue by period
getSalesReport(from, to, groupBy: 'day'|'week'|'month')
// → GROUP BY strftime('%Y-%m-%d', closed_at)

// REPORT-2: top items and categories  
getTopItemsReport(from, to, limit)
// → JOIN order_items ON orders, GROUP BY menu_item_id, SUM(quantity * price)

// REPORT-3: productivity per waiter
getPerWaiterReport(from, to)
// → GROUP BY orders.opened_by, COUNT(orders), SUM(revenue)

// REPORT-4: shift summary
getShiftSummaryReport(from, to)
// → COUNT open/closed, SUM revenue, GROUP BY payment_method
```

CSV export: route handler builds CSV string from the same query result (no library needed — just `join(',')` rows with `\n`).

---

## Desktop Design

### AuthContext

```ts
type AuthState = {
  user: { id: string; name: string; role: Role } | null
  token: string | null
}

// Stored in localStorage under 'vynex_auth'
// On app start: load from storage → validate against server (GET /me or /health with token)
// If expired/invalid: clear storage, show login screen
```

### api.ts — fetch wrapper

Thin wrapper around `fetch` that injects `X-Session-Token` from AuthContext. Replaces direct `fetch(...)` calls in hooks/screens.

```ts
export function useApi() {
  const { token } = useAuth()
  const { serverUrl } = useServerUrl()
  return {
    get: (path) => fetch(`${serverUrl}${path}`, { headers: token ? { 'X-Session-Token': token } : {} }),
    post: (path, body) => fetch(...),
    patch: (path, body) => fetch(...),
    delete: (path) => fetch(...),
  }
}
```

> Note: existing hooks (useOrder, useQueue, etc.) will be updated to use `useApi()` instead of calling `fetch` directly. This is a mechanical find-and-replace — all hooks follow the same `fetch(${serverUrl}/...)` pattern.

### LoginScreen

Three tabs rendered as simple button-row selector:

```
┌──────────────────────────────────────┐
│  Vynex                               │
│                                      │
│  [ PIN ]  [ Password ]  [ List ]     │
│                                      │
│  PIN tab:                            │
│  ┌──────────────┐                    │
│  │  _ _ _ _     │  display           │
│  └──────────────┘                    │
│  [ 1 ][ 2 ][ 3 ]                     │
│  [ 4 ][ 5 ][ 6 ]                     │
│  [ 7 ][ 8 ][ 9 ]                     │
│  [←  ][ 0 ][ → Enter ]              │
│                                      │
│  Password tab:                       │
│  Username: [_____________]           │
│  Password: [_____________]           │
│  [ Log in ]                          │
│                                      │
│  List tab:                           │
│  ○ Maria — Waiter                    │
│  ○ João  — Bartender                 │
│  [ Log in ]                          │
└──────────────────────────────────────┘
```

Auto-submit on PIN when 4–6 digits entered (configurable: min length hardcoded at 4 for now).

### App.tsx changes

```ts
export default function App() {
  return (
    <ErrorBoundary>
      <ServerUrlProvider>
        <AuthProvider>           // new
          <AppGate />            // new — shows Login or AppShell
        </AuthProvider>
      </ServerUrlProvider>
    </ErrorBoundary>
  )
}

function AppGate() {
  const { user } = useAuth()
  return user ? <AppShell /> : <LoginScreen />
}
```

NAV filtered by role — `SCREEN_ACCESS` map per spec UI-3. Nav header shows `user.name` + Logout button.

### UsersScreen

Table with columns: Name | Role | Login Method | Status | Actions (Edit / Disable)

Add user form (inline panel, not modal): name, role, login method selector, PIN/password field.

Bulk import: textarea for CSV paste + "Import" button.

Auto-generate: count input + role selector → creates "Waiter 1, Waiter 2..." with auto-assigned PINs.

### ReportsScreen

```
┌───────────────────────────────────────┐
│ Reports                               │
│                                       │
│ From: [2026-05-01] To: [2026-05-31]   │
│                                       │
│ [Sales] [Top Items] [Per Waiter] [Shift] │
│                              [Export CSV ↓] │
│                                       │
│ (table of results)                    │
└───────────────────────────────────────┘
```

Each tab makes a `GET /reports/{type}?from=&to=` call on mount and on date range change.

---

## Mobile Design

Mobile scope is intentionally narrow — waiters and kitchen/bar staff.

- **Login methods shown:** PIN + Select from list (password login is desktop-only for M4)
- **No UsersScreen / ReportsScreen** on mobile — these are manager tools on desktop
- `AsyncStorage` replaces `localStorage` for token persistence
- Token appended to WS URL: `ws://server/ws?zones=kitchen&token=...`

---

## Implementation Waves

```
Wave 1 — Server foundation
  T01  Install bcryptjs
  T02  DB schema (users + sessions tables in schema.sql)
  T03  DB migrations (init.ts: ALTER TABLE + CREATE TABLE in migration block)
  T04  Shared types (Role, User, LoginRequest, AuthResponse, report types)
  T05  User + session query functions (queries.ts)

Wave 2 — Server auth layer                  [T01,T03,T04,T05 done]
  T06  Session middleware (middleware/session.ts)
  T07  Role guard middleware (middleware/roles.ts)
  T08  Auth routes (routes/auth.ts: login, logout, list-login)
  T09  User management routes (routes/users.ts: CRUD + bulk import)

Wave 3 — Server traceability + WS auth      [T06,T07 done]
  T10  Update orders routes (opened_by/added_by on create)
  T11  Update WS handler (token query param validation)

Wave 4 — Server reports                     [T06,T07 done]
  T12  Report query functions (queries.ts)
  T13  Report routes (routes/reports.ts: 4 types + CSV export)

Wave 5 — Wire server                        [T08,T09,T10,T11,T13 done]
  T14  Update index.ts (register auth, users, reports routes + /admin/sync role guard)

Wave 6 — Desktop auth                       [T04 done]
  T15  AuthContext (desktop)
  T16  api.ts fetch wrapper + update all existing hooks to use it
  T17  LoginScreen (desktop)
  T18  Update App.tsx (AuthGate + role-based NAV + logout)

Wave 7 — Desktop feature screens            [T15,T16,T18 done]
  T19  UsersScreen (desktop)
  T20  ReportsScreen (desktop)

Wave 8 — Mobile auth                        [T04 done]
  T21  Mobile AuthContext (AsyncStorage)
  T22  Mobile LoginScreen (PIN + list tabs)
  T23  Update mobile App.tsx (AuthGate)
```

**Critical path:** T01 → T02 → T03 → T05 → T06 → T08 → T14 → T15 → T17 → T18

Waves 3 and 4 are independent of each other — can be done in either order after Wave 2.
Waves 6 and 8 can start in parallel once T04 (shared types) is done.
