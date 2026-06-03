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
  AddOrderItemRequest,
} from '@vynex/shared'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { useAuthedFetch } from '../context/AuthContext'
import { useTranslation } from '../context/I18nContext'
import QuickOrderPopover from '../components/QuickOrderPopover'
import OrderReviewModal from '../components/OrderReviewModal'

type OrderItemWithMenu = OrderItem & {
  menu_item: MenuItem
  live_status?: string
}

type DraftItem = AddOrderItemRequest & { name: string; price: number }

type Props = {
  serverUrl: string
  onOpenSettings: () => void
  onLogout: () => void
}

export default function OrderScreen({ serverUrl, onOpenSettings, onLogout }: Props) {
  const authedFetch = useAuthedFetch()
  const { t } = useTranslation()
  const { queueOrder, queueCount, flush } = useOfflineQueue(serverUrl, undefined)

  const [tables, setTables] = useState<Table[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [routingMode, setRoutingMode] = useState<OrderRoutingMode>(OrderRoutingMode.MANUAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  const [offlineDraft, setOfflineDraft] = useState<{
    table_id: string; routing_mode: OrderRoutingMode; items: DraftItem[]
  } | null>(null)

  const [order, setOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItemWithMenu[]>([])
  const [popoverItem, setPopoverItem] = useState<MenuItem | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [reviewVisible, setReviewVisible] = useState(false)

  const queueItemsRef = useRef<Map<string, any>>(new Map())
  const wsRef = useRef<WebSocket | null>(null)
  const flushRef = useRef(flush)
  useEffect(() => { flushRef.current = flush }, [flush])

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await authedFetch(`${serverUrl}/tables`)
        if (!res.ok) throw new Error('Failed to load tables')
        const data = await res.json()
        setTables(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tables')
      }
    }

    const fetchMenuItems = async () => {
      try {
        const res = await authedFetch(`${serverUrl}/menu-items`)
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
    let closed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws?zones=kitchen,bar,cashier'

    function connect() {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setWsConnected(true)
        setError(null)
        flushRef.current()
      }

      ws.onmessage = event => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'queue:snapshot') {
            msg.items.forEach((item: { id: string; status: string }) => {
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

      ws.onerror = () => {
        setError(t('queue.wsDisconnected'))
      }

      ws.onclose = () => {
        setWsConnected(false)
        wsRef.current = null
        if (!closed) {
          reconnectTimer = setTimeout(connect, 3000)
        }
      }
    }

    connect()

    return () => {
      closed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [serverUrl])

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
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        setOfflineDraft({ table_id: selectedTable, routing_mode: routingMode, items: [] })
        return
      }
      const res = await authedFetch(`${serverUrl}/orders`, {
        method: 'POST',
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
    const menuItem = menuItems.find(m => m.id === productId)
    if (!menuItem) return

    if (offlineDraft) {
      const draftItem: DraftItem = { menu_item_id: productId, quantity: qty, priority, name: menuItem.name, price: menuItem.price }
      if (note) draftItem.notes = note
      setOfflineDraft(prev => prev ? { ...prev, items: [...prev.items, draftItem] } : null)
      return
    }

    if (!order) return

    try {
      const res = await authedFetch(`${serverUrl}/orders/${order.id}/items`, {
        method: 'POST',
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

  const handleQueueDraft = async () => {
    if (!offlineDraft) return
    const ok = await queueOrder({
      user_id: 'mobile',
      table_id: offlineDraft.table_id,
      routing_mode: offlineDraft.routing_mode,
      items: offlineDraft.items.map(item => {
        const r: AddOrderItemRequest = { menu_item_id: item.menu_item_id, quantity: item.quantity }
        if (item.notes) r.notes = item.notes
        if (item.priority) r.priority = item.priority
        if (item.variations) r.variations = item.variations
        return r
      }),
    })
    if (ok) {
      setOfflineDraft(null)
      // flush immediately — covers the case where WS is already connected
      // (onopen only fires on new connections, not when WS is already open)
      flushRef.current()
    } else {
      setError(t('orders.queueFull'))
    }
  }

  const handleBackToTables = () => {
    setOrder(null)
    setOrderItems([])
    setSearchTerm('')
  }

  const handleConfirmRouting = async () => {
    if (!order) return
    const res = await authedFetch(`${serverUrl}/orders/${order.id}/confirm-routing`, {
      method: 'POST',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to confirm routing')
    }
    // Refresh items so routed_at is populated
    const orderRes = await authedFetch(`${serverUrl}/orders/${order.id}`)
    if (orderRes.ok) {
      const data = await orderRes.json()
      setOrderItems(
        (data.items as OrderItemWithMenu[]).map(i => ({
          ...i,
          live_status: queueItemsRef.current.get(i.id)?.status ?? i.status,
        }))
      )
    }
    setReviewVisible(false)
  }

  const handleCancelOrder = async () => {
    if (!order) return
    const res = await authedFetch(`${serverUrl}/orders/${order.id}/cancel`, {
      method: 'PATCH',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to cancel order')
    }
    setReviewVisible(false)
    handleBackToTables()
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

  if (offlineDraft) {
    const draftTable = tables.find(t => t.id === offlineDraft.table_id)
    return (
      <ScrollView style={styles.container}>
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            {t('orders.offlineDraft')} ({t('orders.table')}: {draftTable?.name ?? offlineDraft.table_id})
            {queueCount > 0 ? `  •  ${queueCount} na fila` : ''}
          </Text>
        </View>

        <QuickOrderPopover
          item={popoverItem}
          onClose={() => setPopoverItem(null)}
          onAddItem={handleAddItem}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('orders.draftSection')}</Text>
          {offlineDraft.items.length === 0 ? (
            <Text style={styles.emptyMessage}>{t('orders.noItemsYet')}</Text>
          ) : (
            <FlatList
              data={offlineDraft.items}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <View style={styles.summaryItem}>
                  <View style={styles.summaryItemHeader}>
                    <Text style={styles.summaryItemName}>{item.name}</Text>
                    <Text>x{item.quantity}</Text>
                  </View>
                  <Text>R$ {(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              )}
              scrollEnabled={false}
            />
          )}
          <View style={styles.draftActions}>
            <TouchableOpacity
              style={[styles.queueButton, offlineDraft.items.length === 0 && styles.buttonDisabled]}
              onPress={handleQueueDraft}
              disabled={offlineDraft.items.length === 0}
            >
              <Text style={styles.createButtonText}>{t('orders.sendWhenOnline')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.discardButton} onPress={() => setOfflineDraft(null)}>
              <Text style={styles.discardButtonText}>{t('orders.discard')}</Text>
            </TouchableOpacity>
          </View>
          {error && <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('orders.addItems')}</Text>
          <FlatList
            data={menuItems.filter(i => !i.eightysixed_at)}
            keyExtractor={item => item.id}
            renderItem={({ item: menuItem }) => (
              <TouchableOpacity
                style={styles.menuItemButton}
                onPress={() => setPopoverItem(menuItem)}
              >
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemName}>{menuItem.name}</Text>
                  <Text style={styles.menuItemPrice}>R$ {menuItem.price.toFixed(2)}</Text>
                </View>
              </TouchableOpacity>
            )}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
    )
  }

  if (!order) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.setupContainer}>
          <Text style={styles.setupTitle}>{t('orders.createOrder')}</Text>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!wsConnected && queueCount >= 10 && (
            <View style={styles.blockedMsg}>
              <Text style={styles.blockedMsgText}>
                {t('queue.noServer')} {queueCount} {t('queue.pendingSync')}
              </Text>
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('orders.table')}:</Text>
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
            <Text style={styles.label}>{t('orders.routingMode')}:</Text>
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
            style={[styles.createButton, (!selectedTable || loading || (!wsConnected && queueCount >= 10)) && styles.buttonDisabled]}
            onPress={handleCreateOrder}
            disabled={!selectedTable || loading || (!wsConnected && queueCount >= 10)}
          >
            <Text style={styles.createButtonText}>{loading ? t('orders.creating') : t('orders.createOrder')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.orderHeader}>
        <View style={styles.headerTopRow}>

          <Text style={styles.orderTitle}>Order #{order.id.slice(0, 8)}</Text>
          <Text style={styles.orderInfo}>
            Table: {tables.find(t => t.id === order.table_id)?.name || 'Unknown'}
          </Text>
          <Text style={styles.orderInfo}>Mode: {order.routing_mode.toUpperCase()}</Text>
        </View>
        <View style={styles.headerActions}>
          {queueCount > 0 && (
            <View style={styles.queueBadge}>
              <Text style={styles.queueBadgeText}>{queueCount}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.backButton} onPress={handleBackToTables}>
            <Text style={styles.backButtonText}>{t('nav.tables')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutButtonText}>{t('auth.logout')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton} onPress={onOpenSettings}>
            <Text style={styles.settingsButtonText}>⚙</Text>
          </TouchableOpacity>
          {(() => {
            const unroutedCount = orderItems.filter(i => !i.routed_at).length
            return (
              <TouchableOpacity
                style={[styles.reviewButton, unroutedCount === 0 && styles.reviewButtonDisabled]}
                onPress={() => setReviewVisible(true)}
                disabled={unroutedCount === 0}
              >
                <Text style={styles.reviewButtonText}>
                  {t('orders.review')}{unroutedCount > 0 ? ` (${unroutedCount})` : ''}
                </Text>
              </TouchableOpacity>
            )
          })()}
        </View>
      </View>

      <QuickOrderPopover
        item={popoverItem}
        onClose={() => setPopoverItem(null)}
        onAddItem={handleAddItem}
      />

      <OrderReviewModal
        visible={reviewVisible}
        items={orderItems.filter(i => !i.routed_at)}
        onClose={() => setReviewVisible(false)}
        onConfirm={handleConfirmRouting}
        onCancel={handleCancelOrder}
      />

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('orders.addItems')}</Text>

          <TextInput
            style={styles.searchInput}
            placeholder={t('orders.searchItems')}
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
          <Text style={styles.sectionTitle}>{t('orders.orderSummary')}</Text>

          {orderItems.length === 0 ? (
            <Text style={styles.emptyMessage}>{t('orders.noItemsYet')}</Text>
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
                    <Text>{t('orders.qty')}: {orderItem.quantity}</Text>
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
                {t('common.total')}: R$
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
  // Adicione estes estilos no final do seu StyleSheet.create({ ... })
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ef4444',
    borderRadius: 4,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  reviewButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ea580c',
    borderRadius: 4,
  },
  reviewButtonDisabled: {
    backgroundColor: '#4a2c10',
  },
  reviewButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  offlineBanner: {
    backgroundColor: '#78350f',
    borderWidth: 1,
    borderColor: '#b45309',
    borderRadius: 6,
    padding: 10,
    margin: 16,
    marginBottom: 0,
  },
  offlineBannerText: {
    color: '#fef3c7',
    fontSize: 13,
    fontWeight: '500',
  },
  draftActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  queueButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#b45309',
    borderRadius: 6,
    alignItems: 'center',
  },
  discardButton: {
    padding: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#8b2020',
    borderRadius: 6,
    alignItems: 'center',
  },
  discardButtonText: {
    color: '#e05050',
    fontWeight: '600',
    fontSize: 13,
  },
  settingsButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#374151',
    borderRadius: 4,
  },
  settingsButtonText: {
    color: '#d1d5db',
    fontSize: 14,
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#7c3aed',
    borderRadius: 4,
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  queueBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  blockedMsg: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  blockedMsgText: {
    color: '#92400e',
    fontSize: 13,
    textAlign: 'center',
  },
})
