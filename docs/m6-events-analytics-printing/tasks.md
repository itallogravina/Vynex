# M6 — Tasks

Legend: ✅ done · 🚧 in progress · ⬜ not started

---

## Analytics ✅

- ✅ Shared types: `PeakHourReport`, `CancellationRateReport`, `PeriodComparison`, `NeverOrderedReport`
- ✅ Query functions: `getPeakHourReport`, `getCancellationRateReport`, `getPeriodComparison`, `getNeverOrderedReport`
- ✅ Route file `apps/server/src/routes/reports.ts` — 8 GET endpoints, `requireRole('manager','owner')`
- ✅ Desktop: `ReportsScreen.tsx` — 6-tab shell
- ✅ Desktop: `SalesTab` — ComposedChart bar+line, KPI cards, groupBy selector
- ✅ Desktop: `TopItemsTab` — horizontal BarChart + ranked tables
- ✅ Desktop: `WaiterTab` — per-waiter performance table
- ✅ Desktop: `PeakHourTab` — 24h grouped BarChart
- ✅ Desktop: `ComparisonTab` — week/month toggle, delta % badges
- ✅ Desktop: `NeverOrderedTab` — items with zero orders in period
- ✅ i18n keys added (PT-BR + EN-US)
- ✅ Nav entry added (`owner`, `manager`)
- ✅ Auto-fetch on tab mount
- ✅ Recharts `ResponsiveContainer` wrapper fix

---

## Reservations & Events ⬜

- ⬜ DB: `reservations` table (`id`, `venue_id`, `table_id`, `client_name`, `phone`, `party_size`, `arrival_at`, `notes`, `status`)
- ⬜ API: CRUD `/reservations`
- ⬜ Desktop: Reservations screen (list + form)
- ⬜ Desktop: Floor map badge for reserved tables
- ⬜ Desktop: Seating alert (arrival time notification)
- ⬜ Desktop: Auto-open order on "Seat" action
- ⬜ DB: `venue_areas.capacity` column
- ⬜ Desktop: Capacity counter per area on floor map
- ⬜ DB + API: VIP flag on reservation
- ⬜ Desktop: Guest QR code view (read-only order status page)
- ⬜ Desktop: Print table QR from table management

---

## Promotions & Combos ⬜

- ⬜ DB: `combos` + `combo_items` tables
- ⬜ API: CRUD `/combos`
- ⬜ DB: `promotions` table with `discount_type`, `starts_at`, `ends_at`
- ⬜ API: CRUD `/promotions`
- ⬜ Server: apply promotion at order-item creation (store `original_price`, `applied_discount`)
- ⬜ Desktop: Combo management screen
- ⬜ Desktop: Promotions management screen
- ⬜ Desktop: Active promotion badge on menu screen
- ⬜ Desktop: Combo appears as single line item in order

---

## Menu Enhancements ⬜

- ⬜ DB: `menu_items.photo_url` column
- ⬜ API: `POST /menu/items/:id/photo` (multipart upload, serve from `<data-dir>/photos/`)
- ⬜ Desktop: Photo upload in menu management (file picker via Tauri FS API)
- ⬜ Desktop: Photo shown on order screen item card
- ⬜ Guest QR view: photo shown per item

---

## Tab Management ⬜

- ⬜ DB: `orders.tab_number` column
- ⬜ API: `PATCH /orders/:id/tab` to assign/reassign tab number
- ⬜ Desktop: Tab number input on cashier screen order card
- ⬜ DB: `venue_areas.min_consumption_per_person` column
- ⬜ Desktop: Minimum consumption alert at cashier closing

---

## Event Mode ⬜

- ⬜ DB: `events` table (`id`, `venue_id`, `name`, `starts_at`, `ends_at`, `is_active`, `id_mode`)
- ⬜ DB: `event_customers` table (`id`, `event_id`, `name`, `phone`, `cpf_hash`, `wristband_number`, `registered_at`)
- ⬜ DB: `orders.event_customer_id` FK
- ⬜ API: CRUD `/events` + `POST /events/:id/activate`
- ⬜ API: CRUD `/event-customers`
- ⬜ Desktop: Event settings (create, activate, configure `id_mode`)
- ⬜ Desktop: Customer registration screen (entry role)
- ⬜ Desktop: Order creation — attach customer by wristband / CPF last 4 / QR when event active
- ⬜ Desktop: Cashier "Close by wristband" flow
- ⬜ Desktop: Per-customer consumption receipt

---

## Consumption & Bar Control ⬜

- ⬜ DB: `venue_areas` table (if not already from Reservations task)
- ⬜ DB: `venue_areas.has_cash_control` flag
- ⬜ DB: `area_closings` table (`id`, `area_id`, `event_id`, `opened_at`, `closed_at`, `total_revenue`, `payment_breakdown`)
- ⬜ DB: `order_items.event_customer_id` FK
- ⬜ API: Bar area closing endpoints
- ⬜ Desktop: Area management in settings (name, has_cash_control)
- ⬜ Desktop: Bartender CPF-tag flow at item entry
- ⬜ Desktop: Per-customer item summary on cashier + waiter screens
- ⬜ Desktop: Split bill by customer CPF at closing
- ⬜ Desktop: Area closing report (independent per area)

---

## Printing ⬜

- ⬜ Server: install and configure ESC/POS library (`node-thermal-printer` or `escpos`)
- ⬜ DB: `printers` table (`id`, `venue_id`, `name`, `connection`, `address`, `routing_zone_id`)
- ⬜ API: CRUD `/printers` + `POST /printers/:id/test`
- ⬜ Server: auto-print queue item on kitchen/bar route to assigned printer
- ⬜ Desktop: Printer management screen (add, test, assign to routing zone)
- ⬜ Desktop: "Print receipt" button on cashier closing
- ⬜ Desktop: "Send via WhatsApp" button (pre-filled `wa.me` link)
- ⬜ Desktop: "Print daily closing report" button (ESC/POS format)
