# M5 i18n — Design

**Status:** Complete  
**Spec:** [spec.md](spec.md)

---

## Package Architecture

```
packages/i18n/                    # @vynex/i18n
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                  # Public API: i18n, useTranslation, SupportedLocale,
    │                             #   formatDate, formatCurrency, formatNumber, errorCodeMap
    ├── instance.ts               # Configured i18next instance (static JSON imports)
    ├── types.ts                  # SupportedLocale, TranslationKey
    ├── format.ts                 # formatDate, formatCurrency, formatNumber
    ├── errorCodes.ts             # errorCodeMap: Record<ErrorCode, TranslationKey>
    └── locales/
        ├── pt-BR.json            # Source of truth — all keys live here
        └── en-US.json            # Must mirror pt-BR.json structure exactly
```

---

## Translation Key Structure (JSON shape)

```json
{
  "nav": {
    "order": "Pedidos",
    "kitchen": "Cozinha",
    "bar": "Bar",
    "cashier": "Caixa",
    "menu": "Cardápio",
    "tables": "Mesas",
    "users": "Usuários",
    "reports": "Relatórios",
    "settings": "Configurações"
  },
  "roles": {
    "owner": "Proprietário",
    "manager": "Gerente",
    "cashier": "Caixa",
    "waiter": "Garçom",
    "bartender": "Barman",
    "kitchen": "Cozinha"
  },
  "auth": {
    "login": "Entrar",
    "logout": "Sair",
    "pin": "PIN",
    "username": "Usuário",
    "password": "Senha",
    "selectUser": "Selecionar usuário",
    "errors": {
      "AUTH_INVALID_CREDENTIALS": "Credenciais inválidas",
      "AUTH_PIN_CONFLICT": "Conflito de PIN — contate o gerente",
      "AUTH_INVALID_METHOD": "Método de login inválido",
      "AUTH_UNAUTHORIZED": "Sessão expirada, faça login novamente",
      "AUTH_FORBIDDEN": "Acesso não permitido para este perfil"
    }
  },
  "orders": { "..." : "..." },
  "queue":  { "..." : "..." },
  "cashier":{ "..." : "..." },
  "tables": { "..." : "..." },
  "menu":   { "..." : "..." },
  "users":  { "..." : "..." },
  "reports":{ "..." : "..." },
  "settings":{
    "language": "Idioma",
    "languageChanged": "Idioma atualizado. Recarregue o aplicativo para aplicar.",
    "reload": "Recarregar agora"
  },
  "errors": {
    "boundary": "Algo deu errado.",
    "boundaryRetry": "Tentar novamente",
    "GENERAL_UNKNOWN": "Erro inesperado",
    "GENERAL_VALIDATION": "Dados inválidos"
  },
  "common": {
    "save": "Salvar",
    "cancel": "Cancelar",
    "delete": "Excluir",
    "edit": "Editar",
    "add": "Adicionar",
    "confirm": "Confirmar",
    "loading": "Carregando...",
    "yes": "Sim",
    "no": "Não"
  }
}
```

> All error codes used in `errorCodeMap` are nested under their domain namespace inside `auth`, `orders`, `tables`, etc., matching where the error surfaces. `GENERAL_*` errors live in `errors` namespace.

---

## i18next Instance Configuration

```typescript
// packages/i18n/src/instance.ts
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import ptBR from './locales/pt-BR.json'
import enUS from './locales/en-US.json'

const i18n = i18next.createInstance()

i18n.use(initReactI18next).init({
  lng: 'pt-BR',           // default; apps call i18n.changeLanguage() after fetching /settings
  fallbackLng: 'pt-BR',
  resources: {
    'pt-BR': { translation: ptBR },
    'en-US': { translation: enUS },
  },
  interpolation: { escapeValue: false },  // React handles XSS
  returnNull: false,
})

export { i18n }
```

---

## App Initialization Flow

```
App mounts
  └─ Connect to server
      └─ GET /settings              (after auth or on unauthenticated load)
          ├─ Success → i18n.changeLanguage(locale) → render main UI
          └─ Failure → stay on pt-BR (offline fallback) → render main UI
```

Both desktop and mobile follow this pattern. The locale fetch is fire-and-forget after connecting — it does not block the login screen from rendering (login strings are always available in PT-BR as default).

**Implementation pattern in App.tsx:**

```typescript
const { i18n } = useTranslation()

useEffect(() => {
  fetch(`${serverUrl}/settings`)
    .then(r => r.json())
    .then(({ locale }) => { if (locale) i18n.changeLanguage(locale) })
    .catch(() => {})  // silently keep pt-BR on failure
}, [serverUrl])
```

---

## Server — venue_settings Table

```sql
CREATE TABLE IF NOT EXISTS venue_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Seed (runs in migration, idempotent):
INSERT OR IGNORE INTO venue_settings (key, value, updated_at)
VALUES ('locale', 'pt-BR', datetime('now'));
```

**Routes added to server:**

```
GET  /settings              → { locale: 'pt-BR' }  (all authenticated roles)
PATCH /settings/locale      → { locale: 'en-US' }  (owner, manager only)
```

`GET /settings` is intentionally unauthenticated in the initial call pattern — the app needs the locale to render the login screen itself. If it becomes a security concern, it can be restricted later; venue locale is not sensitive data.

---

## Server — Error Code Migration

Current format:
```json
{ "error": "Invalid credentials" }
```

New format (additive, non-breaking):
```json
{ "code": "AUTH_INVALID_CREDENTIALS", "error": "Invalid credentials" }
```

Migration scope: every `reply.status(4xx|5xx).send({ error: '...' })` in:
- `routes/auth.ts`
- `routes/tables.ts`
- `routes/orders.ts` (if exists)
- `routes/menu.ts`
- `routes/users.ts`
- `routes/reports.ts`
- `middleware/roles.ts`

A shared helper avoids repetition:

```typescript
// apps/server/src/lib/errors.ts
export function apiError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
) {
  return reply.status(status).send({ code, error: message })
}
```

---

## Type Safety Strategy

`TranslationKey` is derived from the flat dot-notation key paths of `pt-BR.json` using TypeScript's recursive template literal type. This gives full autocomplete on `t('nav.order')` and fails to compile on typos.

```typescript
// packages/i18n/src/types.ts
import type ptBR from './locales/pt-BR.json'

type Paths<T, Prefix extends string = ''> =
  T extends object
    ? { [K in keyof T]: Paths<T[K], `${Prefix}${Prefix extends '' ? '' : '.'}${string & K}`> }[keyof T]
    : Prefix

export type TranslationKey = Paths<typeof ptBR>
export type SupportedLocale = 'pt-BR' | 'en-US'
```

---

## errorCodeMap

```typescript
// packages/i18n/src/errorCodes.ts
import type { TranslationKey } from './types'

export const errorCodeMap: Record<string, TranslationKey> = {
  AUTH_INVALID_CREDENTIALS: 'auth.errors.AUTH_INVALID_CREDENTIALS',
  AUTH_PIN_CONFLICT:        'auth.errors.AUTH_PIN_CONFLICT',
  AUTH_INVALID_METHOD:      'auth.errors.AUTH_INVALID_METHOD',
  AUTH_UNAUTHORIZED:        'auth.errors.AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN:           'auth.errors.AUTH_FORBIDDEN',
  TABLE_NOT_FOUND:          'tables.errors.TABLE_NOT_FOUND',
  TABLE_NAME_TAKEN:         'tables.errors.TABLE_NAME_TAKEN',
  TABLE_HAS_OPEN_ORDER:     'tables.errors.TABLE_HAS_OPEN_ORDER',
  ORDER_NOT_FOUND:          'orders.errors.ORDER_NOT_FOUND',
  ORDER_ALREADY_CLOSED:     'orders.errors.ORDER_ALREADY_CLOSED',
  MENU_ITEM_NOT_FOUND:      'menu.errors.MENU_ITEM_NOT_FOUND',
  MENU_CATEGORY_NOT_FOUND:  'menu.errors.MENU_CATEGORY_NOT_FOUND',
  USER_NOT_FOUND:           'users.errors.USER_NOT_FOUND',
  USER_HAS_ORDERS:          'users.errors.USER_HAS_ORDERS',
  SETTINGS_LOCALE_INVALID:  'settings.errors.SETTINGS_LOCALE_INVALID',
  GENERAL_UNKNOWN:          'errors.GENERAL_UNKNOWN',
  GENERAL_VALIDATION:       'errors.GENERAL_VALIDATION',
}

export function translateErrorCode(
  t: (key: TranslationKey) => string,
  code: string | undefined,
): string {
  const key = errorCodeMap[code ?? ''] ?? errorCodeMap['GENERAL_UNKNOWN']
  return t(key)
}
```

---

## Settings Screen — Language Selector (Desktop)

The "Language" section is added to the existing `SettingsScreen.tsx`. It reads the current locale from the `i18n` instance and shows a two-option radio/select:

```
Language
  ● Português (Brasil)   ○ English (US)
  [Save]   "Reload the app to apply changes."
```

On Save:
1. `PATCH /settings/locale` with `{ locale: selectedLocale }`
2. On success: show inline notice with a "Reload" button (`window.location.reload()` on desktop, `Updates.reloadAsync()` on Expo)
3. On error: show translated error using `translateErrorCode`

---

## Formatting Utilities

```typescript
// packages/i18n/src/format.ts
import type { SupportedLocale } from './types'

export function formatDate(date: Date, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(amount)
}

export function formatNumber(n: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(n)
}
```

---

## Dependency Changes

| Package | Where | Version |
|---------|-------|---------|
| `i18next` | `packages/i18n` | `^24` |
| `react-i18next` | `packages/i18n` | `^15` |
| `@vynex/i18n` | `apps/desktop`, `apps/mobile` | `workspace:*` |

No new server dependencies — `venue_settings` is plain SQL, no ORM changes.

---

## Task Sequence

Tasks are ordered to respect these dependencies:

```
[1] packages/i18n scaffold       → unblocks everything
[2] Server venue_settings        → unblocks locale fetch
[3] Server error codes           → parallel with [2] after [1]
[4] Desktop string extraction    → requires [1]
[5] Mobile string extraction     → requires [1], parallel with [4]
[6] Desktop locale init          → requires [1] + [2]
[7] Mobile locale init           → requires [1] + [2], parallel with [6]
[8] Settings screen language UI  → requires [2] + [4] + [6]
[9] typecheck key-parity script  → requires [1]
```
