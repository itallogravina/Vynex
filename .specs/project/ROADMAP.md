# Roadmap

**Current Milestone:** M1 — Foundation
**Status:** Planning

---

## M1 — Foundation

**Goal:** A working single-venue POS where a waiter can take an order, it routes to the kitchen/bar, and a cashier can close the bill. Local server only, no cloud yet.
**Target:** Core workflow functional end-to-end

### Features

**Tech Stack Decision** - COMPLETE

- React + Tauri (desktop, Windows installer) + Expo (mobile tablets)
- Node.js + Fastify embedded on local server, WebSockets for real-time routing
- SQLite for M1–M2, PostgreSQL + Electric SQL at M3
- TypeScript end-to-end

**Table Management** - PLANNED

- Create and configure floor layout with tables
- Open, transfer, and close tables
- See real-time table status across devices

**Menu Management** - PLANNED

- Manage categories, items, and pricing
- Add modifiers/options to items
- Enable/disable items without deleting

**Order Taking** - PLANNED

- Take orders from tables on any device
- Add, modify, and cancel items on an open order
- Orders persist locally when offline

**Order Routing** - PLANNED

- Auto-route items to kitchen, bar, or cashier queues based on category
- Kitchen and bar screens show their queue in real time
- Mark items as ready/delivered

**Cashier & Billing** - PLANNED

- View open orders and totals
- Close orders with payment (cash, card — recorded only)
- Print or display receipt

---

## M2 — Bar & Events

**Goal:** Add bar tab management and event ticketing to cover nightclub and event venue use cases.
**Target:** After M1 complete

### Features

**Bar Tab / Consumption** - PLANNED

- Open a tab for a customer or group
- Add bar items to the tab over time
- Close tab with billing

**Event Ticketing** - PLANNED

- Create events with ticket types and quantities
- Sell tickets (on-site)
- Validate tickets at entry (QR or code scan)

**User Roles & Permissions** - PLANNED

- Owner, manager, cashier, waiter, bartender, kitchen roles
- Role-based access to screens and actions

---

## M3 — Cloud & Hybrid Deployment

**Goal:** Add cloud backup, redundancy, and hybrid deployment so the system survives internet outages and scales to multi-device venues.
**Target:** After M2 complete

### Features

**Cloud Sync** - PLANNED

- Migrate SQLite → PostgreSQL + Electric SQL
- Replicate local data to Supabase on reconnect
- Conflict resolution for concurrent offline edits via Electric SQL

**Hybrid Deployment** - PLANNED

- Local Fastify server as primary, Supabase as backup
- Admin dashboard for deployment configuration
- Health monitoring and sync status visibility

---

## Future Considerations

- Multi-venue / franchise management
- Customer loyalty programs and accounts
- Third-party delivery integrations (iFood, Uber Eats, etc.)
- Advanced analytics and BI dashboards
- Hardware integrations (kitchen display systems, barcode scanners)
