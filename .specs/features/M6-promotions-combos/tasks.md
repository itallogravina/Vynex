# Promotions & Combos — Tasks

**Spec:** `.specs/features/M6-promotions-combos/spec.md`
**Branch:** `future/M5-M7`

---

## T01 — Schema: new tables + order_items columns [PC-01, PC-02, PC-03, PC-04, PC-05]

**What:** Add `promotions`, `combo_bundles`, `combo_bundle_items` tables to schema.sql; add `final_price`, `discount_amount`, `promotion_id`, `combo_group_id` columns to `order_items`. Add matching migrations to `init.ts`.

**Where:** `apps/server/src/db/schema.sql`, `apps/server/src/db/init.ts`

**Done when:** Server starts on existing DB without error; new columns present on `order_items`; new tables exist.

---

## T02 — Shared types: Promotion, ComboBundle, ComboBundleItem; extend OrderItem [PC-01–PC-06]

**What:** Add new types to `packages/shared/src/index.ts`. Extend `OrderItem` with `final_price?`, `discount_amount?`, `promotion_id?`, `combo_group_id?`. Add API request/response types.

**Where:** `packages/shared/src/index.ts`

---

## T03 — Backend queries: Promotion + Combo CRUD, promotion resolution, revenue fix [PC-01–PC-05]

**What:**
- `listPromotions`, `createPromotion`, `updatePromotion`, `deletePromotion`, `togglePromotion`
- `getActivePromotionForItem(menuItemId, categoryId, basePrice, currentTime)` — best-discount logic
- `getVariationDeltaSum(optionIds)` — sum price_deltas for selected variations
- `listComboBundles`, `createComboBundle`, `updateComboBundle`, `deleteComboBundle`, `toggleComboBundle`
- `addItemToCombo`, `removeItemFromCombo`, `getComboBundleWithItems`
- Update `addOrderItem` signature to accept `finalPrice`, `discountAmount`, `promotionId`, `comboGroupId`
- Update `mapOrderItem` to include new fields
- Replace all `oi.quantity * mi.price` with `oi.quantity * COALESCE(oi.final_price, mi.price)` (14 occurrences)
- Fix `listOpenOrders` total calculation to use `final_price`

**Where:** `apps/server/src/db/queries.ts`

---

## T04 — Backend routes: promotions.ts + combos.ts [PC-01, PC-03]

**What:**
- `apps/server/src/routes/promotions.ts` — GET/POST/PUT/DELETE /promotions, PATCH /promotions/:id/toggle
- `apps/server/src/routes/combos.ts` — GET/POST/PUT/DELETE /combos, PATCH /combos/:id/toggle, POST /combos/:id/items, DELETE /combos/:id/items/:itemId

**Where:** `apps/server/src/routes/`

---

## T05 — Backend: update orders.ts add-item + add combo-to-order [PC-02, PC-04]

**What:**
- In `POST /orders/:id/items`: fetch variation delta sum, resolve active promotion, pass `finalPrice`/`discountAmount`/`promotionId` to `addOrderItem`
- Add `POST /orders/:id/combos` endpoint: fetch combo, compute proportional prices, create one `order_item` per component with shared `combo_group_id`, broadcast each to its routing zone

**Where:** `apps/server/src/routes/orders.ts`

---

## T06 — Backend: register routes in index.ts [PC-01–PC-04]

**What:** Import and register `registerPromotionsRoutes` and `registerCombosRoutes`.

**Where:** `apps/server/src/index.ts`

---

## T07 — i18n: promotions + combos keys [all]

**What:** Add `nav.promotions`, `nav.combos`, and `promotions.*`, `combos.*` namespaces to both locale files.

**Where:** `packages/i18n/dist/locales/pt-BR.json`, `packages/i18n/dist/locales/en-US.json`

---

## T08 — Frontend App.tsx: add screens to nav [PC-01, PC-03]

**What:** Add `'promotions' | 'combos'` to `ScreenType`, add entries to `ALL_NAV` (roles: owner, manager), add cases to `renderScreen`, add imports.

**Where:** `apps/desktop/src/App.tsx`

---

## T09 — Frontend: PromotionsManagementScreen [PC-03]

**What:** Full CRUD screen — list promotions, create/edit modal (name, type, value, applicable_to, applicable_id picker, active_from/to, enabled), delete with confirm, toggle enabled.

**Where:** `apps/desktop/src/screens/PromotionsManagementScreen.tsx`, `apps/desktop/src/styles/PromotionsManagement.css`

---

## T10 — Frontend: CombosManagementScreen [PC-01]

**What:** Full CRUD screen — list combos, create/edit modal (name, description, bundle_price), item editor panel (pick menu items + quantity, show individual vs bundle price), toggle enabled.

**Where:** `apps/desktop/src/screens/CombosManagementScreen.tsx`, `apps/desktop/src/styles/CombosManagement.css`

---

## T11 — Frontend: OrderScreen — combos section + discount badge [PC-02, PC-06]

**What:**
- Fetch `/combos` on mount; show "Combos" section below menu items when combos exist
- Combo card: name + bundle price + component names list; tap → POST `/orders/:id/combos`
- Order summary: show "COMBO" badge on `combo_group_id` items; show discount badge when `discount_amount > 0`
- Fix offline draft total to use `final_price` when available

**Where:** `apps/desktop/src/screens/OrderScreen.tsx`

---

## T12 — Frontend: CashierScreen — use final_price for line items [PC-05]

**What:** Replace `item.quantity * item.menu_item.price` with `item.quantity * (item.final_price ?? item.menu_item.price)` in bills view line items and split subtotals. The server-computed `total` already uses final_price after the backend fix.

**Where:** `apps/desktop/src/screens/CashierScreen.tsx`
