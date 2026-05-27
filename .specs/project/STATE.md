# State

_Persistent memory: decisions, blockers, lessons, deferred ideas, todos._

---

## Decisions

### [2026-05-27] Tech stack selected

**Stack:** React + Tauri (desktop) + Expo (mobile) | Node.js + Fastify (backend) | SQLite → PostgreSQL + Electric SQL | WebSockets (real-time) | Supabase (cloud, M3) | TypeScript end-to-end

**Rationale:**
- Tauri produces a Windows `.exe` installer — hard requirement for restaurant deployment
- SQLite keeps M1 installer self-contained (zero DB setup for end user)
- Fastify embedded on local server enables full offline operation on local Wi-Fi
- TypeScript everywhere reduces solo-developer cognitive overhead
- Tauri over Electron: better performance on low-end Windows machines common in restaurants
- Electric SQL + Supabase deferred to M3 — no cloud complexity until core POS is stable

---

## Blockers

_None yet._

---

## Todos

- [ ] Set up monorepo structure for React + Tauri + Expo + Fastify in TypeScript

---

## Deferred Ideas

_None yet._

---

## Lessons

_None yet._

---

## Preferences

_None yet._
