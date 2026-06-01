import { useState, useEffect, useRef } from 'react'
import { RoutingZone, ItemStatus, OpenOrder } from '@vynex/shared'
import type { CashierClosingSummary } from '@vynex/shared'
import { useQueue } from '../hooks/useQueue'
import { useTranslation } from '../context/I18nContext'
import '../styles/QueueScreen.css'
import '../styles/CashierScreen.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws'

type Tab = 'queue' | 'bills' | 'closing'

export default function CashierScreen() {
  const { items, isConnected, error } = useQueue(RoutingZone.CASHIER)
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('queue')
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([])
  const [loadingBills, setLoadingBills] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [billsError, setBillsError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)

  // Closing state
  const [closingSummary, setClosingSummary] = useState<CashierClosingSummary | null>(null)
  const [closingLoading, setClosingLoading] = useState(false)
  const [closingError, setClosingError] = useState<string | null>(null)
  const [closingDone, setClosingDone] = useState(false)

  const updateItemStatus = async (itemId: string, orderId: string, newStatus: ItemStatus) => {
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!response.ok) throw new Error('Failed to update status')
    } catch (err) {
      console.error('Error updating item status:', err)
    }
  }

  useEffect(() => {
    if (tab !== 'bills') return
    setLoadingBills(true)
    setBillsError(null)
    fetch(`${API_URL}/orders/open`)
      .then(r => r.json())
      .then(data => setOpenOrders(data))
      .catch(() => setBillsError('Failed to load open orders'))
      .finally(() => setLoadingBills(false))
  }, [tab, refreshKey])

  useEffect(() => {
    if (tab !== 'closing') return
    setClosingLoading(true)
    setClosingError(null)
    fetch(`${API_URL}/cashier/closing-summary`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(setClosingSummary)
      .catch(() => setClosingError('Falha ao carregar resumo.'))
      .finally(() => setClosingLoading(false))
  }, [tab, refreshKey])

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}?zones=cashier`)
    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'order:closed') setRefreshKey(k => k + 1)
      } catch {}
    }
    wsRef.current = ws
    return () => ws.close()
  }, [])

  const handleClose = async (orderId: string, paymentMethod: 'cash' | 'card') => {
    setClosingId(orderId)
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: paymentMethod }),
      })
      if (!res.ok) throw new Error('Failed to close order')
      setRefreshKey(k => k + 1)
    } catch (err) {
      console.error('Error closing order:', err)
    } finally {
      setClosingId(null)
    }
  }

  const handleCloseDay = async (force = false) => {
    setClosingLoading(true)
    setClosingError(null)
    try {
      const res = await fetch(`${API_URL}/cashier/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'OPEN_ORDERS_EXIST') {
          setClosingError(`${data.orders_open} pedido(s) ainda aberto(s). Use "Forçar" para fechar mesmo assim.`)
        } else {
          setClosingError(data.error || 'Falha ao fechar o dia.')
        }
        return
      }
      setClosingDone(true)
    } catch {
      setClosingError('Erro ao comunicar com o servidor.')
    } finally {
      setClosingLoading(false)
    }
  }

  return (
    <div className="queue-screen cashier-screen">
      <header className="screen-header">
        <h1>{t('cashier.title')}</h1>
        <div className="cashier-tabs">
          {(['queue', 'bills', 'closing'] as Tab[]).map(id => (
            <button
              key={id}
              className={`tab-btn ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              {id === 'queue' ? 'Fila' : id === 'bills' ? t('cashier.openOrders') : t('cashier.closeDay')}
              {id === 'bills' && openOrders.length > 0 && tab !== 'bills' && (
                <span className="tab-badge">{openOrders.length}</span>
              )}
            </button>
          ))}
        </div>
        {tab === 'queue' && (
          <div className="connection-status">
            {isConnected
              ? <span className="status-connected">● {t('queue.connected')}</span>
              : <span className="status-disconnected">● {t('queue.offline')}</span>}
          </div>
        )}
      </header>

      {/* Queue Tab */}
      {tab === 'queue' && (
        <>
          {error && <div className="error-banner">{error}</div>}
          <div className="queue-container">
            {items.length === 0 ? (
              <div className="empty-queue">{t('queue.noItems')}</div>
            ) : (
              <div className="items-grid">
                {items.map(item => (
                  <div key={item.id} className={`queue-item item-status-${item.status}`}>
                    <div className="item-header">
                      <h3>{item.menu_item.name}</h3>
                      <span className="quantity">×{item.quantity}</span>
                    </div>
                    <div className="item-meta">
                      <p className="table-name">{item.order.table_name}</p>
                      <p className="status-badge">{item.status.toUpperCase()}</p>
                    </div>
                    {item.notes && <p className="item-notes">{item.notes}</p>}
                    <div className="item-actions">
                      {item.status === 'ready' && (
                        <button className="btn btn-success" onClick={() => updateItemStatus(item.id, item.order_id, ItemStatus.SERVED)}>
                          Servido
                        </button>
                      )}
                      {item.status === 'served' && (
                        <button className="btn btn-info" onClick={() => updateItemStatus(item.id, item.order_id, ItemStatus.BILLED)}>
                          Faturado
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Bills Tab */}
      {tab === 'bills' && (
        <div className="bills-container">
          {billsError && <div className="error-banner">{billsError}</div>}
          {loadingBills ? (
            <div className="empty-queue">{t('common.loading')}</div>
          ) : openOrders.length === 0 ? (
            <div className="empty-queue">{t('cashier.noOpenOrders')}</div>
          ) : (
            <div className="bills-grid">
              {openOrders.map(order => (
                <div key={order.id} className="bill-card">
                  <div className="bill-header">
                    <h2 className="bill-table">{order.table_name}</h2>
                    <span className="bill-time">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="bill-items">
                    {order.items.map(item => (
                      <div key={item.id} className="bill-item-row">
                        <span className="bill-item-name">{item.quantity}× {item.menu_item.name}</span>
                        <span className="bill-item-price">R$ {(item.quantity * item.menu_item.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bill-total-row">
                    <span>{t('common.total')}</span>
                    <span className="bill-total-amount">R$ {order.total.toFixed(2)}</span>
                  </div>
                  <div className="bill-actions">
                    <button className="btn btn-cash" disabled={closingId === order.id} onClick={() => handleClose(order.id, 'cash')}>
                      {closingId === order.id ? t('cashier.closing') : t('cashier.cash')}
                    </button>
                    <button className="btn btn-card" disabled={closingId === order.id} onClick={() => handleClose(order.id, 'card')}>
                      {closingId === order.id ? t('cashier.closing') : t('cashier.card')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Closing Tab */}
      {tab === 'closing' && (
        <div className="closing-container">
          <h2>{t('cashier.closingDay')}</h2>
          {closingError && <div className="error-banner">{closingError}</div>}
          {closingDone && (
            <div className="closing-done">
              ✓ Dia fechado com sucesso!
            </div>
          )}
          {closingLoading && <div className="empty-queue">{t('common.loading')}</div>}
          {closingSummary && !closingDone && (
            <div className="closing-summary">
              <div className="closing-stat">
                <span>{t('cashier.ordersClosed')}</span>
                <strong>{closingSummary.orders_closed}</strong>
              </div>
              <div className="closing-stat">
                <span>{t('cashier.ordersOpen')}</span>
                <strong className={closingSummary.orders_open > 0 ? 'text-warn' : ''}>{closingSummary.orders_open}</strong>
              </div>
              <div className="closing-stat">
                <span>Dinheiro</span>
                <strong>R$ {closingSummary.revenue_by_payment.cash.toFixed(2)}</strong>
              </div>
              <div className="closing-stat">
                <span>Cartão</span>
                <strong>R$ {closingSummary.revenue_by_payment.card.toFixed(2)}</strong>
              </div>
              <div className="closing-stat closing-total">
                <span>{t('common.total')}</span>
                <strong>R$ {closingSummary.total_revenue.toFixed(2)}</strong>
              </div>
              {closingSummary.top_items.length > 0 && (
                <div className="closing-top-items">
                  <h4>Mais vendidos</h4>
                  {closingSummary.top_items.map(item => (
                    <div key={item.name} className="closing-top-row">
                      <span>{item.name}</span>
                      <span>{item.quantity}x — R$ {item.revenue.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="closing-actions">
                <button className="btn btn-primary" onClick={() => handleCloseDay(false)} disabled={closingLoading}>
                  {t('cashier.confirmClose')}
                </button>
                {closingSummary.orders_open > 0 && (
                  <button className="btn btn-danger" onClick={() => handleCloseDay(true)} disabled={closingLoading}>
                    {t('cashier.forceClose')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
