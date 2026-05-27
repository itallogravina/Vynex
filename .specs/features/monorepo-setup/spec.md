# Monorepo Setup Specification

## Problem Statement

Vynex spans three runtimes — desktop (Tauri), mobile (Expo), and a local server (Fastify) — all in TypeScript. Without a monorepo, types and utilities would be duplicated across apps, dev workflows would require managing multiple terminals and `npm install` contexts, and there would be no single source of truth for shared contracts (API types, domain models). The monorepo is the foundation everything else is built on top of.

## Goals

- [ ] Single repository with one `pnpm install` and one `pnpm dev` command that starts all apps
- [ ] TypeScript configured end-to-end with a shared base config and path aliases
- [ ] `packages/shared` importable from all three apps with full type safety
- [ ] Each app (desktop, mobile, server) buildable and runnable in isolation
- [ ] Turborepo orchestrates build/dev/lint tasks with correct dependency order and caching

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---|---|
| App business logic (tables, orders, menus) | M1 features — monorepo is structural scaffolding only |
| Database setup / SQLite integration | Separate feature |
| WebSocket real-time layer | Separate feature |
| CI/CD pipelines | Post-scaffolding concern |
| Windows installer packaging (full Tauri build) | Separate feature — this spec only requires Tauri shell to run in dev mode |
| Expo EAS / production build config | Out of M1 scope |
| Git hooks (lint-staged, husky) | Nice-to-have, deferred |

---

## User Stories

### P1: Unified workspace bootstrap ⭐ MVP

**User Story**: As a developer, I want to run `pnpm install` once at the repo root and have all apps and packages ready to use so I never manage multiple install contexts.

**Why P1**: Every other story depends on this. Nothing works until the workspace resolves.

**Acceptance Criteria**:

1. WHEN `pnpm install` runs at the repo root THEN all three apps and `packages/shared` resolve their dependencies without errors
2. WHEN a new dependency is added to one app THEN it does not pollute the other apps' node_modules
3. WHEN `packages/shared` is referenced by an app THEN pnpm resolves it as a local workspace package (not from npm)

**Independent Test**: `pnpm install` succeeds from a clean clone; `node -e "require('./packages/shared')"` resolves without error.

---

### P1: Single dev command starts all apps ⭐ MVP

**User Story**: As a developer, I want `pnpm dev` at the root to start desktop, mobile, and server simultaneously so I can work across the stack in one terminal session.

**Why P1**: Without this, every development session requires manually starting three processes. Unacceptable for a solo developer.

**Acceptance Criteria**:

1. WHEN `pnpm dev` runs at the root THEN Turborepo starts `dev` in `apps/desktop`, `apps/mobile`, and `apps/server` in parallel
2. WHEN `apps/server` fails to start THEN `apps/desktop` and `apps/mobile` continue running independently
3. WHEN the developer presses Ctrl+C THEN all three processes are terminated cleanly
4. WHEN any app's `dev` script is run directly (e.g., `pnpm --filter @vynex/server dev`) THEN it starts that app alone without requiring the others

**Independent Test**: `pnpm dev` outputs start messages from all three apps within 30 seconds.

---

### P1: TypeScript end-to-end with shared base config ⭐ MVP

**User Story**: As a developer, I want TypeScript configured across all apps and packages from a single `tsconfig.base.json` so that compiler settings are consistent and I don't maintain four separate configs.

**Why P1**: Type safety across the stack is a core constraint. Without a shared base, configs drift and cross-package type checking breaks.

**Acceptance Criteria**:

1. WHEN a file in `packages/shared` exports a type THEN that type is usable in all three apps with full IntelliSense and no `any` leakage
2. WHEN a type error is introduced in `packages/shared` THEN `tsc` run from the root reports the error in all consuming apps
3. WHEN `pnpm typecheck` runs at the root THEN Turborepo runs `tsc --noEmit` in all packages and apps in dependency order
4. WHEN an app imports from `@vynex/shared` THEN TypeScript resolves the path alias without requiring a build step (via `paths` in tsconfig)

**Independent Test**: Add a deliberate type error in `packages/shared/src/index.ts`; run `pnpm typecheck` from root; confirm error is reported in at least one consuming app.

---

### P1: packages/shared importable in all apps ⭐ MVP

**User Story**: As a developer, I want a `packages/shared` package for domain types, constants, and utilities so that contracts between apps are defined once and never duplicated.

**Why P1**: Shared types (e.g., `Order`, `Table`, `MenuItem`) must be the same object across server and client. Duplication leads to drift.

**Acceptance Criteria**:

1. WHEN a type is exported from `packages/shared/src/index.ts` THEN it can be imported in `apps/desktop`, `apps/mobile`, and `apps/server` as `import { X } from '@vynex/shared'`
2. WHEN `packages/shared` is modified THEN apps consuming it pick up the changes on next dev server HMR cycle (no manual rebuild required in dev)
3. WHEN `packages/shared` is built THEN it emits type declarations (`.d.ts`) alongside compiled JS

**Independent Test**: Export a `VYNEX_VERSION` constant from shared; import and log it in the server's startup; confirm it prints.

---

### P1: Fastify server shell ⭐ MVP

**User Story**: As a developer, I want `apps/server` to be a running Fastify app with a health-check endpoint so I have a working backend to build on.

**Why P1**: The server is the backbone — order routing, WebSockets, and all API endpoints live here.

**Acceptance Criteria**:

1. WHEN `pnpm dev` runs in `apps/server` THEN Fastify starts on `localhost:3000` (configurable via env)
2. WHEN `GET /health` is requested THEN server SHALL respond `200 OK` with `{ status: 'ok', app: 'vynex-server' }`
3. WHEN a TypeScript file in `apps/server/src` is saved THEN the server restarts automatically (watch mode)
4. WHEN `PORT` env variable is set THEN server SHALL bind to that port instead of the default

**Independent Test**: `curl http://localhost:3000/health` returns `{ "status": "ok" }`.

---

### P1: Tauri desktop shell ⭐ MVP

**User Story**: As a developer, I want `apps/desktop` to be a running Tauri + React app so I have a working desktop shell to build the POS UI in.

**Why P1**: Tauri is the delivery vehicle for the Windows installer. The shell must exist and run before any UI work can start.

**Acceptance Criteria**:

1. WHEN `pnpm dev` runs in `apps/desktop` THEN Tauri opens a native window with the React app loaded
2. WHEN a React component in `apps/desktop/src` is saved THEN the window hot-reloads the change
3. WHEN `pnpm build` runs in `apps/desktop` THEN Tauri produces a platform binary in `apps/desktop/src-tauri/target/`
4. WHEN the app is running THEN the window title SHALL display "Vynex"

**Independent Test**: `pnpm dev` in `apps/desktop` opens a native window showing a React-rendered heading.

---

### P1: Expo mobile shell ⭐ MVP

**User Story**: As a developer, I want `apps/mobile` to be a running Expo app so I have a working mobile shell for the tablet UI.

**Why P1**: Waitstaff use tablets for order-taking. The Expo shell must exist before any mobile UI work.

**Acceptance Criteria**:

1. WHEN `pnpm dev` runs in `apps/mobile` THEN Expo starts and displays a QR code or opens a simulator
2. WHEN a component in `apps/mobile/src` is saved THEN Expo fast-refreshes the change
3. WHEN the app loads THEN it SHALL display an initial screen with the text "Vynex Mobile"

**Independent Test**: Expo starts without errors and renders on a simulator or physical device.

---

### P2: Turborepo pipeline with caching

**User Story**: As a developer, I want Turborepo to cache build and lint outputs so that unchanged packages don't rebuild on every `pnpm build` or `pnpm lint` run.

**Why P2**: Not blocking for initial scaffolding but immediately saves time as packages grow. Correct pipeline ordering (shared → apps) prevents stale builds.

**Acceptance Criteria**:

1. WHEN `pnpm build` runs twice without changes THEN the second run uses Turborepo cache and reports "FULL TURBO" or equivalent
2. WHEN `packages/shared` changes THEN only `shared` and its downstream apps rebuild; unaffected apps are served from cache
3. WHEN `pnpm lint` runs THEN it executes in all packages in parallel

**Independent Test**: Run `pnpm build` twice; confirm second run is significantly faster and shows cache hits.

---

### P2: ESLint + Prettier configured at root

**User Story**: As a developer, I want a single ESLint and Prettier config at the root applied to all packages so code style is consistent across the monorepo.

**Why P2**: Catches bugs early and keeps code consistent. Not blocking for initial dev but worth setting up before business logic begins.

**Acceptance Criteria**:

1. WHEN `pnpm lint` runs at the root THEN ESLint checks all `.ts` and `.tsx` files in `apps/` and `packages/`
2. WHEN `pnpm format` runs at the root THEN Prettier formats all files according to the root config
3. WHEN a file violates an ESLint rule THEN the violation is reported with file path and line number

**Independent Test**: Introduce a deliberate lint violation (e.g., unused variable); `pnpm lint` reports it.

---

## Edge Cases

- WHEN `apps/server` is not running THEN `apps/desktop` and `apps/mobile` SHALL start without errors (they don't depend on the server at startup)
- WHEN `packages/shared` has a build error THEN `pnpm dev` SHALL report the error clearly rather than silently failing in consuming apps
- WHEN the developer clones the repo on a machine without pnpm THEN the root `package.json` SHALL specify the required pnpm version via `packageManager` field
- WHEN Tauri prerequisites (Rust toolchain) are missing THEN `pnpm dev` in `apps/desktop` SHALL fail with a clear error message from Tauri CLI, not a cryptic Node error

---

## Directory Structure

```
vynex/
├── apps/
│   ├── desktop/              # React + Tauri
│   │   ├── src/              # React source
│   │   ├── src-tauri/        # Rust + Tauri config
│   │   ├── package.json      # name: @vynex/desktop
│   │   └── tsconfig.json     # extends ../../tsconfig.base.json
│   ├── mobile/               # Expo (React Native)
│   │   ├── src/
│   │   ├── app.json
│   │   ├── package.json      # name: @vynex/mobile
│   │   └── tsconfig.json
│   └── server/               # Node.js + Fastify
│       ├── src/
│       ├── package.json      # name: @vynex/server
│       └── tsconfig.json
├── packages/
│   └── shared/               # Shared types, utils, constants
│       ├── src/
│       │   └── index.ts
│       ├── package.json      # name: @vynex/shared
│       └── tsconfig.json
├── turbo.json                # Pipeline: build, dev, lint, typecheck
├── pnpm-workspace.yaml       # Declares apps/* and packages/*
├── package.json              # Root: scripts, devDependencies (eslint, prettier, turbo)
├── tsconfig.base.json        # Base TS config extended by all packages
├── .eslintrc.js              # Root ESLint config
└── .prettierrc               # Root Prettier config
```

---

## Requirement Traceability

| Requirement ID | Story | Status |
|---|---|---|
| MONO-01 | P1: Unified workspace bootstrap | Pending |
| MONO-02 | P1: Single dev command starts all apps | Pending |
| MONO-03 | P1: TypeScript end-to-end with shared base config | Pending |
| MONO-04 | P1: packages/shared importable in all apps | Pending |
| MONO-05 | P1: Fastify server shell | Pending |
| MONO-06 | P1: Tauri desktop shell | Pending |
| MONO-07 | P1: Expo mobile shell | Pending |
| MONO-08 | P2: Turborepo pipeline with caching | Pending |
| MONO-09 | P2: ESLint + Prettier at root | Pending |

**Coverage:** 9 total, 0 mapped to tasks, 9 unmapped ⚠️

---

## Success Criteria

- [ ] `pnpm install && pnpm dev` from a clean clone starts all three apps with no manual steps
- [ ] A type exported from `packages/shared` is usable in all three apps with full IntelliSense
- [ ] `curl localhost:3000/health` returns `{ "status": "ok" }`
- [ ] Tauri opens a native window with the React app loaded
- [ ] Expo renders on a simulator or device
