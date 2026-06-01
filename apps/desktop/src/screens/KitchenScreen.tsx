import { useState, useEffect } from 'react'
import { RoutingZone, ItemStatus, Priority } from '@vynex/shared'
import { useQueue } from '../hooks/useQueue'
import { useServerUrl } from '../context/ServerUrlContext'
import '../styles/QueueScreen.css'

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

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export default function KitchenScreen() {
  const now = useTick()
  const { serverUrl } = useServerUrl()
  const { items, isConnected, error } = useQueue(RoutingZone.KITCHEN)
  const [completedOpen, setCompletedOpen] = useState(false)

  const activeItems = items.filter(
    i => i.status === ItemStatus.PENDING || i.status === ItemStatus.PREPARING
  )
  const completedItems = items.filter(
    i =>
      (i.status === ItemStatus.READY || i.status === ItemStatus.SERVED) &&
      new Date().getTime() - new Date(i.updated_at).getTime() < 12 * 60 * 60 * 1000
  )

  const updateStatus = async (itemId: string, orderId: string, newStatus: ItemStatus) => {
    try {
      const response = await fetch(`${serverUrl}/orders/${orderId}/items/${itemId}`, {
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
    <div className="queue-screen kitchen-screen">
      <header className="screen-header">
        <h1>Kitchen Queue</h1>
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
        {activeItems.length === 0 ? (
          <div className="empty-queue">No items in queue</div>
        ) : (
          <div className="items-grid">
            {activeItems.map(item => {
              const elapsedSec = Math.floor((now - new Date(item.created_at).getTime()) / 1000)
              const isLate = item.menu_item.prep_time_seconds !== null && elapsedSec > item.menu_item.prep_time_seconds
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
                      <span className={`elapsed-timer${isLate ? ' elapsed-late' : ''}`}>
                        {fmtElapsed(elapsedSec)}
                        {isLate && <span className="elapsed-late-badge">LATE</span>}
                      </span>
                      <span className="quantity">×{item.quantity}</span>
                    </div>
                  </div>
                  <div className="item-meta">
                    <p className="table-name">{item.order.table_name}</p>
                    <p className="status-badge">{item.status.toUpperCase()}</p>
                    <p className="item-timestamp">{fmtDateTime(item.created_at)}</p>
                  </div>
                  {item.notes && <p className="item-notes">{item.notes}</p>}
                  <div className="item-actions">
                    {item.status === ItemStatus.PENDING && (
                      <button
                        className="btn btn-primary"
                        onClick={() => updateStatus(item.id, item.order_id, ItemStatus.PREPARING)}
                      >
                        Start Cooking
                      </button>
                    )}
                    {item.status === ItemStatus.PREPARING && (
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

        {completedItems.length > 0 && (
          <div className="completed-section">
            <button
              className="completed-toggle"
              onClick={() => setCompletedOpen(o => !o)}
            >
              {completedOpen ? '▲' : '▼'} Completed this shift ({completedItems.length})
            </button>
            {completedOpen && (
              <div className="completed-grid">
                {completedItems.map(item => (
                  <div key={item.id} className={`queue-item item-status-${item.status} item-priority-${item.priority}`}>
                    <div className="item-header">
                      <h3>{item.menu_item.name}</h3>
                      <span className="quantity">×{item.quantity}</span>
                    </div>
                    <div className="item-meta">
                      <p className="table-name">{item.order.table_name}</p>
                      <p className="status-badge">{item.status.toUpperCase()}</p>
                      <p className="item-timestamp">{fmtDateTime(item.created_at)}</p>
                    </div>
                    {item.notes && <p className="item-notes">{item.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
