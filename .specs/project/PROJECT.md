# Vynex

**Vision:** A multiplatform management system for restaurants, nightclubs, and events that routes orders in real time to the right area (kitchen, bar, cashier) and works reliably whether online, offline, or in a hybrid deployment.
**For:** Business owners, managers, cashiers, bartenders, kitchen staff, and waitstaff in food and beverage and events venues.
**Solves:** Fragmented venue operations — disconnected order-taking, routing failures when the internet drops, and the lack of a single system that covers tables, bar tabs, event tickets, and billing across all device types.

## Goals

- Deliver a fully operational POS and venue management system that replaces manual/paper-based workflows in a single venue by end of v1.
- Achieve zero order loss during connectivity outages through offline-first local operation with automatic cloud sync on reconnect.

## Tech Stack

**Language:** TypeScript end-to-end

**Frontend:**
- React (web UI, shared component library)
- Tauri (desktop app — bundles to a Windows `.exe` installer, low resource usage vs Electron)
- Expo (mobile — Android/iOS tablets for waitstaff)

**Backend:**
- Node.js + Fastify (embedded on local server, zero external dependencies at runtime)
- Native WebSockets via Fastify (real-time order routing to kitchen/bar screens)

**Database:**
- M1–M2: SQLite (embedded, zero-config, keeps installer simple)
- M3: PostgreSQL + Electric SQL (cloud sync, conflict resolution)

**Cloud / Hybrid (M3):**
- Supabase (cloud backup and redundancy)

**Key constraints driving this stack:**
- Must produce a Windows `.exe` double-click installer — Tauri satisfies this
- Offline-first on local Wi-Fi — SQLite + embedded Fastify, no internet required
- Solo developer — TypeScript everywhere eliminates context switching
- Low-end hardware — Tauri chosen over Electron for performance

## Scope

**v1 includes:**

- Table management: assign, open, transfer, close tables
- Order taking: create, modify, and cancel orders from any device
- Order routing: automatically send items to kitchen, bar, or cashier based on category
- Menu management: categories, items, modifiers, pricing
- Bar tab / consumption tracking: open tabs, add items, close with billing
- Event ticketing: create events, sell and validate tickets
- Cashier / billing: close orders, apply discounts, print or send receipts
- Offline operation: core order flow works with local server only
- Cloud sync: changes replicate to cloud when connectivity is available
- User roles and permissions: owner, manager, cashier, waiter, bartender, kitchen

**Explicitly out of scope:**

- Multi-venue / franchise management (post-v1)
- Loyalty programs and customer accounts
- Third-party delivery platform integrations (iFood, Uber Eats, etc.)
- Advanced analytics and BI dashboards
- Hardware integrations beyond basic receipt printing

## Constraints

- Timeline: No hard deadline
- Technical: Offline-first and hybrid deployment are non-negotiable from day one
- Resources: Solo developer
