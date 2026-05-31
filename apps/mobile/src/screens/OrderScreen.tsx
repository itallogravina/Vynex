import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, StyleSheet } from 'react-native'
import {
  Table,
  MenuItem,
  OrderRoutingMode,
  ItemStatus,
  Priority,
  Order,
  OrderItem,
} from '@vynex/shared'
import QuickOrderPopover from '../components/QuickOrderPopover'

const API_URL = 'http://localhost:3000'
const WS_URL = 'ws://localhost:3000/ws'

type OrderItemWithMenu = OrderItem & {
  menu_item: MenuItem
  live_status?: string
}

export default function OrderScreen() {
  const [tables, setTables] = useState<Table[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [routingMode, setRoutingMode] = useState<OrderRoutingMode>(OrderRoutingMode.MANUAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [order, setOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItemWithMenu[]>([])
  const [popoverItem, setPopoverItem] = useState<MenuItem | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const queueItemsRef = useRef<Map<string, any>>(new Map())
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch(`${API_URL}/tables`)
        if (!res.ok) throw new Error('Failed to load tables')
        const data = await res.json()
        setTables(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tables')
      }
    }

    const fetchMenuItems = async () => {
      try {
        const res = await fetch(`${API_URL}/menu-items`)
        if (!res.ok) throw new Error('Failed to load menu items')
        const data = await res.json()
        setMenuItems(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load menu items')
      }
    }

    fetchTables()
    fetchMenuItems()
  }, [])

  useEffect(() => {
    if (!order) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'subscribe', routing_zone: 'kitchen' }))
      ws.send(JSON.stringify({ action: 'subscribe', routing_zone: 'bar' }))
      ws.send(JSON.stringify({ action: 'subscribe', routing_zone: 'cashier' }))
    }

    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'queue:snapshot') {
          msg.items.forEach((item: any) => {
            queueItemsRef.current.set(item.id, item)
          })
          updateItemStatuses()
        } else if (msg.type === 'item:status_changed') {
          const existing = queueItemsRef.current.get(msg.item_id)
          if (existing) {
            existing.status = msg.new_status
            updateItemStatuses()
          }
        }
      } catch (err) {
        console.error('WebSocket message error:', err)
      }
    }

    ws.onerror = () => setError('Real-time connection lost — status updates paused')

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [order])

  const updateItemStatuses = () => {
    setOrderItems(prev =>
      prev.map(item => {
        const queueItem = queueItemsRef.current.get(item.id)
        return {
          ...item,
          live_status: queueItem?.status || item.status,
        }
      })
    )
  }

  const handleCreateOrder = async () => {
    if (!selectedTable) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: selectedTable, routing_mode: routingMode }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create order')
      }

      const newOrder = (await res.json()) as Order
      setOrder(newOrder)
      setOrderItems([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = async ({
    productId,
    qty,
    note,
    priority,
  }: {
    productId: string
    qty: number
    note: string
    priority: Priority
  }) => {
    if (!order) return
    const menuItem = menuItems.find(m => m.id === productId)
    if (!menuItem) return

    try {
      const res = await fetch(`${API_URL}/orders/${order.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_item_id: productId,
          quantity: qty,
          notes: note || undefined,
          priority,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to add item')
      }

      const newItem = (await res.json()) as OrderItem
      setOrderItems(prev => [...prev, { ...newItem, menu_item: menuItem }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item')
    }
  }

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const statusColor = (status: string) => {
    switch (status) {
      case ItemStatus.PENDING:
        return '#ef4444'
      case ItemStatus.PREPARING:
        return '#f97316'
      case ItemStatus.READY:
        return '#22c55e'
      case ItemStatus.SERVED:
        return '#3b82f6'
      case ItemStatus.BILLED:
        return '#6b7280'
      default:
        return '#999'
    }
  }

  if (!order) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.setupContainer}>
          <Text style={styles.setupTitle}>Create Order</Text>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Table:</Text>
            <View style={styles.selectContainer}>
              <FlatList
                data={tables}
                keyExtractor={item => item.id}
                renderItem={({ item: table }) => (
                  <TouchableOpacity
                    style={[
                      styles.selectOption,
                      selectedTable === table.id && styles.selectOptionSelected,
                    ]}
                    onPress={() => setSelectedTable(table.id)}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        selectedTable === table.id && styles.selectOptionTextSelected,
                      ]}
                    >
                      {table.name}
                    </Text>
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Routing Mode:</Text>
            <View style={styles.modeContainer}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  routingMode === OrderRoutingMode.MANUAL && styles.modeButtonActive,
                ]}
                onPress={() => setRoutingMode(OrderRoutingMode.MANUAL)}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    routingMode === OrderRoutingMode.MANUAL && styles.modeButtonTextActive,
                  ]}
                >
                  Manual
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  routingMode === OrderRoutingMode.AUTO && styles.modeButtonActive,
                ]}
                onPress={() => setRoutingMode(OrderRoutingMode.AUTO)}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    routingMode === OrderRoutingMode.AUTO && styles.modeButtonTextActive,
                  ]}
                >
                  Auto
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.createButton, (!selectedTable || loading) && styles.buttonDisabled]}
            onPress={handleCreateOrder}
            disabled={!selectedTable || loading}
          >
            <Text style={styles.createButtonText}>{loading ? 'Creating...' : 'Create Order'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderTitle}>Order #{order.id.slice(0, 8)}</Text>
        <Text style={styles.orderInfo}>
          Table: {tables.find(t => t.id === order.table_id)?.name || 'Unknown'}
        </Text>
        <Text style={styles.orderInfo}>Mode: {order.routing_mode.toUpperCase()}</Text>
      </View>

      <QuickOrderPopover
        item={popoverItem}
        onClose={() => setPopoverItem(null)}
        onAddItem={handleAddItem}
      />

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Items</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          <FlatList
            data={filteredItems}
            keyExtractor={item => item.id}
            renderItem={({ item: menuItem }) => (
              <TouchableOpacity
                style={[
                  styles.menuItemButton,
                  (!menuItem.enabled || !!menuItem.eightysixed_at) && styles.menuItemDisabled,
                ]}
                onPress={() => menuItem.enabled && !menuItem.eightysixed_at && setPopoverItem(menuItem)}
              >
                <View style={styles.menuItemContent}>
                  <Text style={[styles.menuItemName, !!menuItem.eightysixed_at && styles.menuItemStruck]}>
                    {menuItem.name}
                  </Text>
                  <View style={styles.menuItemRight}>
                    {menuItem.eightysixed_at && (
                      <View style={styles.badge86}>
                        <Text style={styles.badge86Text}>86'd</Text>
                      </View>
                    )}
                    <Text style={styles.menuItemPrice}>R$ {menuItem.price.toFixed(2)}</Text>
                  </View>
                </View>
                <Text style={styles.menuItemZone}>{menuItem.routing_zone}</Text>
              </TouchableOpacity>
            )}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>

          {orderItems.length === 0 ? (
            <Text style={styles.emptyMessage}>No items added yet</Text>
          ) : (
            <FlatList
              data={orderItems}
              keyExtractor={item => item.id}
              renderItem={({ item: orderItem }) => (
                <View style={styles.summaryItem}>
                  <View style={styles.summaryItemHeader}>
                    <Text style={styles.summaryItemName}>{orderItem.menu_item.name}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusColor(orderItem.live_status || orderItem.status) },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {orderItem.live_status || orderItem.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.summaryItemDetails}>
                    <Text>Qty: {orderItem.quantity}</Text>
                    <Text>${(orderItem.menu_item.price * orderItem.quantity).toFixed(2)}</Text>
                  </View>
                  {orderItem.notes && (
                    <Text style={styles.summaryItemNotes}>{orderItem.notes}</Text>
                  )}
                </View>
              )}
              scrollEnabled={false}
            />
          )}

          {orderItems.length > 0 && (
            <View style={styles.orderTotal}>
              <Text style={styles.orderTotalText}>
                Total: $
                {orderItems
                  .reduce((sum, item) => sum + item.menu_item.price * item.quantity, 0)
                  .toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  setupContainer: {
    padding: 20,
    backgroundColor: 'white',
    marginTop: 50,
    marginHorizontal: 20,
    borderRadius: 8,
  },
  setupTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#555',
    fontSize: 14,
  },
  selectContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
  },
  selectOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectOptionSelected: {
    backgroundColor: '#e3f2fd',
  },
  selectOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectOptionTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  modeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    alignItems: 'center',
  },
  modeButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#e3f2fd',
  },
  modeButtonText: {
    fontSize: 14,
    color: '#666',
  },
  modeButtonTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  createButton: {
    padding: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  orderHeader: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  orderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  orderInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  menuItemButton: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  menuItemDisabled: {
    opacity: 0.4,
  },
  menuItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  menuItemName: {
    fontWeight: '600',
    color: '#333',
    fontSize: 14,
    flex: 1,
  },
  menuItemStruck: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuItemPrice: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 14,
  },
  badge86: {
    backgroundColor: '#e74c3c',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badge86Text: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  menuItemZone: {
    fontSize: 12,
    color: '#999',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 20,
  },
  summaryItem: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  summaryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryItemName: {
    fontWeight: '600',
    color: '#333',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  summaryItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  summaryItemNotes: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  orderTotal: {
    borderTopWidth: 2,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    marginTop: 12,
  },
  orderTotalText: {
    textAlign: 'right',
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
})
