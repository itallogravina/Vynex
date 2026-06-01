# M6 — Events, Analytics & Printing: Specification

## 1. Analytics ✅ DONE

Six-tab reports screen accessible to `manager` and `owner` roles.

| Tab | Chart | Data source |
|---|---|---|
| Sales | ComposedChart (Bar revenue + Line orders) | `GET /reports/sales?from&to&groupBy` |
| Top Items | Horizontal BarChart + ranked tables | `GET /reports/top-items?from&to&limit` |
| Waiters | Performance table | `GET /reports/per-waiter?from&to` |
| Peak Hours | Grouped BarChart 00h–23h | `GET /reports/peak-hour?from&to` |
| Comparison | KPI cards with delta % | `GET /reports/comparison?period=week\|month` |
| Never Ordered | Item table | `GET /reports/never-ordered?from&to` |

- Default range: last 30 days; auto-fetched on tab mount.
- Cancellation rate: orders with `payment_method = 'cancelled'`.
- All routes guarded by `requireRole('manager', 'owner')`.

---

## 2. Reservations & Events

### 2.1 Table Reservations
- Fields: client name, phone, party size, arrival date/time, notes.
- Status: `pending` → `seated` → `cancelled`.
- Floor map tiles show reservation badge when a table is reserved for the current day window (±30 min of arrival time).
- Seating alert: sound + desktop notification when arrival time arrives and table is still `pending`.
- Auto-open order: tapping "Seat" on a reservation creates a new order on that table pre-filled with the client name.

### 2.2 Guest QR Code
- Each table has a unique QR code (encodes `https://<venue-url>/table/<id>`).
- Guest view: live read-only list of items added to their order with current status (pending / in prep / ready).
- Printable from table management screen (PDF or thermal print).
- No authentication required for guest view.

### 2.3 VIP List
- Flag on reservation: `is_vip boolean`.
- VIP badge visible on floor map tile and reservation list.
- Reservation screen has "VIP" filter toggle.

### 2.4 Capacity Control
- `venue_areas` table gets `capacity integer` column.
- Floor map shows `seated / capacity` counter per area.
- Optional hard block: server rejects order creation when area is at capacity.

---

## 3. Promotions & Combos

### 3.1 Combos
- `combos` table: `id`, `name`, `price`, `venue_id`.
- `combo_items` table: `combo_id`, `menu_item_id`, `quantity`.
- Combo appears as a single line item in the order; individual items are still routed to kitchen/bar separately.
- Combo total overrides sum of individual prices.

### 3.2 Time-Limited Discounts
- `promotions` table: `id`, `menu_item_id | category_id`, `discount_type ('flat'|'pct')`, `discount_value`, `starts_at`, `ends_at`.
- Server applies promotion at order-item creation time; stores `original_price` and `applied_discount` on `order_items`.
- Active promotions shown with badge on menu screen.

---

## 4. Menu Enhancements

### 4.1 Product Photos
- `menu_items` gains `photo_url text` (nullable).
- Upload endpoint: `POST /menu/items/:id/photo` — accepts `multipart/form-data`, stores file in `<data-dir>/photos/`, returns public URL.
- Photo shown on order screen item card and guest QR view.
- Tauri: use `@tauri-apps/api/fs` to pick local file; upload via fetch.

---

## 5. Tab Management

### 5.1 Physical Tab Number
- `orders` gains `tab_number integer` (nullable).
- Cashier screen: assign / reassign tab number to an open order.
- Tab number shown prominently on order card.

### 5.2 Minimum Consumption
- `venue_areas` gains `min_consumption_per_person numeric` (nullable).
- At cashier closing, alert if `order.total / party_size < min_consumption`.
- Alert is informational (cashier can override).

---

## 6. Event Mode

### 6.1 Event Toggle
- `events` table: `id`, `venue_id`, `name`, `starts_at`, `ends_at`, `is_active boolean`, `id_mode ('wristband'|'cpf_last4'|'qr')`.
- Only one event can be `is_active` at a time per venue.
- Settings screen: create event, activate/deactivate, configure `id_mode`.

### 6.2 Customer Registration
- `event_customers` table: `id`, `event_id`, `name`, `phone`, `cpf`, `wristband_number`, `registered_at`.
- Entry screen (new screen, role: `cashier`, `manager`, `owner`): register customer, assign wristband number.
- CPF stored hashed (SHA-256) for lookup; last 4 digits used for display.

### 6.3 Order Identification
- When event is active, order creation requires attaching a customer identifier.
  - `wristband` mode: type wristband number.
  - `cpf_last4` mode: type last 4 digits of CPF (resolves to customer by hash suffix).
  - `qr` mode: scan QR from wristband (QR encodes wristband number).
- `orders` gains `event_customer_id` FK (nullable).

### 6.4 Consumption Tab & Closing
- Cashier screen: "Close by wristband" flow — enter wristband number or CPF → system shows all open orders linked to that customer → single payment closes all.
- Closing receipt shows per-item breakdown per customer.

---

## 7. Consumption & Bar Control

### 7.1 Named Areas
- `venue_areas` table: `id`, `venue_id`, `name`, `has_cash_control boolean`.
- Each area with `has_cash_control = true` gets its own independent closing report.
- Closing report scoped per area, not venue-wide.

### 7.2 Bar Cash Control
- Bar cash control is optional and activated per area per event (not venue-wide).
- `area_closings` table: `id`, `area_id`, `event_id`, `opened_at`, `closed_at`, `total_revenue`, `payment_breakdown jsonb`.

### 7.3 Personal Consumption via CPF
- Bartenders can tag a poured item to a customer CPF at order time.
- `order_items` gains `event_customer_id` FK (nullable).
- Cashier and waiter screens show per-customer item summary for the table.
- Closing supports charging by CPF: splits the bill by customer attribution.

---

## 8. Printing

### 8.1 ESC/POS Thermal Printer
- Server-side: `escpos` or `node-thermal-printer` library.
- `printers` table: `id`, `venue_id`, `name`, `connection ('usb'|'network')`, `address`, `routing_zone_id` (nullable).
- Queue items trigger automatic print to the printer assigned to their routing zone.

### 8.2 Customer Receipt
- Printed at order close from cashier screen.
- Content: venue name, table/tab, items with quantities and prices, subtotal, payment method, date/time.

### 8.3 WhatsApp Receipt
- "Send via WhatsApp" button on cashier closing screen.
- Generates `https://wa.me/?text=<url-encoded-receipt>` pre-filled link; opens in default browser/app.
- No WhatsApp Business API required.

### 8.4 Printed Daily Closing Report
- One-tap from cashier closing screen.
- ESC/POS format: revenue by payment method, top 5 items, total orders opened/closed.
