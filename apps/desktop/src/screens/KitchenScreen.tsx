import { RoutingZone, ItemStatus } from '@vynex/shared'
import { useQueue } from '../hooks/useQueue'
import '../styles/QueueScreen.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function KitchenScreen() {
  const { items, isConnected, error } = useQueue(RoutingZone.KITCHEN)

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
                  {item.status === 'pending' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => updateStatus(item.id, item.order_id, ItemStatus.PREPARING)}
                    >
                      Start Cooking
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
