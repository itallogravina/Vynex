import { RoutingZone, ItemStatus } from '@vynex/shared'
import { useQueue } from '../hooks/useQueue'
import '../styles/QueueScreen.css'

export default function BarScreen() {
  const { items, isConnected, error } = useQueue(RoutingZone.BAR)

  const updateStatus = async (itemId: string, newStatus: ItemStatus) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    try {
      const response = await fetch(
        `http://localhost:3000/orders/${item.order_id}/items/${itemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      )
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
            {items.map(item => (
              <div key={item.id} className={`queue-item item-status-${item.status}`}>
                <div className="item-header">
                  <h3>{item.menu_item.name}</h3>
                  <span className="quantity">×{item.quantity}</span>
                </div>
                <div className="item-meta">
                  <p className="table-name">Table {item.order_id?.substring(0, 8)}</p>
                  <p className="status-badge">{item.status.toUpperCase()}</p>
                </div>
                {item.notes && <p className="item-notes">{item.notes}</p>}
                <div className="item-actions">
                  {item.status === 'pending' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => updateStatus(item.id, ItemStatus.PREPARING)}
                    >
                      Start Prep
                    </button>
                  )}
                  {item.status === 'preparing' && (
                    <button
                      className="btn btn-success"
                      onClick={() => updateStatus(item.id, ItemStatus.READY)}
                    >
                      Mark Ready
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
