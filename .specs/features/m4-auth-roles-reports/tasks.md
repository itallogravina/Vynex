# M4 — Tasks

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Wave 1 — Server Foundation

### T01 — Install bcryptjs

- **What:** `pnpm add bcryptjs` and `pnpm add -D @types/bcryptjs` in `apps/server`
- **Where:** `apps/server/package.json`
- **Done when:** `import bcrypt from 'bcryptjs'` compiles without errors in server TS

**Status:** `[x]`

---

### T02 — DB schema: users + sessions tables

- **What:** Append `users` and `sessions` table definitions to `schema.sql`
- **Where:** `apps/server/src/db/schema.sql`
- **Spec refs:** AUTH-1, USER-1
- **Done when:** `schema.sql` contains `CREATE TABLE IF NOT EXISTS users` and `CREATE TABLE IF NOT EXISTS sessions` with all columns from the spec, plus index on `sessions(user_id)`

**Status:** `[x]`

---

### T03 — DB migrations: ALTER TABLE orders + order_items

- **What:** Add a migration block in `init.ts` that runs ALTER TABLE to add `opened_by` and `added_by` columns, and CREATE TABLE for `users` and `sessions` if the schema.sql CREATE IF NOT EXISTS didn't already handle it
- **Where:** `apps/server/src/db/init.ts`
- **Reuses:** Existing try-catch migration pattern already in `init.ts`
- **Spec refs:** TRACE-1
- **Done when:** Running the server against a fresh DB creates all 4 new columns/tables. Running against an existing DB adds only the missing columns without error.

**Status:** `[x]`

---

### T04 — Shared types

- **What:** Add to `packages/shared/src/index.ts`:
  - `Role` union (`'owner' | 'manager' | 'cashier' | 'waiter' | 'bartender' | 'kitchen'`)
  - `LoginMethod` union (`'pin' | 'password' | 'list'`)
  - `User` type (`id, name, role, login_method, enabled`)
  - `LoginRequest` discriminated union (pin / password / list variants)
  - `AuthResponse` (`token, user, expires_at`)
  - `SalesReport`, `TopItemsReport`, `PerWaiterReport`, `ShiftSummaryReport` response types
- **Where:** `packages/shared/src/index.ts`
- **Done when:** Types are exported and both `apps/server` and `apps/desktop` can import them without TS errors

**Status:** `[x]`

---

### T05 — User + session query functions

- **What:** Add to `apps/server/src/db/queries.ts`:
  - `createUser(name, role, loginMethod, pinHash?, passwordHash?)` → `User`
  - `listUsers()` → `User[]` (no hashes)
  - `getUser(id)` → `User | null`
  - `getUserByName(name)` → `User & { password_hash }` (for password login)
  - `getAllPinUsers()` → `(User & { pin_hash })[]` (for PIN login linear scan)
  - `getListLoginUsers()` → `{ id, name }[]` (public endpoint)
  - `updateUser(id, fields)` → `User`
  - `disableUser(id)` → void
  - `deleteUser(id)` → void
  - `userHasOrders(id)` → `boolean` (to decide soft vs hard delete)
  - `createSession(token, userId, ttlHours)` → void
  - `getSessionUser(token)` → `User | null` (validates expiry, joins users)
  - `deleteSession(token)` → void
  - `deleteExpiredSessions()` → void (cleanup utility)
- **Where:** `apps/server/src/db/queries.ts`
- **Depends on:** T01 (bcryptjs), T02 (schema), T04 (types)
- **Done when:** All functions compile and return correct TypeScript types

**Status:** `[x]`

---

## Wave 2 — Server Auth Layer

### T06 — Session middleware

- **What:** Create `apps/server/src/middleware/session.ts` exporting `requireSession` Fastify preHandler
- **Where:** `apps/server/src/middleware/session.ts` (new file)
- **Depends on:** T05
- **Spec refs:** AUTH-3
- **Done when:** Calling any route decorated with `requireSession` returns 401 when no/invalid token is sent, and attaches `request.user` when valid

**Status:** `[x]`

---

### T07 — Role guard middleware

- **What:** Create `apps/server/src/middleware/roles.ts` exporting `requireRole(...roles)` factory
- **Where:** `apps/server/src/middleware/roles.ts` (new file)
- **Depends on:** T06 (reads `request.user` set by session middleware)
- **Spec refs:** AUTH-4
- **Done when:** Route decorated with `requireRole('manager','owner')` returns 403 for a cashier session and 200 for a manager session

**Status:** `[x]`

---

### T08 — Auth routes

- **What:** Create `apps/server/src/routes/auth.ts` with:
  - `POST /login` — handles pin / password / list variants, creates session, returns token + user
  - `DELETE /logout` — deletes session, returns 204
  - `GET /users/list-login` — returns `{ id, name }[]` for list-method users (public)
- **Where:** `apps/server/src/routes/auth.ts` (new file)
- **Depends on:** T05, T06, T07
- **Spec refs:** AUTH-1, AUTH-2
- **Done when:**
  - POST /login with valid PIN returns `{ token, user, expires_at }`
  - POST /login with wrong PIN returns 401
  - DELETE /logout with valid token returns 204 and invalidates session
  - GET /users/list-login returns user list with no hashes

**Status:** `[x]`

---

### T09 — User management routes

- **What:** Create `apps/server/src/routes/users.ts` with:
  - `GET /users` — list all users (no hashes), protected: Manager/Owner
  - `POST /users` — create user, hash PIN or password, protected: Manager/Owner
  - `PATCH /users/:id` — update fields, re-hash if PIN/password changes, protected: Manager/Owner
  - `DELETE /users/:id` — soft-disable if has orders, hard-delete otherwise, protected: Manager/Owner
  - `POST /users/bulk-import` — accept JSON array, create each, return `{ created, errors }`, protected: Manager/Owner
- **Where:** `apps/server/src/routes/users.ts` (new file)
- **Depends on:** T05, T06, T07
- **Spec refs:** USER-1
- **Done when:** Full CRUD works via curl. Bulk import with 3 users returns `{ created: 3, errors: [] }`. Cashier token gets 403 on all these routes.

**Status:** `[x]`

---

## Wave 3 — Traceability + WS Auth

### T10 — Order routes: capture opened_by / added_by

- **What:** Update `apps/server/src/routes/orders.ts`:
  - `POST /orders` → add `requireSession` preHandler, pass `request.user.id` as `opened_by` to `createOrder`
  - `POST /orders/:id/items` → add `requireSession` preHandler, pass `request.user.id` as `added_by` to `addOrderItem`
  - Update `createOrder` and `addOrderItem` in `queries.ts` to accept and store these optional fields
  - All other order routes: add `requireSession` preHandler
- **Where:** `apps/server/src/routes/orders.ts`, `apps/server/src/db/queries.ts`
- **Depends on:** T06
- **Spec refs:** TRACE-1, AUTH-5
- **Done when:** A closed order's `opened_by` is non-null when created with a valid session

**Status:** `[x]`

---

### T11 — WebSocket session auth

- **What:** Update `apps/server/src/ws/handler.ts` to read `request.query.token`, call `getSessionUser(token)`, reject with 401 if invalid
- **Where:** `apps/server/src/ws/handler.ts`
- **Depends on:** T05
- **Spec refs:** AUTH-5
- **Done when:** WS connection with valid token succeeds; connection without token returns 401

**Status:** `[x]`

---

## Wave 4 — Server Reports

### T12 — Report query functions

- **What:** Add to `apps/server/src/db/queries.ts`:
  - `getSalesReport(from, to, groupBy)` — revenue + orders per day/week/month
  - `getTopItemsReport(from, to, limit)` — top items + categories by revenue
  - `getPerWaiterReport(from, to)` — orders opened + items added + revenue per user
  - `getShiftSummaryReport(from, to)` — open/closed counts, revenue, by payment method
- **Where:** `apps/server/src/db/queries.ts`
- **Depends on:** T02 (schema has opened_by), T04 (report types)
- **Spec refs:** REPORT-1 through REPORT-4
- **Done when:** Each function returns data matching the spec response shape, tested with sample data (a few orders in DB)

**Status:** `[x]`

---

### T13 — Report routes

- **What:** Create `apps/server/src/routes/reports.ts`:
  - `GET /reports/sales?from=&to=&group_by=` — protected: Cashier/Manager/Owner
  - `GET /reports/top-items?from=&to=&limit=` — protected: Cashier/Manager/Owner
  - `GET /reports/per-waiter?from=&to=` — protected: Cashier/Manager/Owner
  - `GET /reports/shift?from=&to=` — protected: Cashier/Manager/Owner
  - `GET /reports/export?type=&from=&to=` — returns text/csv, protected: Cashier/Manager/Owner
- **Where:** `apps/server/src/routes/reports.ts` (new file)
- **Depends on:** T06, T07, T12
- **Spec refs:** REPORT-1 through REPORT-5
- **Done when:** Each route returns correct JSON. `/reports/export` returns `text/csv` with correct `Content-Disposition` header.

**Status:** `[x]`

---

## Wave 5 — Wire Server

### T14 — Wire all new routes in index.ts

- **What:** Update `apps/server/src/index.ts`:
  - Import and call `registerAuthRoutes`, `registerUserRoutes`, `registerReportRoutes`
  - Add `requireSession + requireRole('owner')` to `POST /admin/sync`
  - Declare `request.user` on `FastifyRequest` interface (module augmentation) so TypeScript knows about it
- **Where:** `apps/server/src/index.ts`
- **Depends on:** T08, T09, T10, T11, T13
- **Done when:** Server starts and all routes are reachable. `tsc --noEmit` passes.

**Status:** `[x]`

---

## Wave 6 — Desktop Auth

### T15 — AuthContext (desktop)

- **What:** Create `apps/desktop/src/context/AuthContext.tsx` following the `ServerUrlContext` pattern:
  - Stores `{ user, token }` in `localStorage` under `'vynex_auth'`
  - On mount: if stored token exists, validates it via `GET /health` with token header; clears if 401
  - Provides `login(token, user)`, `logout()` (calls DELETE /logout, clears storage)
  - Exports `useAuth()` hook
- **Where:** `apps/desktop/src/context/AuthContext.tsx` (new file)
- **Depends on:** T04 (types)
- **Spec refs:** UI-2
- **Done when:** Token survives page refresh. Logout clears state and storage.

**Status:** `[x]`

---

### T16 — api.ts fetch wrapper + update existing hooks

- **What:**
  1. Create `apps/desktop/src/lib/api.ts` — `useApi()` hook returning `get/post/patch/delete` that inject `X-Session-Token` header
  2. Update all existing hooks that call `fetch` directly (`useOrder`, `useQueue`, `useConnectionStatus`, any others) to use `useApi()` instead
- **Where:** `apps/desktop/src/lib/api.ts` (new), `apps/desktop/src/hooks/*.ts` (updated)
- **Depends on:** T15 (AuthContext provides token)
- **Done when:** All fetch calls in desktop hooks go through the wrapper. Existing features (order taking, queue, billing) still work end-to-end with a logged-in session.

**Status:** `[x]`

---

### T17 — LoginScreen (desktop)

- **What:** Create `apps/desktop/src/screens/LoginScreen.tsx`:
  - Tab selector: PIN | Password | List
  - PIN tab: numpad grid (0–9 + backspace + submit), displays masked digits, auto-submits at 4+ digits entered
  - Password tab: username + password fields + submit button
  - List tab: fetches `GET /users/list-login`, renders clickable name list, submits on tap
  - All tabs: call `POST /login`, on success call `login(token, user)` from AuthContext
  - Error display on 401/409
- **Where:** `apps/desktop/src/screens/LoginScreen.tsx` (new file)
- **Depends on:** T15, T08 (server endpoint)
- **Spec refs:** UI-1
- **Done when:** Can log in via all 3 methods on desktop. Failed login shows error message. Successful login shows AppShell.

**Status:** `[x]`

---

### T18 — Update App.tsx (desktop)

- **What:** Update `apps/desktop/src/App.tsx`:
  - Wrap with `<AuthProvider>` (inside `ServerUrlProvider`)
  - Add `<AppGate>` component that renders `<LoginScreen>` or `<AppShell>` based on `useAuth().user`
  - Filter NAV items by role using `SCREEN_ACCESS` map (per spec UI-3)
  - Add user name display + Logout button in nav sidebar
  - Add `'users'` and `'reports'` to `ScreenType` and NAV array
  - Add `UsersScreen` and `ReportsScreen` to `renderScreen()` switch (screens can be stubs at this step)
- **Where:** `apps/desktop/src/App.tsx`
- **Depends on:** T15, T17
- **Spec refs:** UI-3
- **Done when:** Logging in as owner shows all nav items. Logging in as waiter shows only Order and Tables. Logout returns to login screen.

**Status:** `[x]`

---

## Wave 7 — Desktop Feature Screens

### T19 — UsersScreen (desktop)

- **What:** Create `apps/desktop/src/screens/UsersScreen.tsx`:
  - Table of users: Name | Role | Login Method | Status | Actions
  - Add user inline form: name, role, login_method selector, conditional PIN/password input
  - Edit user inline (same form pre-filled)
  - Disable/enable toggle
  - CSV bulk import: textarea + Import button → POST /users/bulk-import → show `{ created, errors }` result
  - Auto-generate: count + role → generate names like "Waiter 1, Waiter 2..." with auto-assigned sequential PINs
- **Where:** `apps/desktop/src/screens/UsersScreen.tsx` (new file)
- **Depends on:** T09, T15, T16, T18
- **Spec refs:** USER-2
- **Done when:** Can create, edit, disable, and bulk-import users from the desktop UI. Auto-generate creates 3 users in one action.

**Status:** `[x]`

---

### T20 — ReportsScreen (desktop)

- **What:** Create `apps/desktop/src/screens/ReportsScreen.tsx`:
  - Date range inputs (from / to), defaulting to current month
  - Tab selector: Sales | Top Items | Per Waiter | Shift
  - Each tab fetches its report on mount and on date change, displays as a table
  - "Export CSV" button: calls `GET /reports/export?type=...&from=...&to=...`, triggers browser download via `<a download>` on Blob URL
- **Where:** `apps/desktop/src/screens/ReportsScreen.tsx` (new file)
- **Depends on:** T13, T15, T16, T18
- **Spec refs:** UI-4, REPORT-1 through REPORT-5
- **Done when:** All 4 report tabs load data. CSV download saves a valid `.csv` file.

**Status:** `[x]`

---

## Wave 8 — Mobile Auth

### T21 — Mobile AuthContext

- **What:** Create `apps/mobile/src/context/AuthContext.tsx`:
  - Same contract as desktop AuthContext but uses `AsyncStorage` from `@react-native-async-storage/async-storage` for persistence
  - Install `@react-native-async-storage/async-storage` if not already present
- **Where:** `apps/mobile/src/context/AuthContext.tsx` (new file)
- **Depends on:** T04
- **Done when:** Token persists across Expo app restarts

**Status:** `[x]`

---

### T22 — Mobile LoginScreen

- **What:** Create `apps/mobile/src/screens/LoginScreen.tsx`:
  - PIN tab and List tab only (no password tab on mobile)
  - PIN: full-width numpad layout suited for tablet
  - List: scrollable list of list-login users
- **Where:** `apps/mobile/src/screens/LoginScreen.tsx` (new file)
- **Depends on:** T21, T08 (server endpoint)
- **Spec refs:** UI-1
- **Done when:** Mobile app shows login screen. PIN and list login both work.

**Status:** `[x]`

---

### T23 — Update mobile App.tsx

- **What:** Wrap `apps/mobile/src/App.tsx` with `<AuthProvider>`, add auth gate (show LoginScreen if not logged in), append `?token=...` to WS URL in OrderScreen
- **Where:** `apps/mobile/src/App.tsx`, `apps/mobile/src/screens/OrderScreen.tsx`
- **Depends on:** T21, T22
- **Done when:** Mobile app requires login before showing OrderScreen. WS connection includes token in query param.

**Status:** `[x]`

---

## Summary

| Wave                 | Tasks    | Can start when                                   |
| -------------------- | -------- | ------------------------------------------------ |
| 1 — Foundation      | T01–T05 | Now                                              |
| 2 — Auth layer      | T06–T09 | Wave 1 done                                      |
| 3 — Traceability    | T10–T11 | T06 done                                         |
| 4 — Reports         | T12–T13 | T06, T07 done                                    |
| 5 — Wire server     | T14      | T08–T13 done                                    |
| 6 — Desktop auth    | T15–T18 | T04 done (T15, T16 parallel; T17, T18 after T15) |
| 7 — Desktop screens | T19–T20 | T18 done                                         |
| 8 — Mobile auth     | T21–T23 | T04 done                                         |

**Total tasks:** 23
**Critical path (longest dependency chain):** T01 → T02 → T03 → T05 → T06 → T08 → T14 → T15 → T17 → T18 → T19/T20
