# Promotions & Combos Specification

## Problem Statement

Venues need two complementary pricing tools: **combos** (fixed-price bundles that simplify ordering and boost average ticket) and **promotions** (time-limited discounts that drive happy-hour and event sales). Neither exists in Vynex today. Revenue calculations also ignore variation price deltas — a correctness bug this feature fixes.

## Goals

- [ ] Owners/managers can define combo bundles (N items at a fixed bundle price)
- [ ] Owners/managers can define time-limited promotions (% or fixed discount on an item or category)
- [ ] Waiters can add a combo in one tap; all components route to the correct kitchen/bar zones
- [ ] Active promotions are applied automatically when an item is added to an order; price is snapshotted at that moment
- [ ] Revenue calculations across all reports and cashier views use the snapshotted price, not the current menu price
- [ ] Variation price deltas are included in the price snapshot (existing bug fixed as a side effect)

## Architecture Decisions (Locked)

| Decision | Choice |
|---|---|
| Combo UX | Atomic — one tap adds all components as individual order_items |
| Discount timing | Snapshot at add time — stored in `order_items.final_price` |
| Promotion scope | Item-level and category-level only |
| Multiple promotions | Best discount wins (lowest effective price) |
| Promotion UI | Dedicated "Promotions" section in admin; dedicated "Combos" section |

## Out of Scope

| Feature | Reason |
|---|---|
| Order-total discounts | Complexity; deferred to M7 |
| BOGO / tiered promotions | Scope; start with percentage and fixed |
| Combo with variable-choice slots | Deferred (e.g. "pick any drink") |
| Mobile combo UI | Deferred to M7 |
| Promotion stacking | Explicitly excluded — best discount wins |

---

## User Stories

### P1: Combo management ⭐ MVP

**User Story**: As a manager, I want to define combo bundles (name, bundle price, component items) so that waiters can add complete combos in one tap.

**Acceptance Criteria**:

1. WHEN manager opens Combos screen THEN system SHALL list all combos with name, bundle price, component count, and enabled status
2. WHEN manager creates a combo THEN system SHALL require name, bundle price > 0, and at least one menu item component
3. WHEN manager adds a component to a combo THEN system SHALL allow selecting any enabled menu item and a quantity (default 1)
4. WHEN manager deletes a combo THEN system SHALL remove it without affecting existing order history
5. WHEN manager toggles a combo disabled THEN system SHALL hide it from the order screen immediately

**Independent Test**: Create a "Burger Combo" (burger + fries + drink) at R$35. Verify it appears in the Combos admin list with 3 components. Disable it — verify it disappears from order screen.

---

### P1: Add combo to order ⭐ MVP

**User Story**: As a waiter, I want to tap a combo on the order screen and have all components added automatically so that I don't have to add each item individually.

**Acceptance Criteria**:

1. WHEN an active order exists AND enabled combos exist THEN system SHALL show a "Combos" section on the order screen below menu items
2. WHEN waiter taps a combo THEN system SHALL create one `order_item` per component with proportional final_price, all sharing a `combo_group_id`
3. WHEN combo is added with routing_mode = auto THEN system SHALL broadcast each component to its correct routing zone (burger → kitchen, drink → bar)
4. WHEN combo is added THEN system SHALL show all component items in the order summary
5. WHEN no enabled combos exist THEN system SHALL hide the Combos section entirely

**Independent Test**: Start an order, tap "Burger Combo." Verify kitchen queue shows Burger + Fries, bar queue shows Drink. Verify order summary shows 3 line items.

---

### P1: Promotion management ⭐ MVP

**User Story**: As a manager, I want to define time-limited promotions (percentage or fixed discount on an item or category) so that happy-hour pricing is applied automatically.

**Acceptance Criteria**:

1. WHEN manager opens Promotions screen THEN system SHALL list all promotions with name, type, value, target, time window, and enabled status
2. WHEN manager creates a promotion THEN system SHALL require: name, type (percentage|fixed), value > 0, applicable_to (item|category), applicable_id
3. WHEN type = percentage THEN value SHALL be 0–100 (%)
4. WHEN type = fixed THEN value SHALL be > 0 (R$ amount)
5. WHEN active_from/active_to are set THEN system SHALL only apply the promotion within that HH:MM window
6. WHEN both are NULL THEN system SHALL treat the promotion as always active
7. WHEN manager toggles a promotion disabled THEN system SHALL stop applying it to new order items immediately

**Independent Test**: Create "Happy Hour Beer -30%" targeting category "Bar", active 17:00–19:00. Verify it appears in list. Set system time to 17:30, add a beer to an order — verify final_price = price × 0.70.

---

### P1: Automatic promotion application ⭐ MVP

**User Story**: As a waiter, I want discounts to be applied automatically when I add an item so that I never need to remember or manually apply promotions.

**Acceptance Criteria**:

1. WHEN waiter adds an item AND an active promotion targets that item or its category THEN system SHALL compute `final_price = base_price - discount` and store it on the order_item
2. WHEN multiple promotions apply to one item THEN system SHALL apply the one yielding the lowest effective price
3. WHEN no promotion applies THEN system SHALL set `final_price = base_price` (item price + variation deltas)
4. WHEN a promotion is active at add time THEN price SHALL remain locked even if the promotion expires before the bill is closed
5. WHEN variation options are selected THEN system SHALL include their price_delta in base_price before applying discount

**Independent Test**: Add item with a variation (+R$5 delta) during an active 20% promo. Verify final_price = (item.price + 5) × 0.80.

---

### P1: Revenue fix — use final_price everywhere ⭐ MVP

**User Story**: As an owner, I want revenue totals in reports and cashier views to reflect actual charged prices (after discounts and including variation deltas) so that financial data is accurate.

**Acceptance Criteria**:

1. WHEN calculating any revenue total THEN system SHALL use `COALESCE(oi.final_price, mi.price) * oi.quantity`
2. WHEN displaying line-item price in cashier bills view THEN system SHALL use `final_price` when set
3. WHEN displaying total on open order THEN system SHALL sum `final_price` (or fallback to `mi.price`) × quantity

**Independent Test**: Close an order with a discounted item. Verify cashier closing summary shows discounted total, not list price total.

---

### P2: Promotion badge in order screen

**User Story**: As a waiter, I want to see a visual indicator when an item has a discount applied so that I can confirm the promotion is active.

**Acceptance Criteria**:

1. WHEN an item in the order summary has `discount_amount > 0` THEN system SHALL show a discount badge with the amount saved
2. WHEN a combo item is in the order summary THEN system SHALL show a "COMBO" badge

---

### P3: Promotion active indicator in menu

**User Story**: As a waiter, I want to see which menu items currently have an active promotion so that I can suggest them to customers.

**Acceptance Criteria**:

1. WHEN the order screen loads THEN system SHALL fetch active promotions for the current time
2. WHEN a menu item has an active promotion THEN system SHALL show a discount badge on its card

---

## Edge Cases

- WHEN bundle_price > sum of individual prices THEN system SHALL still apply proportional distribution (items cost more than bundle — unusual but valid)
- WHEN fixed discount ≥ item price THEN system SHALL floor final_price at 0
- WHEN a menu item in a combo is deleted THEN system SHALL block the combo from being added (return 422)
- WHEN a menu item in a combo is 86'd THEN system SHALL still allow adding the combo (86'd is temporary; combo routing proceeds)
- WHEN an order is in offline draft mode THEN combo items SHALL be added as individual draft items with their proportional prices

---

## Requirement Traceability

| Req ID | Story | Status |
|---|---|---|
| PC-01 | Combo management | Pending |
| PC-02 | Add combo to order | Pending |
| PC-03 | Promotion management | Pending |
| PC-04 | Automatic promotion application | Pending |
| PC-05 | Revenue fix | Pending |
| PC-06 | Promotion badge | Pending |

## Success Criteria

- [ ] Manager can create, edit, enable/disable, and delete promotions and combos
- [ ] Waiter adds a combo in one tap; kitchen/bar receive correct individual items
- [ ] Happy-hour promotion reduces price automatically during time window; price is locked at add time
- [ ] Cashier closing revenue matches discounted prices, not list prices
- [ ] All existing tests pass (no regression)
