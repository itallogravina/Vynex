# Spec — 86'd Items (M5)

**Status:** Implementing  
**Scope:** Medium — server migration + route, shared type, 2 UI screens, locale files

---

## Goal

Allow managers/owners to mark a menu item as out-of-stock for the current day ("86'd").  
Waitstaff see the item greyed out with an "86'd" badge and cannot add it to an order.  
The flag resets automatically at midnight (next calendar day) and can be cleared manually.

---

## Requirements

### R1 — DB
- Add nullable column `eightysixed_at TEXT` to `menu_items`
- Deployed via the existing `runMigrations()` pattern in `init.ts`

### R2 — Server computed flag
- `MenuItem` response includes `eightysixed: boolean`  
- Server computes: `eightysixed = (eightysixed_at = date('now', 'localtime'))`  
- Raw `eightysixed_at` is not exposed to clients (internal)

### R3 — API endpoint
- `PATCH /menu-items/:id/eightysix` — body `{ active: boolean }`
  - `active: true` → set `eightysixed_at = date('now', 'localtime')`
  - `active: false` → set `eightysixed_at = NULL`
  - Returns updated `MenuItem`
  - Requires role: owner or manager

### R4 — MenuManagementScreen (desktop)
- Each item row shows an "86'd" badge when `eightysixed = true`
- Item row has a button: "86" when not 86'd, "Clear 86" when 86'd
- Clicking calls `PATCH /menu-items/:id/eightysix` and refreshes the list

### R5 — OrderScreen (desktop + mobile)
- 86'd items are displayed greyed out with a badge ("Esgotado" / "86'd")
- The add-to-order button/tap target is disabled for 86'd items
- Items remain visible so staff know they exist but are unavailable

### R6 — Midnight auto-reset
- No cron needed — server computes `eightysixed` fresh on every request
- Stored date `eightysixed_at` is a calendar day string (SQLite `date()`)
- On a new day, `eightysixed_at ≠ date('now', 'localtime')` → flag is false

### R7 — Locale keys (both PT-BR and EN-US)
- `menu.outOfStock` — badge label shown on item
- `menu.eightysix` — action button label (mark as 86'd)
- `menu.clearEightysix` — action button label (clear the flag)

### R8 — Key parity
- `pnpm -F @vynex/i18n check-keys` must pass after locale changes

---

## Out of scope
- Kitchen/bar staff cannot 86 items (management action only)
- No WebSocket broadcast when an item is 86'd (next-fetch polling is sufficient)
- No 86'd item count indicator on the nav
- No per-category 86 (item-level only)
