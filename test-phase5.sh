#!/bin/bash

# Test Phase 5: Queue Screens
# This script creates orders and items to test the real-time queue display

set -e

API="http://localhost:3000"

echo "=== Testing Phase 5: Queue Screens ==="
echo ""

# Get the first table (demo data should have 6 tables)
echo "1. Fetching table list..."
TABLES=$(curl -s "$API/queues/kitchen" | jq -r '.[] | .order_id' | head -1)
TABLE_ID="table-1"  # Use a known table ID from the seed data

echo "   Using table: $TABLE_ID"
echo ""

# Create an order
echo "2. Creating order in AUTO routing mode..."
ORDER=$(curl -s -X POST "$API/orders" \
  -H "Content-Type: application/json" \
  -d "{\"table_id\": \"$TABLE_ID\", \"routing_mode\": \"auto\"}")

ORDER_ID=$(echo "$ORDER" | jq -r '.id')
echo "   Order created: $ORDER_ID"
echo ""

# Add items to different routing zones
echo "3. Adding items to order (will broadcast to queues)..."
echo ""

# Add a kitchen item (Burger)
echo "   Adding Burger (kitchen)..."
curl -s -X POST "$API/orders/$ORDER_ID/items" \
  -H "Content-Type: application/json" \
  -d "{\"menu_item_id\": \"burger-id\", \"quantity\": 1, \"notes\": \"No onions\"}" \
  > /dev/null 2>&1 || true

sleep 1

# Add a bar item (Beer)
echo "   Adding Beer (bar)..."
curl -s -X POST "$API/orders/$ORDER_ID/items" \
  -H "Content-Type: application/json" \
  -d "{\"menu_item_id\": \"beer-id\", \"quantity\": 2, \"notes\": \"Cold\"}" \
  > /dev/null 2>&1 || true

sleep 1

echo ""
echo "4. Checking kitchen queue..."
KITCHEN_QUEUE=$(curl -s "$API/queues/kitchen")
KITCHEN_COUNT=$(echo "$KITCHEN_QUEUE" | jq 'length')
echo "   Items in kitchen queue: $KITCHEN_COUNT"
echo ""

echo "5. Checking bar queue..."
BAR_QUEUE=$(curl -s "$API/queues/bar")
BAR_COUNT=$(echo "$BAR_QUEUE" | jq 'length')
echo "   Items in bar queue: $BAR_COUNT"
echo ""

echo "=== Test Complete ==="
echo ""
echo "Instructions:"
echo "1. Open http://localhost:1420 in your browser"
echo "2. You should see the Kitchen screen with items"
echo "3. Click 'Start Cooking' to change status to 'preparing'"
echo "4. Click 'Mark Ready' to change status to 'ready'"
echo "5. Switch to the Bar tab and repeat"
echo ""
echo "Press Ctrl+C to stop the servers when done testing"
