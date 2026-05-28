import { useState, useEffect, useRef } from 'react'
import { RoutingZone, ItemStatus, OpenOrder } from '@vynex/shared'
import { useQueue } from '../hooks/useQueue'
import '../styles/QueueScreen.css'
import '../styles/CashierScreen.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws'

type Tab = 'queue' | 'bills'

export default function CashierScreen() {
  const { items, isConnected, error } = useQueue(RoutingZone.CASHIER)
  const [tab, setTab] = useState<Tab>('queue')
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([])
  const [loadingBills, setLoadingBills] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [billsError, setBillsError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)

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

  // Fetch open orders when Bills tab is active
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

  // Listen for order:closed WS events to auto-refresh bills tab
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}?zones=cashier`)
    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'order:closed') {
          setRefreshKey(k => k + 1)
        }
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

  return (
    <div className="queue-screen cashier-screen">
      <header className="screen-header">
        <h1>Cashier</h1>
        <div className="cashier-tabs">
          <button
            className={`tab-btn ${tab === 'queue' ? 'active' : ''}`}
            onClick={() => setTab('queue')}
          >
            Queue
          </button>
          <button
            className={`tab-btn ${tab === 'bills' ? 'active' : ''}`}
            onClick={() => setTab('bills')}
          >
            Bills
            {openOrders.length > 0 && tab !== 'bills' && (
              <span className="tab-badge">{openOrders.length}</span>
            )}
          </button>
        </div>
        {tab === 'queue' && (
          <div className="connection-status">
            {isConnected ? (
              <span className="status-connected">● Connected</span>
            ) : (
              <span className="status-disconnected">● Offline</span>
            )}
          </div>
        )}
      </header>

      {/* Queue Tab */}
      {tab === 'queue' && (
        <>
          {error && <div className="error-banner">{error}</div>}
          <div className="queue-container">
            {items.length === 0 ? (
              <div className="empty-queue">No items in queue</div>
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
                        <button
                          className="btn btn-success"
                          onClick={() => updateItemStatus(item.id, item.order_id, ItemStatus.SERVED)}
                        >
                          Served
                        </button>
                      )}
                      {item.status === 'served' && (
                        <button
                          className="btn btn-info"
                          onClick={() => updateItemStatus(item.id, item.order_id, ItemStatus.BILLED)}
                        >
                          Billed
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
            <div className="empty-queue">Loading open orders…</div>
          ) : openOrders.length === 0 ? (
            <div className="empty-queue">No open orders</div>
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
                        <span className="bill-item-name">
                          {item.quantity}× {item.menu_item.name}
                        </span>
                        <span className="bill-item-price">
                          R$ {(item.quantity * item.menu_item.price).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="bill-total-row">
                    <span>Total</span>
                    <span className="bill-total-amount">R$ {order.total.toFixed(2)}</span>
                  </div>

                  <div className="bill-actions">
                    <button
                      className="btn btn-cash"
                      disabled={closingId === order.id}
                      onClick={() => handleClose(order.id, 'cash')}
                    >
                      {closingId === order.id ? 'Closing…' : 'Pay Cash'}
                    </button>
                    <button
                      className="btn btn-card"
                      disabled={closingId === order.id}
                      onClick={() => handleClose(order.id, 'card')}
                    >
                      {closingId === order.id ? 'Closing…' : 'Pay Card'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
