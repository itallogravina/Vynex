import { useState } from 'react'
import { Order, RoutingZone } from '@vynex/shared'
import { OrderItemWithStatus } from '../hooks/useOrder'
import '../styles/OrderReviewModal.css'

type Props = {
  order: Order
  items: OrderItemWithStatus[]
  onClose: () => void
  onConfirm: () => Promise<void>
  onCancel: () => Promise<void>
}

function zoneBadgeClass(zone: RoutingZone): string {
  switch (zone) {
    case RoutingZone.KITCHEN:  return 'review-zone-badge--kitchen'
    case RoutingZone.BAR:      return 'review-zone-badge--bar'
    case RoutingZone.CASHIER:  return 'review-zone-badge--cashier'
    default:                   return 'review-zone-badge--table'
  }
}

export function OrderReviewModal({ order: _order, items, onClose, onConfirm, onCancel }: Props) {
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

  // Group combo items by combo_group_id
  type Group = { comboGroupId: string | null; items: OrderItemWithStatus[] }
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

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="order-review-modal">
        <div className="review-modal-header">
          <h3 className="review-modal-title">Revisar Pedido</h3>
          <button className="review-modal-close" onClick={onClose}>✕</button>
        </div>

        {items.length === 0 ? (
          <p className="review-empty">Nenhum item aguardando envio.</p>
        ) : (
          <div className="review-items-list">
            {groups.map((group, gi) =>
              group.comboGroupId ? (
                <div key={group.comboGroupId} className="review-combo-group">
                  <div className="review-combo-label">COMBO</div>
                  {group.items.map(item => (
                    <ReviewItem key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <ReviewItem key={`${gi}-${group.items[0]?.id}`} item={group.items[0]!} />
              )
            )}
          </div>
        )}

        <div className="review-summary">
          Total a enviar: <strong>R$ {total.toFixed(2)}</strong>
        </div>

        {error && <div className="review-error">{error}</div>}

        <div className="review-actions">
          <button
            className="btn-cancel-order"
            onClick={handleCancel}
            disabled={cancelling || confirming}
          >
            {cancelling ? 'Cancelando…' : 'Cancelar Pedido'}
          </button>
          <button className="btn-review-edit" onClick={onClose} disabled={cancelling || confirming}>
            Editar
          </button>
          <button
            className="btn-confirm-send"
            onClick={handleConfirm}
            disabled={confirming || cancelling || items.length === 0}
          >
            {confirming ? 'Enviando…' : 'Confirmar e Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewItem({ item }: { item: OrderItemWithStatus }) {
  const effectivePrice = item.final_price ?? item.menu_item.price
  const hasDiscount = (item.discount_amount ?? 0) > 0
  const zone = item.menu_item.routing_zone

  return (
    <div className="review-item">
      <div className="review-item-name-row">
        <span className="review-item-name">{item.menu_item.name}</span>
        <span className={`review-zone-badge ${zoneBadgeClass(zone)}`}>{zone}</span>
      </div>
      <div className="review-item-details">
        <span className="review-item-qty">Qtd: {item.quantity}</span>
        <span className="review-item-price">
          {hasDiscount && (
            <span className="review-item-price-original">
              R$ {(item.menu_item.price * item.quantity).toFixed(2)}
            </span>
          )}
          {' '}
          <span className={hasDiscount ? 'review-item-price-effective' : ''}>
            R$ {(effectivePrice * item.quantity).toFixed(2)}
          </span>
        </span>
      </div>
      {item.notes && <div className="review-item-notes">{item.notes}</div>}
    </div>
  )
}
