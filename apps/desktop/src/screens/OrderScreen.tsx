import { useState, useEffect } from 'react'
import { Table, MenuItem, OrderRoutingMode, ItemStatus } from '@vynex/shared'
import { useTranslation } from '@vynex/i18n'
import { useOrder } from '../hooks/useOrder'
import '../styles/OrderScreen.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function OrderScreen() {
  const { t } = useTranslation()
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

  const [quickItem, setQuickItem] = useState<MenuItem | null>(null)
  const [quickQty, setQuickQty] = useState(1)
  const [quickNotes, setQuickNotes] = useState('')
  const [quickAdding, setQuickAdding] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)

  const { order, items, error: orderError, createOrder, addItem } = useOrder()

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch(`${API_URL}/tables`)
        if (!res.ok) throw new Error('Failed to load tables')
        const data = await res.json()
        setTables(data)
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : t('errors.GENERAL_UNKNOWN'))
      }
    }

    const fetchMenuItems = async () => {
      try {
        const res = await fetch(`${API_URL}/menu-items`)
        if (!res.ok) throw new Error('Failed to load menu items')
        const data = await res.json()
        setMenuItems(data)
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : t('errors.GENERAL_UNKNOWN'))
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

  const openQuickOrder = (item: MenuItem) => {
    setQuickItem(item)
    setQuickQty(1)
    setQuickNotes('')
    setQuickError(null)
  }

  const handleQuickAdd = async () => {
    if (!quickItem) return
    setQuickAdding(true)
    setQuickError(null)
    try {
      await addItem(quickItem, quickQty, quickNotes || undefined)
      setQuickItem(null)
    } catch {
      setQuickError(orderError || t('errors.GENERAL_UNKNOWN'))
    } finally {
      setQuickAdding(false)
    }
  }

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const statusColor = (status: string) => {
    switch (status) {
      case ItemStatus.PENDING:    return '#ef4444'
      case ItemStatus.PREPARING:  return '#f97316'
      case ItemStatus.READY:      return '#22c55e'
      case ItemStatus.SERVED:     return '#3b82f6'
      case ItemStatus.BILLED:     return '#6b7280'
      default:                    return '#gray'
    }
  }

  if (!order) {
    return (
      <div className="order-screen">
        <div className="order-setup">
          <h2>{t('orders.createOrder')}</h2>

          {(fetchError || orderError) && (
            <div className="order-error">
              {fetchError || orderError}
            </div>
          )}

          <div className="form-group">
            <label>{t('orders.table')}:</label>
            <select
              value={selectedTable}
              onChange={e => setSelectedTable(e.target.value)}
              disabled={loading}
            >
              <option value="">{t('orders.selectTable')}</option>
              {tables.map(table => (
                <option key={table.id} value={table.id}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t('orders.routingMode')}:</label>
            <select
              value={routingMode}
              onChange={e => setRoutingMode(e.target.value as OrderRoutingMode)}
              disabled={loading}
            >
              <option value={OrderRoutingMode.MANUAL}>{t('orders.routingModeManual')}</option>
              <option value={OrderRoutingMode.AUTO}>{t('orders.routingModeAuto')}</option>
            </select>
          </div>

          <button onClick={handleCreateOrder} disabled={!selectedTable || loading}>
            {loading ? t('orders.creating') : t('orders.createOrder')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="order-screen">
      <div className="order-header">
        <h2>#{order.id.slice(0, 8)}</h2>
        <div className="order-info">
          <span>{t('orders.table')}: {tables.find(t_ => t_.id === order.table_id)?.name || t('orders.unknown')}</span>
          <span>{order.routing_mode.toUpperCase()}</span>
        </div>
      </div>

      <div className="order-layout">
        <div className="menu-panel">
          <h3>{t('nav.menu')}</h3>
          <input
            type="text"
            placeholder={t('orders.searchPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <div className="menu-items">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`menu-item-card ${item.eightysixed ? 'menu-item-card--eightysixed' : 'menu-item-card--selectable'}`}
                onClick={() => !item.eightysixed && openQuickOrder(item)}
                role={item.eightysixed ? undefined : 'button'}
                tabIndex={item.eightysixed ? undefined : 0}
                onKeyDown={e => { if (!item.eightysixed && (e.key === 'Enter' || e.key === ' ')) openQuickOrder(item) }}
              >
                <div className="item-header">
                  <span className="item-name">{item.name}</span>
                  <span className="item-price">R$ {item.price.toFixed(2)}</span>
                </div>
                <div className="item-footer">
                  <span className="item-zone">{item.routing_zone}</span>
                  {item.eightysixed && (
                    <span className="item-86-badge">{t('menu.outOfStock')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="add-item-panel">
          <h3>{t('orders.addItem')}</h3>
          <div className="form-group">
            <label>{t('orders.selectItem')}:</label>
            <select
              value={selectedMenuItem?.id || ''}
              onChange={e => {
                const item = menuItems.find(m => m.id === e.target.value)
                setSelectedMenuItem(item || null)
              }}
            >
              <option value="">{t('orders.selectItemToAdd')}</option>
              {menuItems.map(item => (
                <option key={item.id} value={item.id} disabled={item.eightysixed}>
                  {item.eightysixed ? `[${t('menu.outOfStock')}] ` : ''}{item.name} (${item.price.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t('orders.quantity')}:</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          <div className="form-group">
            <label>{t('orders.notes')}:</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('orders.specialRequests')}
              rows={3}
            />
          </div>

          <button
            onClick={() => {
              if (selectedMenuItem && !selectedMenuItem.eightysixed) {
                handleAddItem(selectedMenuItem)
                setSelectedMenuItem(null)
              }
            }}
            disabled={!selectedMenuItem || selectedMenuItem.eightysixed}
            className="add-button"
          >
            {t('orders.addToOrder')}
          </button>
        </div>

        <div className="order-summary">
          <h3>{t('orders.orderSummary')}</h3>
          <div className="order-items">
            {items.length === 0 ? (
              <p className="empty-message">{t('orders.noItemsYet')}</p>
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
                    <span>{t('orders.quantity')}: {item.quantity}</span>
                    <span>R$ {(item.menu_item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.notes && <div className="summary-item-notes">{item.notes}</div>}
                </div>
              ))
            )}
          </div>

          {items.length > 0 && (
            <div className="order-total">
              <strong>
                {t('common.total')}: R$
                {items
                  .reduce((sum, item) => sum + item.menu_item.price * item.quantity, 0)
                  .toFixed(2)}
              </strong>
            </div>
          )}
        </div>
      </div>

      {quickItem && (
        <div className="quick-order-overlay" onClick={() => setQuickItem(null)}>
          <div className="quick-order-modal" onClick={e => e.stopPropagation()}>
            <h3 className="quick-order-title">{t('orders.quickAdd')}</h3>
            <p className="quick-order-item-name">{quickItem.name}</p>
            <p className="quick-order-item-price">R$ {quickItem.price.toFixed(2)}</p>

            <div className="form-group">
              <label>{t('orders.quantity')}</label>
              <div className="qty-stepper">
                <button className="qty-btn" onClick={() => setQuickQty(q => Math.max(1, q - 1))}>−</button>
                <span className="qty-value">{quickQty}</span>
                <button className="qty-btn" onClick={() => setQuickQty(q => q + 1)}>+</button>
              </div>
            </div>

            <div className="form-group">
              <label>{t('orders.notes')}</label>
              <textarea
                value={quickNotes}
                onChange={e => setQuickNotes(e.target.value)}
                placeholder={t('orders.specialRequests')}
                rows={2}
              />
            </div>

            {quickError && <div className="quick-order-error">{quickError}</div>}

            <div className="quick-order-actions">
              <button className="quick-cancel-btn" onClick={() => setQuickItem(null)}>
                {t('common.cancel')}
              </button>
              <button className="add-button quick-add-btn" onClick={handleQuickAdd} disabled={quickAdding}>
                {quickAdding ? t('common.loading') : t('orders.addToOrder')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
