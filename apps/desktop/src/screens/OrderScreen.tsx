import { useState, useEffect } from 'react'
import { Table, MenuItem, OrderRoutingMode, ItemStatus } from '@vynex/shared'
import { useOrder } from '../hooks/useOrder'
import '../styles/OrderScreen.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function OrderScreen() {
  const [tables, setTables] = useState<Table[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [routingMode, setRoutingMode] = useState<OrderRoutingMode>(OrderRoutingMode.MANUAL)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null)

  const { order, items, error: orderError, createOrder, addItem } = useOrder()

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch(`${API_URL}/tables`)
        if (!res.ok) throw new Error('Failed to load tables')
        const data = await res.json()
        setTables(data)
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load tables')
      }
    }

    const fetchMenuItems = async () => {
      try {
        const res = await fetch(`${API_URL}/menu-items`)
        if (!res.ok) throw new Error('Failed to load menu items')
        const data = await res.json()
        setMenuItems(data)
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load menu items')
      }
    }

    fetchTables()
    fetchMenuItems()
  }, [])

  const handleCreateOrder = async () => {
    if (!selectedTable) return
    setLoading(true)
    try {
      await createOrder(selectedTable, routingMode)
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = async (menuItem: MenuItem) => {
    try {
      await addItem(menuItem, quantity, notes || undefined)
      setQuantity(1)
      setNotes('')
    } catch {
      // error shown via orderError
    }
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
        return '#gray'
    }
  }

  if (!order) {
    return (
      <div className="order-screen">
        <div className="order-setup">
          <h2>Create Order</h2>

          {(fetchError || orderError) && (
            <div className="order-error">
              {fetchError || orderError}
            </div>
          )}

          <div className="form-group">
            <label>Table:</label>
            <select
              value={selectedTable}
              onChange={e => setSelectedTable(e.target.value)}
              disabled={loading}
            >
              <option value="">Select a table</option>
              {tables.map(table => (
                <option key={table.id} value={table.id}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Routing Mode:</label>
            <select
              value={routingMode}
              onChange={e => setRoutingMode(e.target.value as OrderRoutingMode)}
              disabled={loading}
            >
              <option value={OrderRoutingMode.MANUAL}>Manual (send items per-item)</option>
              <option value={OrderRoutingMode.AUTO}>Auto (send all at once)</option>
            </select>
          </div>

          <button onClick={handleCreateOrder} disabled={!selectedTable || loading}>
            {loading ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="order-screen">
      <div className="order-header">
        <h2>Order #{order.id.slice(0, 8)}</h2>
        <div className="order-info">
          <span>Table: {tables.find(t => t.id === order.table_id)?.name || 'Unknown'}</span>
          <span>Mode: {order.routing_mode.toUpperCase()}</span>
        </div>
      </div>

      <div className="order-layout">
        <div className="menu-panel">
          <h3>Menu</h3>
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <div className="menu-items">
            {filteredItems.map(item => (
              <div key={item.id} className="menu-item-card">
                <div className="item-header">
                  <span className="item-name">{item.name}</span>
                  <span className="item-price">${item.price.toFixed(2)}</span>
                </div>
                <span className="item-zone">{item.routing_zone}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="add-item-panel">
          <h3>Add Item</h3>
          <div className="form-group">
            <label>Item:</label>
            <select
              value={selectedMenuItem?.id || ''}
              onChange={e => {
                const item = menuItems.find(m => m.id === e.target.value)
                setSelectedMenuItem(item || null)
              }}
            >
              <option value="">Select item to add</option>
              {menuItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} (${item.price.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Quantity:</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          <div className="form-group">
            <label>Notes:</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Special requests..."
              rows={3}
            />
          </div>

          <button
            onClick={() => {
              if (selectedMenuItem) {
                handleAddItem(selectedMenuItem)
                setSelectedMenuItem(null)
              }
            }}
            disabled={!selectedMenuItem}
            className="add-button"
          >
            Add to Order
          </button>
        </div>

        <div className="order-summary">
          <h3>Order Summary</h3>
          <div className="order-items">
            {items.length === 0 ? (
              <p className="empty-message">No items added yet</p>
            ) : (
              items.map(item => (
                <div key={item.id} className="summary-item">
                  <div className="summary-item-header">
                    <span className="summary-item-name">{item.menu_item.name}</span>
                    <span
                      className="summary-item-status"
                      style={{ backgroundColor: statusColor(item.live_status || item.status) }}
                    >
                      {item.live_status || item.status}
                    </span>
                  </div>
                  <div className="summary-item-details">
                    <span>Qty: {item.quantity}</span>
                    <span>${(item.menu_item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.notes && <div className="summary-item-notes">{item.notes}</div>}
                </div>
              ))
            )}
          </div>

          {items.length > 0 && (
            <div className="order-total">
              <strong>
                Total: $
                {items
                  .reduce((sum, item) => sum + item.menu_item.price * item.quantity, 0)
                  .toFixed(2)}
              </strong>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
