# State

_Persistent memory: decisions, blockers, lessons, deferred ideas, todos._

---

## Decisions

### [2026-05-27] Node.js v22 required

**Decision:** Project uses Node.js v22.22.3 (nvm). Node v20 was initially installed but is incompatible with pnpm v11 (requires v22.13+). Upgraded via `nvm install 22 && nvm alias default 22`. pnpm v11.4.0 installed globally under Node v22.

---

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

### [2026-05-29] M5 i18n architecture decisions

**i18n library:** `i18next` + `react-i18next` — works in both React/Vite (desktop) and Expo (mobile) without diverging configs.

**Translation package:** Dedicated `packages/i18n` (`@vynex/i18n`) workspace package. Neither app owns translations.

**Default locale:** Always PT-BR. No install-time wizard, no env var. Language changeable only in admin settings post-install.

**Error codes:** Server returns structured `code` string (e.g. `AUTH_INVALID_CREDENTIALS`) alongside `error` message. Client maps codes to locale strings via `errorCodeMap` in `@vynex/i18n`. Server stays locale-agnostic.

**Locale persistence:** `venue_settings` DB table (key-value) on the server. Seeded with `locale = 'pt-BR'`.

**Language change UX:** Requires app reload. Locale changes are rare admin operations; hot-swap adds complexity without value.

**Currency:** Always BRL regardless of active locale (Brazil-only market).

**Scope (M5):** No per-user language override. That is deferred to M7.

---

## Blockers

_None yet._

---

## Todos

- [ ] Set up monorepo structure for React + Tauri + Expo + Fastify in TypeScript
- [x] Implement M5 i18n (11 tasks — see .specs/features/m5-i18n/tasks.md)
- [x] Implement M5 86'd Items (see .specs/features/m5-eightysix/spec.md)
- [x] Implement M5 Quick Order (tap item → qty+notes popover → add in one step; desktop modal + mobile bottom sheet)

---

## Deferred Ideas

_None yet._

---

## Lessons

_None yet._

---

## Preferences

_None yet._
