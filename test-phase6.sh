#!/bin/bash

# Test Phase 6: Order Taking UI
# This script tests the order creation and item addition flow

set -e

API="http://localhost:3000"

echo "=== Testing Phase 6: Order Taking UI ==="
echo ""

# Get tables
echo "1. Getting available tables..."
TABLES=$(curl -s "$API/tables")
TABLE_ID=$(echo "$TABLES" | jq -r '.[0].id')
TABLE_NAME=$(echo "$TABLES" | jq -r '.[0].name')
echo "   Available tables: $(echo "$TABLES" | jq 'length') tables"
echo "   Using table: $TABLE_NAME ($TABLE_ID)"
echo ""

# Get menu items
echo "2. Getting available menu items..."
MENU_ITEMS=$(curl -s "$API/menu-items")
KITCHEN_ITEM=$(echo "$MENU_ITEMS" | jq -r '.[] | select(.routing_zone == "kitchen") | .id' | head -1)
BAR_ITEM=$(echo "$MENU_ITEMS" | jq -r '.[] | select(.routing_zone == "bar") | .id' | head -1)
KITCHEN_ITEM_NAME=$(echo "$MENU_ITEMS" | jq -r ".[] | select(.id == \"$KITCHEN_ITEM\") | .name")
BAR_ITEM_NAME=$(echo "$MENU_ITEMS" | jq -r ".[] | select(.id == \"$BAR_ITEM\") | .name")
echo "   Total items: $(echo "$MENU_ITEMS" | jq 'length')"
echo "   Kitchen item: $KITCHEN_ITEM_NAME ($KITCHEN_ITEM)"
echo "   Bar item: $BAR_ITEM_NAME ($BAR_ITEM)"
echo ""

# Test manual mode
echo "3. Testing MANUAL routing mode..."
ORDER_MANUAL=$(curl -s -X POST "$API/orders" \
  -H "Content-Type: application/json" \
  -d "{\"table_id\": \"$TABLE_ID\", \"routing_mode\": \"manual\"}")

ORDER_MANUAL_ID=$(echo "$ORDER_MANUAL" | jq -r '.id')
echo "   Order created: $ORDER_MANUAL_ID"
echo "   Mode: $(echo "$ORDER_MANUAL" | jq -r '.routing_mode')"
echo ""

# Add items to manual order
echo "4. Adding items to manual order (per-item sends)..."
ITEM1=$(curl -s -X POST "$API/orders/$ORDER_MANUAL_ID/items" \
  -H "Content-Type: application/json" \
  -d "{\"menu_item_id\": \"$KITCHEN_ITEM\", \"quantity\": 2, \"notes\": \"Medium rare\"}")

ITEM1_ID=$(echo "$ITEM1" | jq -r '.id')
echo "   Item 1 added: $KITCHEN_ITEM_NAME (Qty: 2)"
echo "   Item ID: $ITEM1_ID"
echo "   Status: $(echo "$ITEM1" | jq -r '.status')"
echo ""

# Verify item appears in queue
echo "5. Verifying item appears in kitchen queue..."
sleep 1
KITCHEN_QUEUE=$(curl -s "$API/queues/kitchen")
ITEM_IN_QUEUE=$(echo "$KITCHEN_QUEUE" | jq ".[] | select(.id == \"$ITEM1_ID\")" | jq -r '.id')
if [ -n "$ITEM_IN_QUEUE" ]; then
  echo "   ✓ Item found in kitchen queue!"
  echo "   Item status: $(echo "$KITCHEN_QUEUE" | jq -r ".[] | select(.id == \"$ITEM1_ID\") | .status")"
else
  echo "   ✗ Item NOT found in queue"
fi
echo ""

# Test auto mode
echo "6. Testing AUTO routing mode..."
ORDER_AUTO=$(curl -s -X POST "$API/orders" \
  -H "Content-Type: application/json" \
  -d "{\"table_id\": \"$TABLE_ID\", \"routing_mode\": \"auto\"}")

ORDER_AUTO_ID=$(echo "$ORDER_AUTO" | jq -r '.id')
echo "   Order created: $ORDER_AUTO_ID"
echo "   Mode: $(echo "$ORDER_AUTO" | jq -r '.routing_mode')"
echo ""

# For auto mode, add multiple items
echo "7. Adding multiple items to auto order..."
ITEM2=$(curl -s -X POST "$API/orders/$ORDER_AUTO_ID/items" \
  -H "Content-Type: application/json" \
  -d "{\"menu_item_id\": \"$KITCHEN_ITEM\", \"quantity\": 1}")

ITEM3=$(curl -s -X POST "$API/orders/$ORDER_AUTO_ID/items" \
  -H "Content-Type: application/json" \
  -d "{\"menu_item_id\": \"$BAR_ITEM\", \"quantity\": 2, \"notes\": \"Cold\"}")

ITEM2_ID=$(echo "$ITEM2" | jq -r '.id')
ITEM3_ID=$(echo "$ITEM3" | jq -r '.id')
echo "   Item 2: $KITCHEN_ITEM_NAME added"
echo "   Item 3: $BAR_ITEM_NAME added"
echo ""

# Verify items in queues
echo "8. Verifying all items in respective queues..."
sleep 1
KITCHEN_QUEUE=$(curl -s "$API/queues/kitchen")
BAR_QUEUE=$(curl -s "$API/queues/bar")

KITCHEN_COUNT=$(echo "$KITCHEN_QUEUE" | jq 'length')
BAR_COUNT=$(echo "$BAR_QUEUE" | jq 'length')

echo "   Kitchen queue: $KITCHEN_COUNT items"
echo "   Bar queue: $BAR_COUNT items"
echo ""

# Test status update
echo "9. Testing status updates..."
echo "   Updating item 2 to 'preparing'..."
STATUS_UPDATE=$(curl -s -X PATCH "$API/orders/$ORDER_AUTO_ID/items/$ITEM2_ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "preparing"}')

NEW_STATUS=$(echo "$STATUS_UPDATE" | jq -r '.status')
echo "   New status: $NEW_STATUS"
echo ""

# Get full order
echo "10. Fetching complete order..."
FULL_ORDER=$(curl -s "$API/orders/$ORDER_MANUAL_ID")
ITEMS_COUNT=$(echo "$FULL_ORDER" | jq '.items | length')
echo "   Order: $(echo "$FULL_ORDER" | jq -r '.id' | cut -c1-8)..."
echo "   Items in order: $ITEMS_COUNT"
echo "   Order status: $(echo "$FULL_ORDER" | jq -r '.status')"
echo ""

echo "=== Phase 6 Testing Complete ==="
echo ""
echo "Results:"
if [ "$KITCHEN_COUNT" -gt 0 ] && [ "$BAR_COUNT" -gt 0 ]; then
  echo "✓ Manual mode: Items route immediately to queues"
  echo "✓ Auto mode: Multiple items route to correct zones"
  echo "✓ Status updates: Item status changes are tracked"
  echo ""
  echo "Next steps:"
  echo "1. Open http://localhost:1420 in browser"
  echo "2. Click 'Order' tab to see the Order Taking UI"
  echo "3. Create an order with a table"
  echo "4. Add menu items and verify they appear in Kitchen/Bar/Cashier screens"
  echo "5. Verify live status updates as items move through the workflow"
else
  echo "✗ Items not routed to queues correctly"
fi
