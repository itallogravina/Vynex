import { useState, useEffect } from 'react'
import { RoutingZone, ItemStatus, Priority } from '@vynex/shared'
import { useQueue } from '../hooks/useQueue'
import '../styles/QueueScreen.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function useTick(ms = 1000) {
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return tick
}

function fmtElapsed(sec: number) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function BarScreen() {
  const now = useTick()
  const { items, isConnected, error } = useQueue(RoutingZone.BAR)

  const updateStatus = async (itemId: string, orderId: string, newStatus: ItemStatus) => {
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

  return (
    <div className="queue-screen bar-screen">
      <header className="screen-header">
        <h1>Bar Queue</h1>
        <div className="connection-status">
          {isConnected ? (
            <span className="status-connected">● Connected</span>
          ) : (
            <span className="status-disconnected">● Offline</span>
          )}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="queue-container">
        {items.length === 0 ? (
          <div className="empty-queue">No items in queue</div>
        ) : (
          <div className="items-grid">
            {items.map(item => {
              const active = item.status === ItemStatus.PENDING || item.status === ItemStatus.PREPARING
              const elapsedSec = active ? Math.floor((now - new Date(item.created_at).getTime()) / 1000) : 0
              const isLate = active && item.menu_item.prep_time_seconds !== null && elapsedSec > item.menu_item.prep_time_seconds
              return (
                <div
                  key={item.id}
                  className={`queue-item item-status-${item.status} item-priority-${item.priority}${isLate ? ' item-delay-alert' : ''}`}
                >
                  <div className="item-header">
                    <h3>{item.menu_item.name}</h3>
                    <div className="item-header-right">
                      {item.priority !== Priority.NORMAL && (
                        <span className={`priority-badge priority-${item.priority}`}>
                          {item.priority.toUpperCase()}
                        </span>
                      )}
                      {active && (
                        <span className={`elapsed-timer${isLate ? ' elapsed-late' : ''}`}>
                          {fmtElapsed(elapsedSec)}
                          {isLate && <span className="elapsed-late-badge">LATE</span>}
                        </span>
                      )}
                      <span className="quantity">×{item.quantity}</span>
                    </div>
                  </div>
                  <div className="item-meta">
                    <p className="table-name">{item.order.table_name}</p>
                    <p className="status-badge">{item.status.toUpperCase()}</p>
                  </div>
                  {item.notes && <p className="item-notes">{item.notes}</p>}
                  <div className="item-actions">
                    {item.status === 'pending' && (
                      <button
                        className="btn btn-primary"
                        onClick={() => updateStatus(item.id, item.order_id, ItemStatus.PREPARING)}
                      >
                        Start Prep
                      </button>
                    )}
                    {item.status === 'preparing' && (
                      <button
                        className="btn btn-success"
                        onClick={() => updateStatus(item.id, item.order_id, ItemStatus.READY)}
                      >
                        Mark Ready
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
