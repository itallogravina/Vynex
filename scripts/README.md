# Vynex Monorepo Setup Script

Script automatizado para criar um monorepo Vynex completo do zero, independente das versões do sistema.

## O que o script faz

Automatiza toda a configuração de monorepo (T1-T6):

1. ✅ **Detecta seu SO** (Linux, macOS, Windows)
2. ✅ **Instala Rust** (requerido para Tauri)
3. ✅ **Instala dependências Tauri** (sistema)
4. ✅ **Configura Node.js v22 via nvm**
5. ✅ **Instala pnpm v11**
6. ✅ **Scaffolda estrutura completa** (root, shared, server, desktop, mobile)
7. ✅ **Executa `pnpm install`**
8. ✅ **Roda gates de verificação** (typecheck)
9. ✅ **Inicializa git repository**

## Pré-requisitos

- macOS, Linux (Ubuntu/Debian) ou Windows
- Acesso a `sudo` (para instalar deps Tauri no Linux)
- Conexão de internet (para baixar Node.js, pnpm, etc.)

## Uso

### Opção 1: Criar monorepo em novo diretório

```bash
./scripts/setup-monorepo.sh
# Cria diretório "vynex" e monta tudo lá
```

### Opção 2: Criar em diretório específico

```bash
./scripts/setup-monorepo.sh /caminho/para/novo-projeto
# ou
./scripts/setup-monorepo.sh ./meu-app
```

### Opção 3: Rodar de qualquer lugar

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/seu-repo/vynex/main/scripts/setup-monorepo.sh)
```

## O que é criado

```
vynex/
├── package.json                # Root workspace, scripts Turbo
├── pnpm-workspace.yaml        # Config pnpm v11 + hoisting
├── tsconfig.base.json         # Base TS compartilhada
├── packages/
│   └── shared/                # @vynex/shared (tipos, constantes)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/index.ts
├── apps/
│   ├── server/                # @vynex/server (Fastify)
│   ├── desktop/               # @vynex/desktop (Tauri + React)
│   └── mobile/                # @vynex/mobile (Expo + React Native)
└── .git/                       # Git repository
```

## Comandos após setup

```bash
cd vynex

# Desenvolvimento
pnpm dev              # Inicia todos os apps em paralelo
pnpm --filter @vynex/server dev    # Apenas server
pnpm --filter @vynex/desktop dev   # Apenas desktop (Tauri)
pnpm --filter @vynex/mobile dev    # Apenas mobile (Expo)

# Verificação
pnpm typecheck       # Typecheck tudo
pnpm build           # Build tudo
pnpm lint            # Lint (quando T9 estiver pronto)

# Próximas tarefas
# T7: Wire @vynex/shared imports
# T8: Configure turbo.json pipeline
# T9: Add ESLint + Prettier
```

## Variáveis de ambiente

```bash
# Customizar versão do Node.js
NODE_VERSION=20 ./scripts/setup-monorepo.sh

# Customizar versão do pnpm
PNPM_VERSION=10 ./scripts/setup-monorepo.sh
```

## Troubleshooting

### "sudo: a terminal is required"

Se pedir senha do `sudo` e não conseguir, rode `sudo -v` primeiro:
```bash
sudo -v
./scripts/setup-monorepo.sh
```

### "rustc not found" após instalação

Ative o Rust:
```bash
source "$HOME/.cargo/env"
./scripts/setup-monorepo.sh
```

### "nvm: command not found"

Reinicie o shell ou rode manualmente:
```bash
source "$HOME/.nvm/nvm.sh"
nvm use 22
./scripts/setup-monorepo.sh
```

### Tauri compile errors no Linux

Certifique-se que todas as deps foram instaladas:
```bash
sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libdbus-1-dev pkg-config build-essential
pnpm install
```

## Estrutura do script

| Função | Propósito |
|--------|-----------|
| `detect_os()` | Detecta SO (linux/macos/windows) |
| `install_rust()` | Instala Rust toolchain |
| `install_tauri_deps()` | Instala deps do sistema (Tauri) |
| `setup_nodejs()` | Instala nvm + Node.js v22 |
| `setup_pnpm()` | Instala pnpm v11 |
| `create_monorepo_structure()` | Scaffolda todos os arquivos |
| `init_git()` | Inicializa .git |
| `main()` | Orquestra tudo |

## Customização

Para adaptar a outro projeto, edite:

- `package.json` — altere `name: "vynex"` para seu projeto
- `apps/desktop/src-tauri/tauri.conf.json` — altere `identifier`
- `packages/shared/src/index.ts` — altere `VYNEX_VERSION`, types

## Próximas etapas (manual)

Após o script completar:

1. **T7** — Wire shared imports (rodar `pnpm typecheck`)
2. **T8** — Create `turbo.json` pipeline
3. **T9** — Add ESLint + Prettier root config

Veja `.specs/features/monorepo-setup/tasks.md` para detalhes.

## Licença

MIT — Use livremente
