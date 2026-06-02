import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native'
import { OrderItem, MenuItem, RoutingZone } from '@vynex/shared'

type OrderItemFull = OrderItem & { menu_item: MenuItem }

type Props = {
  visible: boolean
  items: OrderItemFull[]
  onClose: () => void
  onConfirm: () => Promise<void>
  onCancel: () => Promise<void>
}

function zoneColor(zone: RoutingZone): { bg: string; text: string } {
  switch (zone) {
    case RoutingZone.KITCHEN:  return { bg: '#7c3100', text: '#fb923c' }
    case RoutingZone.BAR:      return { bg: '#1e3a5f', text: '#60a5fa' }
    case RoutingZone.CASHIER:  return { bg: '#2a2a2a', text: '#9ca3af' }
    default:                   return { bg: '#14532d', text: '#4ade80' }
  }
}

export default function OrderReviewModal({ visible, items, onClose, onConfirm, onCancel }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setConfirming(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar')
    } finally {
      setConfirming(false)
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    setError(null)
    try {
      await onCancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cancelar')
      setCancelling(false)
    }
  }

  // Group combo items
  type Group = { comboGroupId: string | null; items: OrderItemFull[] }
  const groups: Group[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (item.combo_group_id) {
      if (!seen.has(item.combo_group_id)) {
        seen.add(item.combo_group_id)
        groups.push({
          comboGroupId: item.combo_group_id,
          items: items.filter(i => i.combo_group_id === item.combo_group_id),
        })
      }
    } else {
      groups.push({ comboGroupId: null, items: [item] })
    }
  }

  const total = items.reduce(
    (sum, i) => sum + (i.final_price ?? i.menu_item.price) * i.quantity,
    0
  )

  const busy = confirming || cancelling

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={!busy ? onClose : undefined}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Revisar Pedido</Text>
                <TouchableOpacity onPress={onClose} disabled={busy} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Items */}
              {items.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum item aguardando envio.</Text>
              ) : (
                <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
                  {groups.map((group, gi) =>
                    group.comboGroupId ? (
                      <View key={group.comboGroupId} style={styles.comboGroup}>
                        <Text style={styles.comboLabel}>COMBO</Text>
                        {group.items.map(item => (
                          <ReviewItem key={item.id} item={item} />
                        ))}
                      </View>
                    ) : (
                      <ReviewItem key={`${gi}-${group.items[0]?.id}`} item={group.items[0]!} />
                    )
                  )}
                </ScrollView>
              )}

              {/* Summary */}
              <View style={styles.summary}>
                <Text style={styles.summaryText}>
                  Total a enviar:{' '}
                  <Text style={styles.summaryAmount}>R$ {total.toFixed(2)}</Text>
                </Text>
              </View>

              {/* Error */}
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, busy && styles.btnDisabled]}
                  onPress={handleCancel}
                  disabled={busy}
                >
                  <Text style={styles.cancelBtnText}>
                    {cancelling ? 'Cancelando…' : 'Cancelar Pedido'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editBtn, busy && styles.btnDisabled]}
                  onPress={onClose}
                  disabled={busy}
                >
                  <Text style={styles.editBtnText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, (busy || items.length === 0) && styles.btnDisabled]}
                  onPress={handleConfirm}
                  disabled={busy || items.length === 0}
                >
                  <Text style={styles.confirmBtnText}>
                    {confirming ? 'Enviando…' : 'Confirmar e Enviar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

function ReviewItem({ item }: { item: OrderItemFull }) {
  const effectivePrice = item.final_price ?? item.menu_item.price
  const hasDiscount = (item.discount_amount ?? 0) > 0
  const zone = item.menu_item.routing_zone
  const zc = zoneColor(zone)

  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewItemNameRow}>
        <Text style={styles.reviewItemName} numberOfLines={1}>{item.menu_item.name}</Text>
        <View style={[styles.zoneBadge, { backgroundColor: zc.bg }]}>
          <Text style={[styles.zoneBadgeText, { color: zc.text }]}>{zone}</Text>
        </View>
      </View>
      <View style={styles.reviewItemDetails}>
        <Text style={styles.reviewItemQty}>Qtd: {item.quantity}</Text>
        <View style={styles.reviewItemPriceRow}>
          {hasDiscount && (
            <Text style={styles.reviewItemPriceOriginal}>
              R$ {(item.menu_item.price * item.quantity).toFixed(2)}
            </Text>
          )}
          <Text style={[styles.reviewItemPrice, hasDiscount && styles.reviewItemPriceGreen]}>
            R$ {(effectivePrice * item.quantity).toFixed(2)}
          </Text>
        </View>
      </View>
      {item.notes ? (
        <Text style={styles.reviewItemNotes}>{item.notes}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e0e0e0',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#888',
  },
  emptyText: {
    padding: 24,
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  itemsList: {
    maxHeight: 340,
    paddingHorizontal: 16,
  },
  reviewItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  reviewItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  reviewItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#e0e0e0',
  },
  zoneBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  zoneBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reviewItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewItemQty: {
    fontSize: 13,
    color: '#888',
  },
  reviewItemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewItemPriceOriginal: {
    fontSize: 12,
    color: '#555',
    textDecorationLine: 'line-through',
  },
  reviewItemPrice: {
    fontSize: 13,
    color: '#888',
  },
  reviewItemPriceGreen: {
    color: '#4ade80',
    fontWeight: '600',
  },
  reviewItemNotes: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  comboGroup: {
    borderWidth: 1,
    borderColor: 'rgba(142,68,173,0.3)',
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
  },
  comboLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a78bfa',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  summary: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#2e2e2e',
    alignItems: 'flex-end',
  },
  summaryText: {
    fontSize: 14,
    color: '#b0b0b0',
  },
  summaryAmount: {
    fontWeight: '700',
    color: '#e0e0e0',
  },
  errorBox: {
    marginHorizontal: 16,
    padding: 10,
    backgroundColor: '#3a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8b2020',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#e05050',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#3a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8b2020',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#e05050',
    fontSize: 12,
    fontWeight: '600',
  },
  editBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  editBtnText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    backgroundColor: '#3b6fd4',
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.45,
  },
})
