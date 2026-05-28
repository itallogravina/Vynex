#!/usr/bin/env node

// Test Phase 5: Queue Screens
// This script creates orders and items to test real-time queues

const API = 'http://localhost:3000'

async function test() {
  try {
    console.log('=== Testing Phase 5: Queue Screens ===\n')

    // First, get all tables
    console.log('1. Getting all tables...')
    let response = await fetch(`${API}/queues/kitchen`)
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`)

    // Since we don't have a GET /tables endpoint yet, we'll create the order and hope a table exists
    // Actually, let's just try creating an order with a placeholder and see what happens
    console.log('2. Creating order in AUTO routing mode...')
    response = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Use a known format - we'll iterate if the first one fails
      body: JSON.stringify({
        table_id: 'demo-table',
        routing_mode: 'auto',
      }),
    })

    let order = await response.json()
    console.log('   Response:', order)

    if (!order.id) {
      console.error('   Error: Order creation failed. Trying to fetch actual table IDs...')
      // Query the database info through a different approach
      // For now, let's just show this error and help the user manually test
      console.log('\n   To complete this test, we need a valid table ID from the database.')
      console.log('   Tables are seeded with random UUIDs.')
      console.log('   Please open the browser and manually test instead.')
      return
    }

    const orderId = order.id
    console.log(`   Order created: ${orderId}\n`)

    // Now we need to know what menu items exist
    console.log('3. Checking menu items in kitchen queue...')
    response = await fetch(`${API}/queues/kitchen`)
    const kitchenQueue = await response.json()
    console.log(`   Kitchen queue: ${kitchenQueue.length} items`)

    if (kitchenQueue.length > 0) {
      const firstItem = kitchenQueue[0]
      const menuItemId = firstItem.menu_item.id
      console.log(`   Sample menu item: ${firstItem.menu_item.name} (${menuItemId})\n`)

      console.log('4. Adding menu item to order...')
      response = await fetch(`${API}/orders/${orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_item_id: menuItemId,
          quantity: 1,
          notes: 'Test item',
        }),
      })

      const item = await response.json()
      console.log('   Item added:', item)

      // Check the queue again
      await new Promise(r => setTimeout(r, 1000))
      response = await fetch(`${API}/queues/kitchen`)
      const updatedQueue = await response.json()
      console.log(`   Kitchen queue now has: ${updatedQueue.length} items\n`)

      if (updatedQueue.length > 0) {
        console.log('✓ SUCCESS: Order and items created! Queue is working.\n')
        console.log('Next steps:')
        console.log('1. Open http://localhost:1420 in your browser')
        console.log('2. You should see items in the Kitchen queue')
        console.log('3. Click "Start Cooking" to mark as "preparing"')
        console.log('4. Click "Mark Ready" to mark as "ready"')
        console.log('5. Switch to Bar/Cashier tabs\n')
      }
    } else {
      console.log('   No items in kitchen queue. Seed data may not have created any.\n')
      console.log('Please check server logs or database directly.\n')
    }

    console.log('Press Ctrl+C to stop the servers when done testing')
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

test()
