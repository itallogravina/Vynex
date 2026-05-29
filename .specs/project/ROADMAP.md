# Roadmap

**Current Milestone:** M4 — Auth & Roles + Sales Reports
**Status:** In Progress

---

## M1 — Foundation ✅ COMPLETE

**Goal:** A working single-venue POS where a waiter can take an order, it routes to the kitchen/bar, and a cashier can close the bill. Local server only, no cloud yet.

### Tech Stack

- React + Tauri (desktop, Windows `.exe` installer) + Expo (mobile tablets)
- Node.js + Fastify embedded on local server, WebSockets for real-time routing
- libSQL (embedded SQLite-compatible) — TypeScript end-to-end

### Delivered

**Table Management** ✅
- Create and configure tables with name and seat count
- Real-time table status (available / occupied) across devices

**Menu Management** ✅
- Manage categories with routing zones (kitchen, bar, cashier)
- Add, edit, enable/disable, and delete menu items
- Per-item pricing and routing zone override

**Order Taking** ✅
- Take orders from tables on any device (desktop + mobile)
- Add items with quantity and notes to an open order
- Orders routed in real time via WebSocket

**Order Routing** ✅
- Auto-route items to kitchen, bar, or cashier queues based on category
- Manual routing mode override per order
- Kitchen, Bar, and Cashier queue screens show live queue

**Cashier & Billing** ✅
- Cashier screen shows open orders and totals
- Close orders with payment recorded

---

## M2 — UI & Stability ✅ COMPLETE

**Goal:** Polished desktop and mobile UIs with role-appropriate screens, real-time queue displays, and a hardened error-handling baseline.

### Delivered

**Desktop UI (Tauri)** ✅
- Full navigation shell: Order, Kitchen, Bar, Cashier, Menu Management, Table Management, Settings screens
- Role-appropriate screen access (pre-auth placeholder routing)

**Mobile UI (Expo)** ✅
- Waiter order-taking screen with table selector, menu browser, item quantity and notes
- Real-time order item status updates via WebSocket

**Kitchen / Bar / Cashier Queue Screens** ✅
- Live item queues per routing zone
- Item status transitions (pending → ready → delivered)

**Stability Pass** ✅
- `ErrorBoundary` on desktop and mobile app roots
- User-visible error messages across all management screens (replaced silent `console.error`)
- `useRef`-based WebSocket lifecycle fix in mobile OrderScreen (was recreated on every render)
- `@fastify/cors` registered as first plugin with full method support

---

## M3 — Cloud Sync & Deployment ✅ COMPLETE

**Goal:** Production-grade deployment — Windows Service installer and optional cloud sync — while keeping offline-first as the default.

> **Note:** Original plan was PostgreSQL + Electric SQL + Supabase. Actual implementation used libSQL/Turso embedded replica mode, which is simpler, keeps the SQLite API, and satisfies offline-first with no schema migration.

### Delivered

**libSQL / Turso Cloud Sync** ✅
- Embedded replica mode: local libSQL database syncs to Turso on reconnect
- `POST /admin/sync` endpoint for manual sync trigger
- Configurable sync interval via `SYNC_INTERVAL_SECONDS` env var
- Fully offline without Turso credentials — no degraded mode

**Windows Service Installer** ✅
- NSIS + nssm + pkg bundled into a double-click `.exe`
- Fastify server registered as a Windows Service — survives reboots
- No Node.js required on the target machine

**Settings Screen & Observability** ✅
- Desktop Settings screen with server connection status
- `GET /health` endpoint: version, DB mode (local/replica), last sync timestamp

---

## M4 — Auth & Roles + Sales Reports 🔄 IN PROGRESS

**Goal:** Role-based access control and actionable sales reporting for owners and managers.

### Auth & Roles

**Role System**
- Roles: owner, manager, cashier, waiter, bartender, kitchen
- PIN or password login per user — no internet required to authenticate
- Session token stored locally

**Role-Based Screen Access**
- Waiters: Order Taking only
- Kitchen / Bartender: their queue screen only
- Cashier: Cashier queue + billing
- Manager / Owner: full access including reports and management screens

### Sales Reports

**Daily Sales Summary**
- Total revenue, order count, average ticket for the day

**Product Performance**
- Top-selling items by quantity and revenue
- Per-category breakdown

**Shift Summaries**
- Open/close shift with cashier attribution
- Revenue and order count per shift

---

## Future Considerations

- Multi-venue / franchise management
- Customer loyalty programs and accounts
- Third-party delivery integrations (iFood, Uber Eats, etc.)
- Advanced analytics and BI dashboards
- Hardware integrations (kitchen display systems, barcode scanners)
- PIX and payment gateway integration
- Duplicate table name validation (server-side constraint + UI feedback)
- Server hardening (rate limiting, input sanitization — P3/P4 security audit items)
