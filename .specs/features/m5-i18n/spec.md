# M5 — i18n (Internationalization)

**Status:** Specifying  
**Milestone:** M5 — Operations & UX  
**Priority:** First in M5 — cross-cutting, all other M5 features build on this

---

## Goal

Add a full internationalization layer to Vynex so every UI string on desktop and mobile can be rendered in either Portuguese (PT-BR) or English (EN-US), with the active locale controlled by the venue admin. This feature is a prerequisite for all other M5 UI work — every string added in M5 must go through the i18n system.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| i18n library | `i18next` + `react-i18next` | Industry standard; works with both React/Vite (desktop) and Expo (mobile) without divergent configs |
| Translation package | `packages/i18n` → `@vynex/i18n` | Dedicated workspace package; clean boundary, neither app owns translations |
| Default locale | Always PT-BR | 100% of current target venues are in Brazil; no install-time wizard needed |
| Locale persistence | `venue_settings` DB table on server | Consistent with offline-first — settings survive server restarts |
| Server error surface | Error codes on server, client translates | Server stays locale-agnostic; codes are stable identifiers; messages are a client concern |
| Language change UX | Requires app reload | Locale changes are rare admin operations; hot-swap adds complexity without proportional value |
| Currency formatting | Always BRL, regardless of active locale | Market is Brazil; language ≠ currency |

---

## Supported Locales

| Code | Name | Status |
|------|------|--------|
| `pt-BR` | Português (Brasil) | Default, primary |
| `en-US` | English (US) | Secondary |

---

## Requirements

### Package & Infrastructure

**I18N-01** — A new workspace package `packages/i18n` (`@vynex/i18n`) contains all translation JSON files and exports a pre-configured i18next instance ready to use in both React and React Native environments.

**I18N-02** — PT-BR JSON (`pt-BR.json`) is the authoritative source of truth. EN-US JSON (`en-US.json`) mirrors its key structure exactly. Any key present in PT-BR but absent in EN-US falls back to PT-BR at runtime.

**I18N-03** — Translation keys are typed. The package exports a `TranslationKey` type derived from the PT-BR JSON structure, enabling TypeScript autocomplete and compile-time safety for all `t()` calls.

**I18N-04** — Translation files are bundled statically (imported as JSON modules). No network fetch for translations — offline-first constraint is preserved.

**I18N-05** — The `@vynex/i18n` package exports: `i18n` (configured instance), `useTranslation` (re-export from react-i18next), `SupportedLocale` type (`'pt-BR' | 'en-US'`), and `formatDate` / `formatCurrency` utility functions.

---

### Server — Venue Settings

**I18N-06** — A new `venue_settings` table stores key-value pairs for venue-level configuration. Initial seed: `locale = 'pt-BR'`.

```sql
CREATE TABLE IF NOT EXISTS venue_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- Seed on first run (INSERT OR IGNORE):
-- ('locale', 'pt-BR', datetime('now'))
```

**I18N-07** — `GET /settings` returns the full venue settings object, including `locale`. Accessible to all authenticated users (locale must be readable by every role to initialize the UI).

```json
{ "locale": "pt-BR" }
```

**I18N-08** — `PATCH /settings/locale` accepts `{ "locale": "pt-BR" | "en-US" }` and updates the DB. Restricted to `owner` and `manager` roles via `requireRole` middleware.

**I18N-09** — The `PATCH /settings/locale` endpoint validates that the submitted locale is one of the supported codes and returns `400 LOCALE_INVALID` if not.

---

### Server — Error Codes

**I18N-10** — All server routes that return a 4xx or 5xx response include a machine-readable `code` field alongside the existing human-readable `error` field. The `error` field is retained for debugging but clients must not display it directly.

```json
{ "code": "AUTH_INVALID_CREDENTIALS", "error": "Invalid credentials" }
```

**I18N-11** — Error codes follow the namespace pattern `DOMAIN_SNAKE_DESCRIPTION`. Domains: `AUTH`, `TABLE`, `ORDER`, `MENU`, `USER`, `SETTINGS`, `GENERAL`.

**I18N-12** — The `@vynex/i18n` package exports an `errorCodeMap` that maps every defined error code to a translation key. Unmapped codes fall back to `GENERAL_UNKNOWN`.

**I18N-13** — Desktop and mobile display error messages by looking up the server-returned `code` in `errorCodeMap` and calling `t()` with the resulting key. Raw `error` strings from the server are never shown to users.

---

### Desktop — String Coverage

**I18N-14** — All hardcoded UI strings in the following files are replaced with `t()` calls using namespaced keys:

| File | Namespace |
|------|-----------|
| `App.tsx` (nav shell, role labels) | `nav`, `roles` |
| `LoginScreen.tsx` | `auth` |
| `OrderScreen.tsx` | `orders` |
| `KitchenScreen.tsx` | `queue` |
| `BarScreen.tsx` | `queue` |
| `CashierScreen.tsx` | `cashier` |
| `TableManagementScreen.tsx` | `tables` |
| `MenuManagementScreen.tsx` | `menu` |
| `UsersScreen.tsx` | `users` |
| `ReportsScreen.tsx` | `reports` |
| `SettingsScreen.tsx` | `settings` |
| `ErrorBoundary.tsx` | `errors` |

**I18N-15** — The desktop app fetches `GET /settings` on startup (after server connection is established) and calls `i18n.changeLanguage(locale)` before rendering any screen. Until the locale is loaded, the app renders a minimal loading state (not a blank screen).

**I18N-16** — The Settings screen (`SettingsScreen.tsx`) gains a "Language" section showing the current locale and a two-option selector (PT-BR / EN-US). Saving triggers `PATCH /settings/locale` and displays a toast instructing the user to reload.

---

### Mobile — String Coverage

**I18N-17** — All hardcoded UI strings in the following files are replaced with `t()` calls:

| File | Namespace |
|------|-----------|
| `App.tsx` | `nav`, `roles` |
| `LoginScreen.tsx` | `auth` |
| `OrderScreen.tsx` | `orders` |
| `ErrorBoundary.tsx` | `errors` |

**I18N-18** — The mobile app fetches `GET /settings` after connecting to the server and initializes the locale before rendering its main screens. Default is PT-BR until the server responds.

---

### Formatting Utilities

**I18N-19** — `formatDate(date: Date, locale: SupportedLocale): string` — formats a date using `Intl.DateTimeFormat` with the given locale. Used across Reports and queue screens.

**I18N-20** — `formatCurrency(amount: number): string` — always formats as BRL (`pt-BR`, `BRL`) regardless of active locale. Currency is a business domain constant, not a UI language preference.

**I18N-21** — `formatNumber(n: number, locale: SupportedLocale): string` — formats decimal numbers with locale-appropriate separators (comma in PT-BR, period in EN-US).

---

### Quality & Completeness

**I18N-22** — A `typecheck` step on `@vynex/i18n` validates that `en-US.json` contains no keys absent from `pt-BR.json` and vice versa. This catches structural drift between translation files at CI time.

**I18N-23** — No raw string literals remain in any desktop or mobile component file after this feature ships. All displayable strings flow through `t()`.

**I18N-24** — The M5 i18n implementation does not add any per-user language override. Per-user override is explicitly deferred to M7 (`venue_settings` locale is the single source of truth in M5).

---

## Out of Scope (M5)

- Per-user language override → M7
- RTL language support
- Locale-based server responses (server stays locale-agnostic)
- Translation of email/WhatsApp notification content
- Automated translation workflow / translation management platform

---

## Error Code Registry

| Code | HTTP | Trigger |
|------|------|---------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong PIN, password, or user not found |
| `AUTH_PIN_CONFLICT` | 409 | Multiple users match a PIN |
| `AUTH_INVALID_METHOD` | 400 | Unrecognized login_method |
| `AUTH_UNAUTHORIZED` | 401 | No session / expired session |
| `AUTH_FORBIDDEN` | 403 | Insufficient role |
| `TABLE_NOT_FOUND` | 404 | Table ID does not exist |
| `TABLE_NAME_TAKEN` | 409 | Duplicate table name |
| `TABLE_HAS_OPEN_ORDER` | 409 | Cannot delete table with open order |
| `ORDER_NOT_FOUND` | 404 | Order ID does not exist |
| `ORDER_ALREADY_CLOSED` | 409 | Attempting to modify a closed order |
| `MENU_ITEM_NOT_FOUND` | 404 | Menu item ID does not exist |
| `MENU_CATEGORY_NOT_FOUND` | 404 | Category ID does not exist |
| `USER_NOT_FOUND` | 404 | User ID does not exist |
| `USER_HAS_ORDERS` | 409 | Cannot hard-delete user with order history |
| `SETTINGS_LOCALE_INVALID` | 400 | Submitted locale not in supported list |
| `GENERAL_UNKNOWN` | 500 | Catch-all for unmapped server errors |
| `GENERAL_VALIDATION` | 400 | Request body failed schema validation |
