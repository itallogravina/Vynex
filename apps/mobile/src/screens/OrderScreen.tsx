import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, StyleSheet, Modal, Alert } from 'react-native'
import {
  Table,
  MenuItem,
  OrderRoutingMode,
  ItemStatus,
  Order,
  OrderItem,
} from '@vynex/shared'
import { useTranslation } from '@vynex/i18n'
import { useAuth } from '../context/AuthContext'

const API_URL = 'http://localhost:3000'

type OrderItemWithMenu = OrderItem & {
  menu_item: MenuItem
  live_status?: string
}

export default function OrderScreen() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [tables, setTables] = useState<Table[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [routingMode, setRoutingMode] = useState<OrderRoutingMode>(OrderRoutingMode.MANUAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [order, setOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItemWithMenu[]>([])
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const [quickItem, setQuickItem] = useState<MenuItem | null>(null)
  const [quickQty, setQuickQty] = useState(1)
  const [quickNotes, setQuickNotes] = useState('')
  const [quickAdding, setQuickAdding] = useState(false)

  const queueItemsRef = useRef<Map<string, any>>(new Map())
  const wsRef = useRef<WebSocket | null>(null)

  function authHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) h['X-Session-Token'] = token
    return h
  }

  function buildWsUrl(): string {
    const url = new URL('ws://localhost:3000/ws')
    if (token) url.searchParams.set('token', token)
    return url.toString()
  }

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch(`${API_URL}/tables`, { headers: authHeaders() })
        if (!res.ok) throw new Error(t('errors.GENERAL_UNKNOWN'))
        const data = await res.json()
        setTables(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errors.GENERAL_UNKNOWN'))
      }
    }

    const fetchMenuItems = async () => {
      try {
        const res = await fetch(`${API_URL}/menu-items`, { headers: authHeaders() })
        if (!res.ok) throw new Error(t('errors.GENERAL_UNKNOWN'))
        const data = await res.json()
        setMenuItems(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errors.GENERAL_UNKNOWN'))
      }
    }

    fetchTables()
    fetchMenuItems()
  }, [])

  useEffect(() => {
    if (!order) return

    const ws = new WebSocket(buildWsUrl())
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

    ws.onerror = () => setError(t('errors.GENERAL_UNKNOWN'))

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

  const loadExistingOrder = async () => {
    setLoading(true)
    setError(null)
    try {
      const openRes = await fetch(`${API_URL}/orders/open?table_id=${selectedTable}`, {
        headers: authHeaders(),
      })
      const existingOrder = (await openRes.json()) as Order | null
      if (!existingOrder?.id) throw new Error(t('errors.GENERAL_UNKNOWN'))

      const detailRes = await fetch(`${API_URL}/orders/${existingOrder.id}`, {
        headers: authHeaders(),
      })
      const detail = (await detailRes.json()) as Order & { items: OrderItemWithMenu[] }

      setOrder(existingOrder)
      setOrderItems(detail.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.GENERAL_UNKNOWN'))
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrder = async () => {
    if (!selectedTable) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ table_id: selectedTable, routing_mode: routingMode }),
      })

      if (res.status === 409) {
        Alert.alert(
          t('orders.tableOccupied'),
          t('orders.tableOccupiedMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('orders.continueExisting'), onPress: loadExistingOrder },
          ]
        )
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('errors.GENERAL_UNKNOWN'))
      }

      const newOrder = (await res.json()) as Order
      setOrder(newOrder)
      setOrderItems([])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.GENERAL_UNKNOWN'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = async (menuItem: MenuItem, qty: number, notesText?: string) => {
    if (!order) return

    try {
      const res = await fetch(`${API_URL}/orders/${order.id}/items`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          menu_item_id: menuItem.id,
          quantity: qty,
          notes: notesText || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('errors.GENERAL_UNKNOWN'))
      }

      const newItem = (await res.json()) as OrderItem
      const itemWithMenu: OrderItemWithMenu = {
        ...newItem,
        menu_item: menuItem,
      }

      setOrderItems(prev => [...prev, itemWithMenu])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.GENERAL_UNKNOWN'))
    }
  }

const handleBackToTables = () => {
  setOrder(null)
  setOrderItems([])
  setSearchTerm('') // Opcional: limpa a busca de itens ao sair
}

  const openQuickOrder = (menuItem: MenuItem) => {
    setQuickItem(menuItem)
    setQuickQty(1)
    setQuickNotes('')
  }

  const handleQuickAdd = async () => {
    if (!quickItem) return
    setQuickAdding(true)
    try {
      await handleAddItem(quickItem, quickQty, quickNotes || undefined)
      setQuickItem(null)
    } finally {
      setQuickAdding(false)
    }
  }

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const statusColor = (status: string) => {
    switch (status) {
      case ItemStatus.PENDING:   return '#ef4444'
      case ItemStatus.PREPARING: return '#f97316'
      case ItemStatus.READY:     return '#22c55e'
      case ItemStatus.SERVED:    return '#3b82f6'
      case ItemStatus.BILLED:    return '#6b7280'
      default:                   return '#999'
    }
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
            style={[styles.createButton, (!selectedTable || loading) && styles.buttonDisabled]}
            onPress={handleCreateOrder}
            disabled={!selectedTable || loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? t('orders.creating') : t('orders.createOrder')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  return (
<View style={styles.container}>
      {/* --- CABEÇALHO ATUALIZADO --- */}
      <View style={styles.orderHeader}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.orderTitle}>
              {t('orders.table')}: {tables.find(tbl => tbl.id === order.table_id)?.name || t('orders.unknown')}
            </Text>
            <Text style={styles.orderInfo}>#{order.id.slice(0, 8)}</Text>
            <Text style={styles.orderInfo}>{order.routing_mode.toUpperCase()}</Text>
          </View>
          
          {/* Botão de Voltar para Mesas */}
          <TouchableOpacity style={styles.backButton} onPress={handleBackToTables}>
            <Text style={styles.backButtonText}>{t('common.back', 'Back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* ----------------------------- */}

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('orders.addItems')}</Text>

          <TextInput
            style={styles.searchInput}
            placeholder={t('orders.searchPlaceholder')}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          <FlatList
            data={filteredItems}
            keyExtractor={item => item.id}
            renderItem={({ item: menuItem }) => (
              <TouchableOpacity
                style={[styles.menuItemButton, menuItem.eightysixed && styles.menuItemButtonDisabled]}
                onPress={() => !menuItem.eightysixed && openQuickOrder(menuItem)}
                disabled={menuItem.eightysixed}
              >
                <View style={styles.menuItemContent}>
                  <Text style={[styles.menuItemName, menuItem.eightysixed && styles.menuItemTextFaded]}>
                    {menuItem.name}
                  </Text>
                  <Text style={[styles.menuItemPrice, menuItem.eightysixed && styles.menuItemTextFaded]}>
                    R$ {menuItem.price.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.menuItemFooter}>
                  <Text style={styles.menuItemZone}>{menuItem.routing_zone}</Text>
                  {menuItem.eightysixed && (
                    <View style={styles.eightysixBadge}>
                      <Text style={styles.eightysixBadgeText}>{t('menu.outOfStock')}</Text>
                    </View>
                  )}
                </View>
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
                    <Text>{t('orders.quantity')}: {orderItem.quantity}</Text>
                    <Text>R$ {(orderItem.menu_item.price * orderItem.quantity).toFixed(2)}</Text>
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
                {t('common.total')}: R${' '}
                {orderItems
                  .reduce((sum, item) => sum + item.menu_item.price * item.quantity, 0)
                  .toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={quickItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickItem(null)}
      >
        <View style={styles.quickOverlay}>
          <View style={styles.quickSheet}>
            <Text style={styles.quickTitle}>{t('orders.quickAdd')}</Text>
            <Text style={styles.quickItemName}>{quickItem?.name}</Text>
            <Text style={styles.quickItemPrice}>R$ {quickItem?.price.toFixed(2)}</Text>

            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>{t('orders.quantity')}</Text>
              <View style={styles.qtyStepper}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQuickQty(q => Math.max(1, q - 1))}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{quickQty}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQuickQty(q => q + 1)}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.qtyLabel}>{t('orders.notes')}</Text>
            <TextInput
              style={styles.quickNotesInput}
              value={quickNotes}
              onChangeText={setQuickNotes}
              placeholder={t('orders.specialRequests')}
              multiline
              numberOfLines={2}
            />

            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickCancelBtn} onPress={() => setQuickItem(null)}>
                <Text style={styles.quickCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickAddBtn, quickAdding && styles.buttonDisabled]}
                onPress={handleQuickAdd}
                disabled={quickAdding}
              >
                <Text style={styles.quickAddText}>
                  {quickAdding ? t('common.loading') : t('orders.addToOrder')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  setupContainer: {
    padding: 20, backgroundColor: 'white', marginTop: 50, marginHorizontal: 20, borderRadius: 8,
  },
  setupTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  errorBanner: {
    backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5',
    borderRadius: 6, padding: 12, marginBottom: 16,
  },
  errorText: { color: '#b91c1c', fontSize: 14 },
  formGroup: { marginBottom: 20 },
  label: { fontWeight: '600', marginBottom: 8, color: '#555', fontSize: 14 },
  selectContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 4, overflow: 'hidden' },
  selectOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  selectOptionSelected: { backgroundColor: '#e3f2fd' },
  selectOptionText: { fontSize: 14, color: '#333' },
  selectOptionTextSelected: { color: '#3b82f6', fontWeight: '600' },
  modeContainer: { flexDirection: 'row', gap: 10 },
  modeButton: {
    flex: 1, padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 4, alignItems: 'center',
  },
  modeButtonActive: { borderColor: '#3b82f6', backgroundColor: '#e3f2fd' },
  modeButtonText: { fontSize: 14, color: '#666' },
  modeButtonTextActive: { color: '#3b82f6', fontWeight: '600' },
  createButton: {
    padding: 12, backgroundColor: '#3b82f6', borderRadius: 4, alignItems: 'center', marginTop: 10,
  },
  buttonDisabled: { backgroundColor: '#cbd5e1' },
  createButtonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  orderHeader: {
    backgroundColor: 'white', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
  },
  orderTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  orderInfo: { fontSize: 14, color: '#666', marginBottom: 4 },
  scrollView: { flex: 1, padding: 16 },
  section: { backgroundColor: 'white', borderRadius: 8, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#333' },
  searchInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 4, padding: 8, marginBottom: 12, fontSize: 14,
  },
  menuItemButton: {
    padding: 12, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e0e0e0',
    borderRadius: 4, marginBottom: 8,
  },
  menuItemButtonDisabled: {
    opacity: 0.5,
  },
  menuItemContent: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6,
  },
  menuItemName: { fontWeight: '600', color: '#333', fontSize: 14 },
  menuItemPrice: { color: '#3b82f6', fontWeight: '600', fontSize: 14 },
  menuItemTextFaded: { color: '#aaa' },
  menuItemFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuItemZone: { fontSize: 12, color: '#999' },
  eightysixBadge: {
    paddingHorizontal: 5, paddingVertical: 1,
    backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', borderRadius: 3,
  },
  eightysixBadgeText: { fontSize: 10, fontWeight: '800', color: '#92400e', textTransform: 'uppercase' },
  emptyMessage: { textAlign: 'center', color: '#999', fontSize: 14, paddingVertical: 20 },
  summaryItem: {
    padding: 12, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e0e0e0',
    borderRadius: 4, marginBottom: 8,
  },
  summaryItemHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  summaryItemName: { fontWeight: '600', color: '#333', fontSize: 14 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  statusBadgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
  summaryItemDetails: {
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 13, color: '#666', marginBottom: 6,
  },
  summaryItemNotes: {
    fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 6,
    paddingTop: 6, borderTopWidth: 1, borderTopColor: '#eee',
  },
  orderTotal: { borderTopWidth: 2, borderTopColor: '#e0e0e0', paddingTop: 12, marginTop: 12 },
  orderTotalText: { textAlign: 'right', fontSize: 16, color: '#333', fontWeight: '600' },

  // Quick Order Modal
  quickOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)',
  },
  quickSheet: {
    backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 24, gap: 12,
  },
  quickTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  quickItemName: { fontSize: 15, fontWeight: '600', color: '#2c3e50' },
  quickItemPrice: { fontSize: 14, color: '#3b82f6', fontWeight: '600', marginBottom: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyLabel: { fontSize: 14, fontWeight: '600', color: '#555' },
  qtyStepper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 4, overflow: 'hidden',
  },
  qtyBtn: {
    width: 40, height: 40, backgroundColor: '#f5f5f5',
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 20, color: '#333', lineHeight: 24 },
  qtyValue: {
    minWidth: 44, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#333', paddingHorizontal: 6,
  },
  quickNotesInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 4, padding: 8,
    fontSize: 14, minHeight: 60, textAlignVertical: 'top',
  },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  quickCancelBtn: {
    flex: 1, padding: 12, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 4, alignItems: 'center',
  },
  quickCancelText: { fontSize: 14, fontWeight: '600', color: '#555' },
  quickAddBtn: {
    flex: 2, padding: 12, backgroundColor: '#22c55e', borderRadius: 4, alignItems: 'center',
  },
  quickAddText: { fontSize: 14, fontWeight: '600', color: 'white' },
  // Adicione estes estilos no final do seu StyleSheet.create({ ... })
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ef4444', // Vermelho/coral para ação de saída/cancelamento
    borderRadius: 4,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
})
