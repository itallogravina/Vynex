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

### M2 — Order Flow ✅ COMPLETE

- Full order lifecycle: create → add items → route → close
- Real-time order routing via WebSockets
- Role screens: Kitchen queue, Bar queue, Cashier queue
- Desktop order screen (manager/cashier view)
- Mobile order screen (waiter tablet view)
- Order status updates broadcast to all connected clients

### M3 — Deployment & Cloud Sync ✅ COMPLETE

- Windows Service installer (NSIS + nssm + pkg — double-click `.exe`)
- Turso cloud sync via embedded replica mode (optional; offline works without it)
- Manual sync endpoint (`POST /admin/sync`)
- Health endpoint (`GET /health`) with version, DB mode, last sync timestamp
- `@fastify/cors` registered with full method support
- Error boundaries on desktop and mobile app roots
- User-visible error handling across all management screens

---

### M4 — Auth & Roles + Sales Reports 🔜 NEXT

**Auth & Roles**
- PIN or password login per role (owner, manager, cashier, waiter, kitchen, bar)
- Role-based screen access — waiters see only order screen, kitchen sees only kitchen queue, etc.
- Session token stored locally; no internet required to authenticate

**Sales Reports**
- Daily and weekly sales summary (total revenue, orders, avg ticket)
- Per-item sales breakdown
- Export to CSV
- Accessible from desktop manager/owner view only

---

## Future Considerations

- Multi-venue support and centralized cloud dashboard
- Event ticketing and bar tab flow for nightclubs
- Inventory tracking and low-stock alerts
- Customer-facing display (order status screen)
- Loyalty and discount system
- Native iOS/Android builds from Expo managed workflow
- Automated database backups to Turso
