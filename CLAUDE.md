# Vynex — Instruções para o Claude Code

Sistema multiplatforma de gestão para restaurantes, boates e eventos. Offline-first + hybrid deployment são não-negociáveis. Desenvolvedor solo.

---

## Estrutura do Monorepo

```
apps/
  server/     — Node.js + Fastify (backend local embutido)
  desktop/    — React + Tauri (app Windows, gera .exe)
  mobile/     — Expo / React Native (tablets Android/iOS para garçons)
packages/
  shared/     — Tipos TypeScript compartilhados entre todos os apps
  i18n/       — Strings de tradução PT-BR / EN-US
.specs/
  project/    — PROJECT.md, ROADMAP.md, STATE.md (fonte da verdade do projeto)
  features/   — Specs e tasks por feature (spec.md + tasks.md por pasta)
docs/         — Docs de milestones anteriores (referência histórica)
installer/    — NSIS + nssm para gerar instalador Windows Service
```

**Package manager:** pnpm v11 | **Build system:** Turborepo | **Node:** v22 (obrigatório — pnpm v11 requer v22.13+)

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Linguagem | TypeScript end-to-end |
| Desktop | React 19 + Tauri 2 (Vite) |
| Mobile | Expo ~54 + React Native 0.81 |
| Backend | Node.js 22 + Fastify 5 |
| DB local | libSQL / SQLite (via `@libsql/client`) |
| DB cloud | libSQL/Turso embedded replica (M3+) |
| Real-time | WebSockets nativos via `@fastify/websocket` |
| Auth | JWT via `@fastify/jwt` + bcryptjs |
| Gráficos | Recharts (desktop) |

---

## Comandos

```bash
# Rodar tudo em dev
pnpm dev

# Apps individuais
pnpm --filter @vynex/server dev       # servidor na porta 3000
pnpm --filter @vynex/desktop dev      # Tauri dev (abre janela)
pnpm --filter @vynex/mobile dev       # Expo (QR code ou emulador)

# Typecheck
pnpm typecheck
pnpm --filter @vynex/server tsc --noEmit
pnpm --filter @vynex/mobile tsc --noEmit

# Build
pnpm build
pnpm --filter @vynex/server build:exe   # gera .exe para Windows

# Lint / format
pnpm lint
pnpm format
```

---

## Servidor (`apps/server/`)

```
src/
  index.ts          — entry point; registra plugins e rotas
  db/
    schema.sql      — DDL completo; rodado em todo startup via executeMultiple()
    init.ts         — runMigrations() (ALTER TABLEs, índices novos)
    queries.ts      — todas as queries SQL; sem SQL fora deste arquivo
    sync.ts         — sync com Turso cloud
  routes/           — uma rota por domínio
    auth.ts, users.ts, tables.ts, menu.ts, orders.ts,
    promotions.ts, combos.ts, reports.ts, floor-map.ts,
    table-ops.ts, cashier-closing.ts
  middleware/       — requireRole (guards de acesso por role)
  ws/               — handlers WebSocket (roteamento em tempo real)
  types/            — tipos internos do servidor
```

**Regra crítica:** `schema.sql` roda antes das migrations. Nunca adicionar índices sobre colunas criadas por migration no `schema.sql` — o índice vai para a migration, depois do `ALTER TABLE`.

**Porta padrão:** 3000. Configurável via `.env` (ver `.env.example`).

**DB:** `vynex.db` na raiz de `apps/server/`. Arquivo ignorado pelo git (dados locais).

---

## Desktop (`apps/desktop/`)

```
src/
  App.tsx           — roteamento de telas + auth guard
  screens/          — uma tela por arquivo
    OrderScreen, KitchenScreen, BarScreen, CashierScreen,
    MenuManagementScreen, TableManagementScreen, FloorMapScreen,
    UserManagementScreen, PromotionsManagementScreen,
    CombosManagementScreen, ReportsScreen, SettingsScreen, LoginScreen
  components/       — componentes reutilizáveis
  hooks/            — hooks de dados (useOrder, useMenu, useOfflineQueue...)
  context/          — AuthContext
  styles/           — CSS por tela (nome espelha o componente)
src-tauri/          — config Rust/Tauri (não editar salvo necessidade)
```

---

## Mobile (`apps/mobile/`)

```
src/
  App.tsx           — navegação: ServerSetup → Login → Order
  screens/
    ServerSetupScreen — configura IP do servidor
    LoginScreen       — auth (PIN / senha / lista)
    OrderScreen       — tomar pedidos (tela principal do garçom)
  components/       — componentes da UI mobile
  hooks/            — useOfflineQueue, useServerUrl
  context/          — AuthContext
```

---

## Shared (`packages/shared/`)

Tipos TypeScript puros — sem lógica. Exporta tudo de `src/index.ts`. Usado por todos os apps via alias `@vynex/shared`.

Tipos principais: `Order`, `OrderItem`, `MenuItem`, `Category`, `Table`, `User`, `Promotion`, `ComboBundle`, `RoutingZone`, `UserRole`, `ConfirmRoutingResponse`.

---

## Modelo de Dados (tabelas principais)

| Tabela | Descrição |
|--------|-----------|
| `venues` | Estabelecimento (único por DB em v1) |
| `tables` | Mesas com posição x/y para o floor map |
| `categories` | Categorias do menu com zona de roteamento + janela de horário |
| `menu_items` | Itens com `routing_zone`, `prep_time_seconds`, `eightysixed_at` |
| `item_variation_groups/options` | Grupos de variação por item (ex: "Ponto", "Tamanho") |
| `orders` | Pedidos por mesa; `routing_mode`: manual/auto |
| `order_items` | Itens do pedido; `routed_at NULL` = aguardando confirmação; `final_price` = snapshot no momento da adição |
| `order_item_variations` | Variações selecionadas por item do pedido |
| `promotions` | Descontos por tempo (% ou fixo) em item/categoria |
| `combo_bundles` / `combo_bundle_items` | Bundles de preço fixo |
| `users` | Staff com roles; login via PIN, senha ou seleção da lista |
| `sessions` | JWT sessions |
| `cashier_closings` | Fechamentos de caixa diários |

---

## Roles

`owner` > `manager` > `cashier` > `waiter` > `bartender` / `kitchen`

Guard: `requireRole(role)` middleware em `apps/server/src/middleware/`.

---

## Convenções

**TypeScript:** strict mode + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. Sem `any` sem justificativa.

**Formatting:** Prettier — sem ponto-e-vírgula, aspas simples, print width 100, trailing comma ES5.

**Commits:** `type(scope): mensagem` — ex: `feat(M6): ...`, `fix(M6): ...`, `docs(M6): ...`

**Preços:** sempre usar `COALESCE(oi.final_price, mi.price)` em queries de receita — `final_price` contém o preço snapshotado com desconto/variação.

**Migrations:** migrations novas vão em `apps/server/src/db/init.ts` na função `runMigrations()`, nunca direto no `schema.sql`.

---

## Estado Atual do Projeto

**Branch ativa:** `future/M5-M7`

**Milestone em andamento:** M6 — Eventos, Analytics & Impressão

| Milestone | Status |
|-----------|--------|
| M1 — Fundação | ✅ Completo |
| M2 — UI & Estabilidade | ✅ Completo |
| M3 — Cloud Sync & Deploy | ✅ Completo |
| M4 — Auth, Roles & Relatórios | ✅ Completo |
| M5 — Operações & UX | ✅ Completo |
| M6 — Eventos, Analytics & Impressão | 🔜 Em andamento |
| M7 — Integrações & Compliance | 🔜 Planejado |

**M6 concluído:** Promoções & Combos, etapa de revisão de pedido antes do roteamento.

**M6 pendente:** Reservas, QR code por mesa, VIP list, controle de capacidade, fotos de produto, comanda física, consumo mínimo, analytics avançado, impressora térmica, recibos.

Fonte da verdade detalhada: `.specs/project/ROADMAP.md` e `.specs/project/STATE.md`.

---

## Obsidian — Atualização ao Encerrar Sessão

Vault localizada em: `~/Documentos/MeuSegundoCerebro/MeuSegundoCerebro/Projetos/Vynex/`

Quando eu disser "sessão encerrada" ou "atualiza obsidian", faça:
1. Decisões técnicas tomadas → crie/atualize nota em `Decisoes/`
2. Problemas resolvidos → crie/atualize nota em `Problemas Resolvidos/`
3. Novas features discutidas → crie/atualize nota em `Features/`
4. Aprendizados → crie/atualize nota em `Aprendizados/`
5. Atualize `PROJECT.md` e `ROADMAP.md` da vault com qualquer mudança relevante

---

## Obsidian — Ao Concluir um Milestone

Quando um milestone do ROADMAP for marcado como concluído:
1. Marque como ✅ no `ROADMAP.md` do projeto
2. Crie a pasta `.specs/features/[nome-do-milestone]/` com:
   - `spec.md` — o que foi construído e decisões tomadas
   - `tasks.md` — tasks concluídas
   - `aprendizados.md` — aprendizados do milestone
3. Na vault do Obsidian, crie `Projetos/Vynex/Features/[nome-do-milestone]/` com as mesmas notas
4. Atualize `STATE.md` com o novo status do projeto

---

## Debugging

Antes de sugerir qualquer solução:
1. Verifique logs e erros recentes relevantes
2. Pergunte o que já foi tentado e falhou
3. Nunca repita uma abordagem que já foi descartada na sessão atual

---

## Consistência de Código

Antes de implementar qualquer coisa:
1. Verifique se já existe algo parecido no projeto
2. Siga os padrões existentes — não introduza novos sem discussão
3. Nunca refatorar código fora do escopo da task atual

---

## Regra de Não Quebrar o que Funciona

- Alterações devem ser cirúrgicas e limitadas ao escopo pedido
- Se identificar algo que "poderia melhorar" fora do escopo, registre como dívida técnica, não mexa agora

---

## Dívida Técnica

Sempre que identificar algo que precisa melhorar mas não é prioridade:
1. Registre automaticamente em `~/Documentos/MeuSegundoCerebro/MeuSegundoCerebro/Conhecimento/Divida-Tecnica.md`
2. Formato: data, descrição, contexto, impacto estimado

---

## Restrições de Hardware e Performance

- O sistema roda em máquinas de baixo custo em ambientes de restaurante/evento
- Sempre considerar consumo de memória e CPU nas sugestões
- Preferir soluções leves e eficientes

---

## Checklist — Task Concluída

Antes de considerar qualquer task pronta, verificar:
- [ ] TypeScript sem erros (`pnpm typecheck`)
- [ ] Sem `any` sem justificativa
- [ ] Migrations em `runMigrations()`, nunca no `schema.sql`
- [ ] Fluxo testado em modo offline
- [ ] Nenhum código fora do escopo foi alterado
