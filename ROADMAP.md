# Vynex Roadmap

Multiplatform venue management system for restaurants, nightclubs, and events.
Offline-first. Real-time order routing. Single-operator deployable.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop | React + Tauri (Windows `.exe` installer) |
| Mobile | React Native + Expo (waiter tablets) |
| Server | Node.js + Fastify (embedded on local machine) |
| Real-time | WebSockets (`@fastify/websocket`) |
| Database | libSQL (embedded SQLite-compatible) |
| Cloud sync | Turso (embedded replica mode — optional) |
| Windows Service | NSIS installer + nssm + pkg |
| Shared types | `@vynex/shared` TypeScript package |

---

## Milestones

### M1 — Foundation ✅ COMPLETE

- Monorepo setup: pnpm workspaces, shared TypeScript package
- Fastify server with SQLite via libSQL
- Table and menu CRUD (REST API)
- Desktop app shell (Tauri + React)
- Mobile app shell (Expo + React Native)

### M2 — UI & Stability ✅ COMPLETE

- Full order lifecycle: create → add items → route → close
- Real-time order routing via WebSockets
- Role screens: Kitchen queue, Bar queue, Cashier queue
- Desktop order screen (manager/cashier view)
- Mobile order screen (waiter tablet view)
- Order status updates broadcast to all connected clients
- `ErrorBoundary` on desktop and mobile; user-visible error handling everywhere

### M3 — Cloud Sync & Deployment ✅ COMPLETE

- Windows Service installer (NSIS + nssm + pkg — double-click `.exe`)
- Turso cloud sync via embedded replica mode (optional; offline works without it)
- Manual sync endpoint (`POST /admin/sync`)
- Health endpoint (`GET /health`) with version, DB mode, last sync timestamp
- `@fastify/cors` registered with full method support

### M4 — Auth, Roles & Reports ✅ COMPLETE

- PIN, username/password, and select-from-list login methods per role
- Role-based screen access (owner, manager, cashier, waiter, kitchen, bartender)
- Session token stored locally; no internet required to authenticate
- User management: create, edit, enable/disable, bulk import, auto-generate
- Daily and weekly sales reports (revenue, orders, avg ticket, per-item breakdown)
- Per-waiter performance report
- Shift summary report

### M5 — Operations & UX ✅ COMPLETE

- **i18n** — PT-BR and EN-US; language configurable in settings
- **Offline order queue** — up to 10 orders per waiter stored locally; exponential backoff sync; unsynced count badge in nav
- **Floor map** — drag-and-drop table layout editor; occupation time per table tile
- **Table transfer / merge / bill splitting** — move orders between tables, combine bills, split by item or equal parts
- **Force-delete table** — cancels open orders and cascades cleanly
- **Idle table alert** — configurable alert when a table has been open too long
- **Priority levels** — Normal / Urgent / VIP per item; queues sorted and color-coded
- **Prep time & delay alerts** — estimated prep time per item; alert when exceeded in queue
- **86'd items** — out-of-stock-for-the-day flag; greyed badge; resets at midnight
- **Time-based menu** — active time windows per category (breakfast, lunch, dinner, happy hour)
- **Quick order** — tap-to-popover item entry in one step
- **Product variations** — configurable groups (doneness, size, extras) selected at order time
- **Daily cashier closing** — end-of-day summary with revenue, payment methods, open orders
- **Sound & idle alerts** — desktop sound on new queue items; mobile vibration; configurable per role

---

### M6 — Events, Analytics & Printing 🔜 NEXT

**Reservations & Events**
- Table reservations with client name, party size, arrival time; seat alert; auto-open order
- QR code per table — printable; guests see live item status without touching POS
- VIP list with early-access flag visible in reservation and floor map views
- Capacity control per area with visual indicator and optional hard block

**Promotions & Combos**
- Combo bundles at a fixed price; individual items still routed correctly
- Time-limited price reductions or percentage discounts on items/categories

**Menu Enhancements**
- Optional product photo per item (shown on order screen and guest QR view)

**Tab Management**
- Physical tab number assignment (nightclub/bar use)
- Minimum consumption per person or table; cashier alert at closing if not met

**Analytics**
- Average ticket per table and per waiter
- Peak hour chart (orders and revenue by hour)
- Item cancellation rate
- Period comparison (this week vs. last, this month vs. last)
- Products never ordered in a given period

**Printing**
- ESC/POS thermal printer support; configurable per routing zone
- Printed customer receipt at order close
- WhatsApp receipt via pre-filled link (no integration required)
- One-tap printed daily closing report

---

### M7 — Integrations & Compliance 🔜 PLANNED

**Payments**
- PIX QR code auto-generated for the exact bill amount at closing

**Delivery**
- iFood and Uber Eats order ingestion into the Vynex queue

**Communications**
- WhatsApp order receipt and manager daily-closing alerts

**Fiscal**
- NFC-e (Nota Fiscal do Consumidor Eletrônica) issuance at order close

**Operations & Administration**
- One-click full database backup download
- Immutable full audit log (viewable and exportable by owner)
- Maintenance mode (blocks new orders; shows message to staff)
- Per-user language override (overrides venue-level i18n setting from M5)

**Multi-Venue**
- Single owner account managing multiple venues with consolidated reports

---

## Future Considerations

- Customer loyalty programs and accounts
- Advanced BI dashboards and custom report builder
- Hardware integrations (kitchen display systems, barcode scanners)
- Server hardening (rate limiting, input sanitization)
- Native iOS/Android builds from Expo managed workflow
- Automated database backups to Turso
