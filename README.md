# Vynex

Sistema de gestão multiplatforma para restaurantes, boates e eventos. Roteamento de pedidos em tempo real com operação **offline-first** — funciona mesmo sem internet e sincroniza quando a conexão volta.

---

## O que é

Vynex é um POS (ponto de venda) dividido em três partes:

| App | Tecnologia | Finalidade |
|---|---|---|
| **Servidor** | Node.js + Fastify | API REST + WebSocket; banco SQLite local com sync opcional para nuvem (Turso) |
| **Desktop** | React + Tauri | Painel do operador: filas de cozinha/bar, mesas, caixa, relatórios, menu |
| **Mobile** | Expo (React Native) | Garçom: abrir pedidos, adicionar itens, fechar conta |

**Idiomas suportados:** PT-BR (padrão) e EN-US — alternável nas configurações.

---

## Pré-requisitos

- [Node.js](https://nodejs.org) 22+
- [pnpm](https://pnpm.io) 11+
- [Rust](https://rustup.rs) (só para o app desktop)

```bash
# Instalar pnpm (se não tiver)
npm install -g pnpm

# Instalar Rust (se for rodar o desktop)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

---

## Estrutura do monorepo

```
apps/
  server/     → API Fastify (porta 3000)
  desktop/    → App Tauri (operador)
  mobile/     → App Expo (garçom)
packages/
  shared/     → Tipos TypeScript compartilhados
  i18n/       → Traduções PT-BR / EN-US
installer/    → Script NSIS para gerar instalador Windows
```

---

## Rodando localmente

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Configurar variáveis de ambiente do servidor

```bash
cp apps/server/.env.example apps/server/.env
```

O arquivo `.env` já vem com valores padrão para desenvolvimento local — não precisa mudar nada para rodar.

| Variável | Padrão | Descrição |
|---|---|---|
| `DB_PATH` | `./vynex.db` | Caminho do banco SQLite |
| `PORT` | `3000` | Porta do servidor |
| `TURSO_DATABASE_URL` | _(vazio)_ | URL do banco Turso (opcional — sync cloud) |
| `TURSO_AUTH_TOKEN` | _(vazio)_ | Token do Turso (opcional) |
| `SYNC_INTERVAL_SECONDS` | `60` | Frequência de sync em segundos |

### 3. Iniciar o servidor

```bash
pnpm --filter @vynex/server dev
```

O servidor sobe em `http://localhost:3000`. Endpoint de saúde: `GET /health`.

### 4. Iniciar o desktop (operador)

Em outro terminal:

```bash
pnpm --filter @vynex/desktop dev
```

Abre a janela Tauri. Na primeira execução, o Rust compila os bindings — leva alguns minutos.

### 5. Iniciar o mobile (garçom)

Em outro terminal:

```bash
pnpm --filter @vynex/mobile dev
```

Abre o Expo no navegador (`http://localhost:8081`). Para testar no celular, use `pnpm --filter @vynex/mobile dev1` e escaneie o QR code com o app Expo Go.

Na tela inicial, informe a URL do servidor (ex: `http://192.168.0.X:3000`) e clique em "Testar conexão".

---

## Produção (Windows)

O Vynex é distribuído como um instalador `.exe` que instala o servidor como **serviço Windows** (via NSSM) e o app desktop separadamente.

### Gerar o executável do servidor

```bash
pnpm --filter @vynex/server build:exe
```

Gera `installer/assets/vynex-server.exe` — binário autocontido do Node.js.

### Gerar o instalador do app desktop

```bash
pnpm --filter @vynex/desktop build
```

Gera o instalador `.msi`/`.exe` do app Tauri em `apps/desktop/src-tauri/target/release/bundle/`.

### Gerar o instalador completo (servidor + desktop + serviço Windows)

> Requer NSIS instalado: `choco install nsis` (Windows) ou `sudo apt install nsis` (Linux cross-compila)

```bash
bash installer/build.sh
```

Gera `installer/vynex-server-setup.exe` — instala o servidor como serviço Windows e o configura para iniciar automaticamente com o sistema.

### Sync com nuvem (opcional)

Para habilitar backup e sync entre instalações, configure as variáveis Turso no `.env` de produção:

```env
TURSO_DATABASE_URL=libsql://seu-banco.turso.io
TURSO_AUTH_TOKEN=seu-token
SYNC_INTERVAL_SECONDS=60
```

Sem essas variáveis, o banco funciona somente local (SQLite puro).

---

## Comandos úteis

```bash
# Verificar tipos em todos os apps
pnpm typecheck

# Lint
pnpm lint

# Formatar código
pnpm format

# Typecheck individual
pnpm --filter @vynex/server typecheck
pnpm --filter @vynex/desktop typecheck
pnpm --filter @vynex/mobile typecheck
```

---

## Tech stack

- **TypeScript** end-to-end
- **Fastify** — servidor HTTP + WebSocket
- **libSQL / Turso** — SQLite local com sync cloud opcional
- **React 19** — UI desktop e mobile
- **Tauri 2** — shell nativo para Windows (gera `.exe`)
- **Expo / React Native** — app mobile (iOS, Android, Web)
- **pnpm workspaces + Turborepo** — monorepo
