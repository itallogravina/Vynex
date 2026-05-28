#!/bin/bash

# Test Phase 5: Queue Screens (v2)
# This script creates orders and items with proper data

set -e

API="http://localhost:3000"

echo "=== Testing Phase 5: Queue Screens ==="
echo ""

# Create an order with auto routing
echo "1. Creating order in AUTO routing mode..."
ORDER=$(curl -s -X POST "$API/orders" \
  -H "Content-Type: application/json" \
  -d '{"table_id": "demo-table-1", "routing_mode": "auto"}')

echo "$ORDER" | jq .

ORDER_ID=$(echo "$ORDER" | jq -r '.id // empty')

if [ -z "$ORDER_ID" ]; then
  echo "Error: Failed to create order"
  exit 1
fi

echo "   Order created: $ORDER_ID"
echo ""

# Get menu items to add to the order
echo "2. Getting first menu item for kitchen..."
MENU_ITEMS=$(curl -s "$API/queues/kitchen" | jq '.[] | {menu_item_id: .menu_item.id, name: .menu_item.name}' | head -1)
echo "$MENU_ITEMS"

# Add kitchen item
echo ""
echo "3. Adding items to order..."

# We'll need to add the item. First let's get the menu items database
# For now, let's just get a menu item from any queried zone
KITCHEN_QUEUED=$(curl -s "$API/queues/kitchen")
if [ "$(echo "$KITCHEN_QUEUED" | jq 'length')" -gt 0 ]; then
  MENU_ITEM_ID=$(echo "$KITCHEN_QUEUED" | jq -r '.[0].menu_item.id')
  echo "   Using menu item: $MENU_ITEM_ID"
else
  # If no items in kitchen queue, we need to get them from the database some other way
  # Let's just try with hardcoded menu items from the seed data
  echo "   Kitchen queue is empty, will add items..."
fi

# Try adding an item - we'll use a UUID to create a menu item entry
# Actually, the seed data should have created some items. Let me just try to add one
echo ""
echo "   Trying to add a Burger (kitchen item)..."
ADD_RESULT=$(curl -s -X POST "$API/orders/$ORDER_ID/items" \
  -H "Content-Type: application/json" \
  -d '{"menu_item_id": "burger-1", "quantity": 1, "notes": "No onions"}')

echo "$ADD_RESULT" | jq .

echo ""
echo "4. Checking kitchen queue..."
KITCHEN_QUEUE=$(curl -s "$API/queues/kitchen")
KITCHEN_COUNT=$(echo "$KITCHEN_QUEUE" | jq 'length')
echo "   Items in kitchen queue: $KITCHEN_COUNT"

if [ "$KITCHEN_COUNT" -gt 0 ]; then
  echo "   First item:"
  echo "$KITCHEN_QUEUE" | jq '.[0]' | head -10
fi

echo ""
echo "=== Test Results ==="
if [ "$KITCHEN_COUNT" -gt 0 ]; then
  echo "✓ Order and items created successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Open http://localhost:1420 in your browser"
  echo "2. You should see items in the Kitchen queue"
  echo "3. Click 'Start Cooking' to mark as 'preparing'"
  echo "4. Click 'Mark Ready' to mark as 'ready'"
  echo "5. Switch to Bar/Cashier tabs to see items there"
else
  echo "✗ No items found in queue. The order may not have been created properly."
  echo "Check the API logs for errors."
fi

echo ""
echo "Press Ctrl+C to stop the servers when done testing"
