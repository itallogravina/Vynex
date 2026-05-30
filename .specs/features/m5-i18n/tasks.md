# M5 i18n — Tasks

**Status:** Ready  
**Spec:** [spec.md](spec.md) | **Design:** [design.md](design.md)

Legend: `[P]` = can run in parallel with previous `[P]` block

---

## T1 — Scaffold `@vynex/i18n` package

**What:** Create `packages/i18n/` with `package.json`, `tsconfig.json`, empty locale JSON files, and the i18next instance. No translations yet — just the wiring.

**Where:** `packages/i18n/`

**Depends on:** nothing (first task)

**Done when:**
- `packages/i18n/package.json` exports `@vynex/i18n` with `main`, `types`, `exports`
- `packages/i18n/src/instance.ts` creates and exports a configured i18next instance with `initReactI18next`
- `packages/i18n/src/types.ts` exports `SupportedLocale = 'pt-BR' | 'en-US'` and placeholder `TranslationKey`
- `packages/i18n/src/locales/pt-BR.json` and `en-US.json` exist (can be near-empty shells with at least `{ "common": { "loading": "..." } }`)
- `packages/i18n/src/index.ts` re-exports `i18n`, `useTranslation`, `SupportedLocale`, `TranslationKey`
- Root `pnpm-workspace.yaml` (or equivalent) includes `packages/i18n`
- `pnpm install` succeeds; `pnpm typecheck` passes on the new package

**Tests:** `pnpm -F @vynex/i18n typecheck`

**Gate:** `pnpm -F @vynex/i18n typecheck` exits 0

---

## T2 — Server: `venue_settings` table + locale API

**What:** Add the `venue_settings` DB table, seed it with `locale = 'pt-BR'`, and expose `GET /settings` and `PATCH /settings/locale`.

**Where:**
- `apps/server/src/db/migrations/` (or inline schema) — new table
- `apps/server/src/routes/settings.ts` — new file
- `apps/server/src/index.ts` — register new route

**Depends on:** nothing (parallel with T1)

**Reuses:** existing `requireRole` middleware, existing db client pattern

**Done when:**
- `GET /settings` returns `{ "locale": "pt-BR" }` (unauthenticated OK for locale)
- `PATCH /settings/locale` with valid locale returns `{ "locale": "en-US" }` and persists to DB
- `PATCH /settings/locale` with invalid locale returns `{ "code": "SETTINGS_LOCALE_INVALID", "error": "..." }` + HTTP 400
- `PATCH /settings/locale` without owner/manager session returns 403
- DB is seeded with `locale = 'pt-BR'` on fresh start (INSERT OR IGNORE)

**Tests:** manual curl or REST client

**Gate:** server starts; `GET /settings` and `PATCH /settings/locale` behave as documented above

---

## T3 — Server: add `code` field to all error responses [P]

**What:** Add a `code` string field to every `4xx`/`5xx` reply across all server routes. Introduce a shared `apiError()` helper and migrate all routes to use it. Error codes follow the registry in `spec.md`.

**Where:**
- `apps/server/src/lib/errors.ts` — new helper
- `apps/server/src/routes/auth.ts`
- `apps/server/src/routes/tables.ts`
- `apps/server/src/routes/menu.ts`
- `apps/server/src/routes/users.ts`
- `apps/server/src/routes/reports.ts`
- `apps/server/src/middleware/roles.ts`
- Any other route files that call `reply.status(4xx).send(...)`

**Depends on:** nothing (parallel with T1, T2)

**Done when:**
- `apiError(reply, status, code, message)` helper exists in `apps/server/src/lib/errors.ts`
- Every `reply.status(4xx|5xx).send(...)` call in all routes uses `apiError()` with a code from the registry
- No `{ error: 'string' }` response exists without a matching `code` field
- `pnpm -F @vynex/server typecheck` passes

**Tests:** `pnpm -F @vynex/server typecheck`

**Gate:** typecheck exits 0; manual spot-check on `/auth/login` with bad credentials returns `{ "code": "AUTH_INVALID_CREDENTIALS", ... }`

---

## T4 — `@vynex/i18n`: complete PT-BR and EN-US translation files

**What:** Extract every UI string from all desktop and mobile screen files and add them to `pt-BR.json` and `en-US.json`. Also add all error code strings. Update `TranslationKey` type to reflect the full JSON structure.

**Where:** `packages/i18n/src/locales/pt-BR.json`, `en-US.json`, `packages/i18n/src/types.ts`

**Depends on:** T1 (package scaffolded)

**String inventory (desktop screens):**
- `App.tsx` → `nav.*`, `roles.*`
- `LoginScreen.tsx` → `auth.*`
- `OrderScreen.tsx` → `orders.*`
- `KitchenScreen.tsx`, `BarScreen.tsx` → `queue.*`
- `CashierScreen.tsx` → `cashier.*`
- `TableManagementScreen.tsx` → `tables.*`
- `MenuManagementScreen.tsx` → `menu.*`
- `UsersScreen.tsx` → `users.*`
- `ReportsScreen.tsx` → `reports.*`
- `SettingsScreen.tsx` → `settings.*`
- `ErrorBoundary.tsx` → `errors.*`
- Shared buttons/labels → `common.*`

**Error code strings:** all 16 codes from spec.md Error Code Registry

**Done when:**
- `pt-BR.json` contains every key needed by all screens (no `t()` call returns undefined)
- `en-US.json` has a translated EN-US value for every key in `pt-BR.json`
- `TranslationKey` type covers all keys (dot-notation paths)
- `pnpm -F @vynex/i18n typecheck` passes

**Gate:** typecheck exits 0; no missing keys when `i18n.t('any.key.used.in.screens')` is called

---

## T5 — `@vynex/i18n`: add `errorCodes.ts` and formatting utilities [P]

**What:** Implement `errorCodeMap`, `translateErrorCode()`, `formatDate()`, `formatCurrency()`, and `formatNumber()`. Export from `index.ts`.

**Where:** `packages/i18n/src/errorCodes.ts`, `packages/i18n/src/format.ts`, `packages/i18n/src/index.ts`

**Depends on:** T4 (translation keys must exist before mapping to them)

**Done when:**
- `errorCodeMap` maps all 16 codes from spec.md to translation key paths
- `translateErrorCode(t, code)` returns translated string; unmapped code falls back to `GENERAL_UNKNOWN`
- `formatDate`, `formatCurrency`, `formatNumber` match design.md spec
- All utilities exported from `packages/i18n/src/index.ts`
- `pnpm -F @vynex/i18n typecheck` passes

**Gate:** typecheck exits 0

---

## T6 — Desktop: wire `@vynex/i18n` and locale initialization

**What:** Add `@vynex/i18n` as a dependency to `apps/desktop`. In `App.tsx`, fetch `GET /settings` after server connection and call `i18n.changeLanguage()`. Wrap the app in `I18nextProvider`.

**Where:**
- `apps/desktop/package.json` — add `@vynex/i18n: workspace:*`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/main.tsx` (if provider goes here)

**Depends on:** T1 (package exists), T2 (GET /settings endpoint exists)

**Done when:**
- App wraps render tree in `<I18nextProvider i18n={i18n}>`
- On mount, `GET /serverUrl/settings` is fetched; on success, `i18n.changeLanguage(locale)` is called
- Fetch failure is silently swallowed; PT-BR remains active
- A minimal loading state (spinner or blank) is shown if locale hasn't resolved yet before rendering screens (acceptable: login screen can render immediately in PT-BR default)
- `pnpm -F @vynex/desktop typecheck` passes

**Gate:** typecheck exits 0; app renders in PT-BR by default; switching locale on server and reloading shows EN-US strings

---

## T7 — Mobile: wire `@vynex/i18n` and locale initialization [P]

**What:** Same as T6 but for `apps/mobile`. Expo doesn't need special i18next plugins — `react-i18next` works directly.

**Where:**
- `apps/mobile/package.json` — add `@vynex/i18n: workspace:*`
- `apps/mobile/src/App.tsx`

**Depends on:** T1, T2

**Done when:**
- Mobile app wraps in `<I18nextProvider>` and fetches locale from server on mount
- `pnpm -F @vynex/mobile typecheck` passes

**Gate:** typecheck exits 0

---

## T8 — Desktop: replace all hardcoded strings with `t()` calls

**What:** For each screen file listed in I18N-14, replace every hardcoded UI string with a `t('namespace.key')` call. Import `useTranslation` from `@vynex/i18n`. Replace direct server error string displays with `translateErrorCode(t, response.code)`.

**Where:** All 12 desktop screen/component files listed in I18N-14

**Depends on:** T4 (translation keys exist), T6 (i18next wired in desktop)

**Done when:**
- No string literals remain inside JSX or UI logic in any of the 12 files
- All error displays use `translateErrorCode` (not raw `response.error` strings)
- `pnpm -F @vynex/desktop typecheck` passes

**Gate:** typecheck exits 0; visual spot-check in PT-BR shows correct strings; switching to EN-US shows English strings

---

## T9 — Mobile: replace all hardcoded strings with `t()` calls [P]

**What:** Same as T8 for the 4 mobile files listed in I18N-17.

**Where:** `App.tsx`, `LoginScreen.tsx`, `OrderScreen.tsx`, `ErrorBoundary.tsx` in `apps/mobile/src/`

**Depends on:** T4, T7

**Gate:** typecheck exits 0; PT-BR and EN-US strings render correctly on mobile

---

## T10 — Settings screen: language selector UI

**What:** Add a "Language" section to the existing `SettingsScreen.tsx` on desktop. Two-option selector (PT-BR / EN-US). Save triggers `PATCH /settings/locale`. On success shows a reload notice with a "Reload now" button.

**Where:** `apps/desktop/src/screens/SettingsScreen.tsx`

**Depends on:** T2 (PATCH endpoint), T8 (settings strings are translated)

**Done when:**
- Language section visible in Settings screen (owner and manager only — hide for other roles)
- Current locale is pre-selected in the UI, matching `GET /settings` response
- Selecting a different locale and saving calls `PATCH /settings/locale`
- On success: notice "Language updated. Reload the app to apply." + "Reload now" button (`window.location.reload()`)
- On error: translated error message via `translateErrorCode`
- `pnpm -F @vynex/desktop typecheck` passes

**Gate:** typecheck exits 0; manual flow: change to EN-US → save → reload → app shows English

---

## T11 — Key-parity typecheck script

**What:** Add a short Node script (or TypeScript check) that compares the key sets of `pt-BR.json` and `en-US.json` and exits non-zero if they differ. Wire it into `pnpm -F @vynex/i18n typecheck` or as a separate `pnpm -F @vynex/i18n check-keys` script.

**Where:** `packages/i18n/scripts/check-keys.ts` (or `.js`)

**Depends on:** T4 (files are complete)

**Done when:**
- Script exits 0 when both JSON files have identical key sets
- Script exits non-zero and prints the differing keys when they diverge
- Script is wired to run as part of `pnpm typecheck` in `@vynex/i18n`

**Gate:** script exits 0 on the completed translation files; artificially removing a key from `en-US.json` makes it exit non-zero

---

## Execution Order

```
T1 ─────────────────────────────► T4 ──► T5
T2 ─────────────────────────────► T6 ──► T8 ──► T10
                                   T7 ──► T9
T3 (parallel with T1+T2)
                                         T11 (after T4)
```

Sequential minimums per path:
- Critical path: T1 → T4 → T8 → T10 (desktop language selector fully working)
- Can parallelise: T2+T3 with T1; T7+T9 with T6+T8; T5+T11 with T8
