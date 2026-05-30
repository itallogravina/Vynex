# Roadmap

**Current Milestone:** M5 — Operations & UX
**Status:** M1–M4 complete, M5–M7 planned

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

## M4 — Auth, Roles & Reports ✅ COMPLETE

**Goal:** Make Vynex ready for real multi-staff use with access control,
order traceability, and financial visibility for owners and managers.

### Delivered

**Authentication** ✅

- Single login screen for all roles (desktop + mobile)
- Three login methods: Numeric PIN (numpad), Username + password, Select from list
- Admin panel visible only after login as manager or owner
- Waitstaff and operational roles see only Order and Tables screens

**User Management** ✅

- Manual one-by-one user registration (CRUD)
- Bulk import via JSON/CSV payload (`POST /users/bulk-import`)
- Auto-generate users: "Waiter 1, Waiter 2..." with auto-assigned sequential PINs
- Soft-disable users who have orders; hard-delete otherwise

**Roles & Access Control** ✅

- Owner — full access + venue configuration
- Manager — full access except critical settings
- Cashier — order closing and reports only
- Waiter — orders and tables only
- Bartender / Kitchen — own queue only
- Server-side role guard middleware (`requireRole`) on all protected routes

**Order Traceability** ✅

- Every order records who opened the table (`opened_by`)
- Every item records who added it (`added_by`)
- Session auth required on all order routes

**Sales Reports** ✅

- Total sales by day, week, and month
- Top items and categories
- Sales and productivity per waiter
- Shift summary (open/closed counts, revenue by payment method)
- Export to CSV (`GET /reports/export`)

---

## M5 — Operations & UX 🔜 PLANNED

**Goal:** Make day-to-day operations smoother for every role — resilient ordering under network failures, richer table management, smarter production queues, and the UX polish that turns a usable system into one staff actually enjoy using.

### Localization

**i18n (PT / EN)**

- Language configurable at install time and in admin settings
- Full PT-BR and EN-US string coverage across desktop and mobile
- Per-user language override in M7

### Resilience

**Offline Order Queue**

- Local queue of up to 10 orders per waiter when server is unreachable
- Auto-retry with exponential backoff on reconnect
- Visual indicator showing queued (unsynced) order count

### Table Management

**Table Transfer**

- Move an open order from one table to another mid-service

**Table Merge**

- Combine two open orders into a single bill

**Bill Splitting**

- Split a bill by item selection or by equal division across N people

**Visual Floor Map**

- Drag-and-drop table layout editor for owners/managers
- Floor map as the default table-selection view for waiters
- Table occupation time displayed on each table tile

**Idle Table Alert**

- Configurable alert when a table has been open too long without new orders

### Production Queue

**Priority Levels**

- Items flagged as Normal, Urgent, or VIP at order time
- Kitchen/bar queues sorted and visually distinguished by priority

**Prep Time & Delay Alerts**

- Optional estimated prep time field per menu item
- Alert when an item in the queue exceeds its estimated prep time

### Cashier & Billing

**Daily Cashier Closing**

- End-of-day closing flow with summary of total revenue, payment methods, and open orders
- Configurable option to block automatic closing (requires manager confirmation)

### Order Taking UX

**Quick Order**

- Tap a product name to open a quantity + notes popover and add in one step (no full item screen)

**Product Variations**

- Configurable variation groups per item (e.g. doneness, size, extras)
- Waiter selects variations at order time; selection recorded on the order item

**86'd Items**

- Mark an item as out of stock for the day without deleting or disabling it permanently
- Item appears greyed out with "86'd" badge; resets at midnight or on manual clear

**Time-Based Menu**

- Define active time windows per menu category (breakfast, lunch, dinner, happy hour)
- Items outside their window are hidden from the order screen automatically

### Notifications

**Sound & Vibration**

- Sound notifications on desktop for new queue items
- Tablet vibration on mobile for incoming order events
- Configurable per role in settings

---

## M6 — Events, Analytics & Printing 🔜 PLANNED

**Goal:** Extend Vynex beyond the daily shift — reservations, event management, richer analytics, and hardware integrations that let staff close bills and print tickets without touching a screen.

### Reservations & Events

**Table Reservations**

- Book a table with client name, party size, and arrival time
- Reservation list visible to front-of-house; alert when reservation time approaches
- Mark reservation as seated to auto-open an order

**QR Code per Table**

- Printable QR code per table that opens a read-only order tracking view for guests
- Shows item status (pending / preparing / ready) without exposing the full POS

**VIP List & Early Access**

- VIP guest list for events with early-access flag
- VIP guests visible in reservation and floor map views

**Capacity Control per Area**

- Define maximum occupancy per area (dining room, bar, terrace)
- Visual indicator and optional hard block when area is at capacity

### Promotions & Combos

**Combo Deals**

- Define bundles of items at a fixed price
- Combos selectable from the order screen; individual items tracked for kitchen routing

**Promotions**

- Time-limited price reductions or percentage discounts on items or categories
- Applied automatically based on active time window

### Menu Enhancements

**Product Photos**

- Optional photo per menu item displayed on the order screen and customer QR view

### Tab Management

**Physical Tab Control**

- Assign a physical tab number to an order (for nightclub / bar use)
- Filter open orders by tab number on the cashier screen

**Minimum Consumption**

- Define minimum spend per person or per table
- Cashier screen shows running total vs. minimum; alert at closing if not met

### Analytics

**Advanced Reports**

- Average ticket per table and per waiter
- Peak hour chart (orders and revenue by hour of day)
- Item cancellation rate
- Period comparison: this week vs. last week, this month vs. last month
- Products never ordered in a given period

### Printing

**Thermal Printer Support**

- ESC/POS printer integration for kitchen and bar ticket printing
- Configurable printer per routing zone

**Receipts**

- Printed customer receipt at order close
- WhatsApp receipt via link (no integration — pre-filled message with order summary)

**Printed Daily Closing Report**

- One-tap print of the end-of-day summary from the cashier closing screen

---

## M7 — Integrations & Compliance 🔜 PLANNED

**Goal:** Connect Vynex to the Brazilian payments and fiscal ecosystem, satisfy compliance requirements, and scale to multi-venue deployments.

### Payments

**PIX QR Code**

- Automatic PIX QR code generated for the exact bill amount at closing
- Displayed on screen and optionally printed on the receipt
- Manual confirmation of payment by cashier (no webhook required in v1)

### Delivery Integrations

**iFood & Uber Eats**

- Receive orders from iFood and Uber Eats directly into the Vynex order queue
- Delivery orders routed to kitchen/bar the same way as in-house orders
- Order source (in-house / iFood / Uber Eats) visible in queue and reports

### Communications

**WhatsApp Notifications**

- Send order receipt and status updates to guests via WhatsApp link
- Manager alerts (daily closing summary, low stock) via WhatsApp

### Fiscal & Compliance

**NFC-e Fiscal Invoice**

- Issue NFC-e (Nota Fiscal do Consumidor Eletrônica) at order close
- Configurable SEFAZ credentials per venue in admin settings

### Operations & Administration

**Manual Backup**

- One-click full database backup download from admin settings
- Backup includes all orders, users, menu, and audit log

**Full Audit Log**

- Immutable log of all write operations: who did what, when, on which record
- Viewable and exportable by owner

**Maintenance Mode**

- Owner can put the venue into maintenance mode: blocks new orders, shows a message to staff
- Useful during end-of-day procedures or system updates

### Localization

**Per-User Language Setting**

- Each user can set their preferred language independently of the venue default
- Overrides the venue-level i18n setting from M5

### Multi-Venue

**Multi-Venue & Franchise Management**

- Single owner account managing multiple venues
- Per-venue menu, staff, and settings
- Consolidated reports across all venues

---

## Future Considerations

- Customer loyalty programs and accounts
- Advanced BI dashboards and custom report builder
- Hardware integrations (kitchen display systems, barcode scanners)
- Server hardening (rate limiting, input sanitization — P3/P4 security audit)
- Duplicate table name validation (server-side constraint + UI feedback)
