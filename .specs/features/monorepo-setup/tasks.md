# Monorepo Setup Tasks

**Spec**: `.specs/features/monorepo-setup/spec.md`
**Status**: In Progress

---

## Execution Plan

### Phase 1: Root Foundation (Sequential)

```
T1 → T2
```

### Phase 2: Package Scaffolding (Parallel, after T2)

```
     ┌→ T3 [P] ─┐
     ├→ T4 [P] ─┤
T2 ──┤           ├──→ T7
     ├→ T5 [P] ─┤
     └→ T6 [P] ─┘
```

### Phase 3: Cross-Package Wiring (Sequential)

```
T7
```

### Phase 4: Orchestration Layer (Parallel, after T7)

```
     ┌→ T8 [P]
T7 ──┤
     └→ T9 [P]
```

---

## Task Breakdown

### T1: Root `package.json` + `pnpm-workspace.yaml`

**What**: Create the root workspace manifest and pnpm workspace declaration.
**Where**:
- `package.json`
- `pnpm-workspace.yaml`

**Depends on**: None
**Requirement**: MONO-01

**Files**:
- `package.json` — name `vynex`, `private: true`, `packageManager: pnpm@9.x`, root scripts delegating to `turbo run <task>`: `dev`, `build`, `lint`, `typecheck`, `format`; devDeps: `turbo`, `typescript`, `eslint`, `prettier`
- `pnpm-workspace.yaml` — `packages: ['apps/*', 'packages/*']`

**Done when**:
- [ ] `pnpm-workspace.yaml` exists and lists `apps/*` and `packages/*`
- [ ] Root `package.json` has `packageManager` field pinning pnpm version
- [ ] Root scripts include `dev`, `build`, `lint`, `typecheck`, `format` all delegating to `turbo run`
- [ ] `pnpm install` exits 0 from repo root

**Tests**: none
**Gate**: `pnpm install` exits 0
**Commit**: `chore: init pnpm workspace root`

---

### T2: Root `tsconfig.base.json`

**What**: Create the shared TypeScript base config extended by all apps and packages.
**Where**: `tsconfig.base.json`

**Depends on**: T1
**Requirement**: MONO-03

**Key settings**:
- `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`
- `strict: true`, `noUncheckedIndexedAccess: true`, `skipLibCheck: true`
- `paths: { "@vynex/shared": ["./packages/shared/src/index.ts"] }` — resolves import without build step in dev

**Done when**:
- [x] File exists at repo root with `strict: true` and `noUncheckedIndexedAccess: true`
- [x] `paths` alias `@vynex/shared` points to `packages/shared/src/index.ts`
- [x] `pnpm exec tsc --version` exits 0 (typescript installed)

**Tests**: none
**Gate**: `pnpm exec tsc --version` exits 0 ✅ (TypeScript 5.9.3)
**Commit**: `chore: add shared tsconfig base`
**Status**: Verified

---

### T3: `packages/shared` scaffold [P]

**What**: Create the `@vynex/shared` package with a `VYNEX_VERSION` seed export and a type stub — proves cross-package resolution before business types exist.
**Where**:
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/index.ts`

**Depends on**: T2
**Requirement**: MONO-04

**File details**:
- `package.json` — name `@vynex/shared`, `main: dist/index.js`, `types: dist/index.d.ts`, `exports` map with `types`/`import`/`default`, build script `tsc`, devDep `typescript`
- `tsconfig.json` — extends `../../tsconfig.base.json`, `outDir: dist`, `rootDir: src`, `declaration: true`, `declarationMap: true`
- `src/index.ts` — `export const VYNEX_VERSION = '0.1.0'` and `export type AppName = 'vynex'`

**Done when**:
- [x] `src/index.ts` exports `VYNEX_VERSION` and `AppName`
- [x] `pnpm --filter @vynex/shared build` emits `dist/index.js` and `dist/index.d.ts`
- [x] Package name `@vynex/shared` resolves as a local workspace package

**Tests**: none
**Gate**: `pnpm --filter @vynex/shared build` exits 0 ✅
**Commit**: `chore(shared): scaffold @vynex/shared package`
**Status**: Verified

---

### T4: `apps/server` scaffold [P]

**What**: Create the Fastify server shell with a `/health` endpoint and `tsx` watch mode for hot-restart on save.
**Where**:
- `apps/server/package.json`
- `apps/server/tsconfig.json`
- `apps/server/src/index.ts`

**Depends on**: T2
**Requirement**: MONO-05

**File details**:
- `package.json` — name `@vynex/server`, scripts: `dev: tsx watch src/index.ts`, `build: tsc`, `typecheck: tsc --noEmit`; deps: `fastify`; devDeps: `tsx`, `typescript`, `@types/node`
- `tsconfig.json` — extends `../../tsconfig.base.json`, override `module: CommonJS` and `moduleResolution: node` (Node.js runtime requirement)
- `src/index.ts` — create Fastify instance, register `GET /health` returning `{ status: 'ok', app: 'vynex-server' }`, listen on `process.env.PORT ?? 3000`, log listening address on start

**Done when**:
- [x] `pnpm --filter @vynex/server dev` starts Fastify without errors
- [x] `curl http://localhost:3001/health` returns `{"status":"ok","app":"vynex-server"}`
- [x] Saving `src/index.ts` triggers server restart (tsx watch)
- [x] `PORT=3001 pnpm --filter @vynex/server dev` binds to 3001
- [x] `pnpm --filter @vynex/server typecheck` exits 0

**Tests**: none
**Gate**: `pnpm --filter @vynex/server typecheck` exits 0 ✅; `curl` smoke test ✅
**Commit**: `feat(server): scaffold Fastify server with /health endpoint`
**Status**: Verified

---

### T5: `apps/desktop` scaffold [P]

**What**: Create the Tauri + React + Vite desktop app shell that opens a native window titled "Vynex" with React HMR.
**Where**:
- `apps/desktop/package.json`
- `apps/desktop/tsconfig.json`
- `apps/desktop/vite.config.ts`
- `apps/desktop/index.html`
- `apps/desktop/src/main.tsx`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/src-tauri/src/main.rs`
- `apps/desktop/src-tauri/build.rs`

**Depends on**: T2
**Requirement**: MONO-06

**File details**:
- `package.json` — name `@vynex/desktop`, scripts: `dev: tauri dev`, `build: tauri build`, `typecheck: tsc --noEmit`; deps: `react`, `react-dom`; devDeps: `@tauri-apps/cli@^2`, `@tauri-apps/api@^2`, `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`
- `vite.config.ts` — React plugin, `server.port: 1420`, `server.strictPort: true` (Tauri requires fixed port)
- `index.html` — minimal HTML with `<div id="root">` and `<script type="module" src="/src/main.tsx">`
- `src/main.tsx` — `ReactDOM.createRoot(document.getElementById('root')!).render(<App />)`
- `src/App.tsx` — renders `<main><h1>Vynex</h1></main>`
- `tsconfig.json` — extends `../../tsconfig.base.json`, `lib: ["DOM", "DOM.Iterable", "ESNext"]`
- `src-tauri/tauri.conf.json` — `productName: "Vynex"`, `windows[0].title: "Vynex"`, `devUrl: "http://localhost:1420"`, `frontendDist: "../dist"`
- `src-tauri/Cargo.toml` — `[package] name = "vynex-desktop"`, `[dependencies] tauri = { version = "2", features = [] }`
- `src-tauri/src/main.rs` — `fn main() { tauri::Builder::default().run(...).expect("error") }`
- `src-tauri/build.rs` — `fn main() { tauri_build::build() }`

**Note**: Requires Rust toolchain (`rustup`) pre-installed. Run `rustup update stable` before this task.

**Done when**:
- [ ] `pnpm --filter @vynex/desktop dev` opens a native window with title "Vynex"
- [ ] Editing `src/App.tsx` triggers hot reload in the open window
- [ ] `pnpm --filter @vynex/desktop typecheck` exits 0

**Tests**: none
**Gate**: `pnpm --filter @vynex/desktop typecheck` exits 0; manual visual smoke test
**Commit**: `feat(desktop): scaffold Tauri + React desktop shell`

---

### T6: `apps/mobile` scaffold [P]

**What**: Create the Expo React Native app shell that renders "Vynex Mobile" on a simulator or device.
**Where**:
- `apps/mobile/package.json`
- `apps/mobile/tsconfig.json`
- `apps/mobile/app.json`
- `apps/mobile/index.ts`
- `apps/mobile/src/App.tsx`

**Depends on**: T2
**Requirement**: MONO-07

**File details**:
- `package.json` — name `@vynex/mobile`, scripts: `dev: expo start`, `typecheck: tsc --noEmit`; deps: `expo`, `expo-status-bar`, `react`, `react-native`; devDeps: `typescript`, `@types/react`, `@babel/core`
- `tsconfig.json` — extends `../../tsconfig.base.json` then `expo/tsconfig.base` (Expo overrides some settings for RN compatibility)
- `app.json` — `name: "Vynex"`, `slug: "vynex"`, `version: "1.0.0"`, `platforms: ["ios", "android"]`
- `index.ts` — `import { registerRootComponent } from 'expo'; import App from './src/App'; registerRootComponent(App);`
- `src/App.tsx` — renders `<View><Text>Vynex Mobile</Text></View>` with basic styles

**Done when**:
- [ ] `pnpm --filter @vynex/mobile dev` starts Expo without errors (QR code or simulator)
- [ ] App renders "Vynex Mobile" on screen
- [x] `pnpm --filter @vynex/mobile typecheck` exits 0

**Tests**: none
**Gate**: `pnpm --filter @vynex/mobile typecheck` exits 0 ✅; manual Expo smoke test
**Commit**: `feat(mobile): scaffold Expo mobile shell`

---

### T7: Wire `@vynex/shared` imports + end-to-end typecheck

**What**: Add `"@vynex/shared": "workspace:*"` to each app's dependencies and import `VYNEX_VERSION` in all three apps; verify `pnpm typecheck` passes cleanly across the entire monorepo.
**Where**:
- `apps/server/package.json` — add `@vynex/shared` dep
- `apps/server/src/index.ts` — add import and log `VYNEX_VERSION`
- `apps/desktop/package.json` — add `@vynex/shared` dep
- `apps/desktop/src/App.tsx` — add import and render version in footer
- `apps/mobile/package.json` — add `@vynex/shared` dep
- `apps/mobile/src/App.tsx` — add import and render version

**Depends on**: T3, T4, T5, T6
**Requirement**: MONO-03, MONO-04

**Done when**:
- [x] `pnpm install` exits 0 after adding workspace deps
- [x] `pnpm typecheck` from repo root exits 0 across all 4 packages
- [x] Server logs `VYNEX_VERSION` on startup
- [x] Introducing a deliberate type error in `packages/shared/src/index.ts` causes `pnpm typecheck` to fail
- [x] Reverting the error restores clean typecheck

**Verify**:
```
pnpm --filter '@vynex/*' typecheck
# Expected: exit 0, no errors reported
```

**Tests**: none
**Gate**: `pnpm --filter '@vynex/*' typecheck` exits 0 ✅
**Commit**: `chore: wire @vynex/shared imports across all apps`
**Status**: Verified

---

### T8: `turbo.json` pipeline configuration [P]

**What**: Create `turbo.json` with build, dev, lint, typecheck, and format pipelines that enforce correct execution order (shared → apps) and enable caching.
**Where**: `turbo.json`

**Depends on**: T7
**Requirement**: MONO-02, MONO-08

**Pipeline spec**:
```json
{
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**"], "cache": true },
    "dev":       { "dependsOn": ["^build"], "persistent": true, "cache": false },
    "typecheck": { "dependsOn": ["^typecheck"], "cache": true },
    "lint":      { "cache": true },
    "format":    { "cache": false }
  }
}
```

**Done when**:
- [ ] `pnpm dev` from root starts all three app dev scripts in parallel
- [ ] `pnpm build` builds `@vynex/shared` before apps (dependency order respected)
- [ ] Second `pnpm build` run shows Turborepo cache hits (no changed files)
- [ ] `pnpm --filter @vynex/server dev` starts only the server

**Tests**: none
**Gate**: `pnpm build` exits 0; second run shows cache hits
**Commit**: `chore: configure Turborepo pipeline`

---

### T9: ESLint + Prettier root configuration [P]

**What**: Add root-level ESLint (flat config) and Prettier configs that apply to all TypeScript files in `apps/` and `packages/`.
**Where**:
- `eslint.config.js`
- `.prettierrc`
- `.prettierignore`

**Depends on**: T7
**Requirement**: MONO-09

**File details**:
- `eslint.config.js` — flat config using `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser`; rules: `@typescript-eslint/no-unused-vars: error`, `@typescript-eslint/no-explicit-any: warn`; ignores: `**/dist/**`, `**/node_modules/**`, `**/src-tauri/**`
- `.prettierrc` — `{ "semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "es5" }`
- `.prettierignore` — `dist/`, `node_modules/`, `src-tauri/`, `.expo/`

Root devDeps to add: `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `prettier`, `eslint-config-prettier`

**Done when**:
- [ ] `pnpm lint` exits 0 on the clean scaffolded codebase
- [ ] Adding an unused variable to any app file causes `pnpm lint` to report an error
- [ ] `pnpm format` runs without errors and formats `.ts`/`.tsx` files

**Tests**: none
**Gate**: `pnpm lint` exits 0 on clean code; reports error on unused variable
**Commit**: `chore: add ESLint and Prettier root config`

---

## Diagram-Definition Cross-Check

| Task | Depends on (task body) | Diagram shows | Status |
|------|------------------------|---------------|--------|
| T1 | None | Start → T1 | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 [P] | ✅ |
| T4 | T2 | T2 → T4 [P] | ✅ |
| T5 | T2 | T2 → T5 [P] | ✅ |
| T6 | T2 | T2 → T6 [P] | ✅ |
| T7 | T3, T4, T5, T6 | all Phase 2 → T7 | ✅ |
| T8 | T7 | T7 → T8 [P] | ✅ |
| T9 | T7 | T7 → T9 [P] | ✅ |

---

## Test Co-location Validation

No TESTING.md (greenfield). This feature is pure scaffolding — no business logic, no unit tests required. All verification is via `tsc --noEmit` gates and manual smoke runs.

| Task | Code layer | Test type | Gate |
|------|-----------|-----------|------|
| T1 | Workspace config | none | `pnpm install` exits 0 |
| T2 | TS base config | none | `tsc --version` |
| T3 | Shared package | none | `pnpm --filter @vynex/shared build` |
| T4 | Fastify server | none | typecheck + `curl` smoke |
| T5 | Tauri desktop shell | none | typecheck + visual smoke |
| T6 | Expo mobile shell | none | typecheck + visual smoke |
| T7 | Cross-package wiring | none | `pnpm typecheck` (root) |
| T8 | Turborepo pipeline | none | build + cache hit |
| T9 | Lint/format config | none | `pnpm lint` clean + violation |

---

## Requirement Traceability

| Requirement ID | Story | Covered by | Status |
|---|---|---|---|
| MONO-01 | Unified workspace bootstrap | T1 | Verified |
| MONO-02 | Single dev command starts all apps | T8 | Pending |
| MONO-03 | TypeScript end-to-end with shared base config | T2, T7 | Pending |
| MONO-04 | packages/shared importable in all apps | T3, T7 | Pending |
| MONO-05 | Fastify server shell | T4 | Pending |
| MONO-06 | Tauri desktop shell | T5 | Pending |
| MONO-07 | Expo mobile shell | T6 | Pending |
| MONO-08 | Turborepo pipeline with caching | T8 | Pending |
| MONO-09 | ESLint + Prettier at root | T9 | Pending |

**Coverage: 9/9 ✅**
