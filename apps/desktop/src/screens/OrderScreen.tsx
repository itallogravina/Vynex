import { useState, useEffect } from 'react'
import { Table, MenuItem, OrderRoutingMode, ItemStatus, Priority } from '@vynex/shared'
import { useOrder } from '../hooks/useOrder'
import { QuickOrderPopover } from '../components/QuickOrderPopover'
import TableOpsModal from '../components/TableOpsModal'
import '../styles/OrderScreen.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function OrderScreen() {
  const [tables, setTables] = useState<Table[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [routingMode, setRoutingMode] = useState<OrderRoutingMode>(OrderRoutingMode.MANUAL)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Quick order popover
  const [popoverItem, setPopoverItem] = useState<MenuItem | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null)

  // Table ops modal
  const [showTableOps, setShowTableOps] = useState(false)

  const { order, items, error: orderError, createOrder, addItem } = useOrder()

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch(`${API_URL}/tables`)
        if (!res.ok) throw new Error('Failed to load tables')
        setTables(await res.json())
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load tables')
      }
    }

    const fetchMenuItems = async () => {
      try {
        const res = await fetch(`${API_URL}/menu-items?time_filter=1`)
        if (!res.ok) throw new Error('Failed to load menu items')
        setMenuItems(await res.json())
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

  const handleQuickAdd = async (quantity: number, notes: string, priority: Priority, variations: string[]) => {
    if (!popoverItem) return
    try {
      await addItem(popoverItem, quantity, notes || undefined, priority, variations.length ? variations : undefined)
    } catch {
      // error shown via orderError
    } finally {
      setPopoverItem(null)
      setPopoverAnchor(null)
    }
  }

  const openPopover = (e: React.MouseEvent<HTMLDivElement>, item: MenuItem) => {
    if (item.eightysixed_at) return
    if (popoverItem?.id === item.id) {
      setPopoverItem(null)
      setPopoverAnchor(null)
    } else {
      setPopoverItem(item)
      setPopoverAnchor(e.currentTarget)
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
      default: return '#gray'
    }
  }

  if (!order) {
    return (
      <div className="order-screen">
        <div className="order-setup">
          <h2>Criar Pedido</h2>

          {(fetchError || orderError) && (
            <div className="order-error">{fetchError || orderError}</div>
          )}

          <div className="form-group">
            <label>Mesa:</label>
            <select value={selectedTable} onChange={e => setSelectedTable(e.target.value)} disabled={loading}>
              <option value="">Selecionar mesa</option>
              {tables.map(table => (
                <option key={table.id} value={table.id}>{table.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Modo de Roteamento:</label>
            <select value={routingMode} onChange={e => setRoutingMode(e.target.value as OrderRoutingMode)} disabled={loading}>
              <option value={OrderRoutingMode.MANUAL}>Manual (enviar item por item)</option>
              <option value={OrderRoutingMode.AUTO}>Automático (enviar tudo de uma vez)</option>
            </select>
          </div>

          <button onClick={handleCreateOrder} disabled={!selectedTable || loading}>
            {loading ? 'Criando...' : 'Criar Pedido'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="order-screen">
      <div className="order-header">
        <h2>Pedido #{order.id.slice(0, 8)}</h2>
        <div className="order-info">
          <span>Mesa: {tables.find(t => t.id === order.table_id)?.name || 'Desconhecida'}</span>
          <span>Modo: {order.routing_mode.toUpperCase()}</span>
          <button className="table-ops-btn" onClick={() => setShowTableOps(true)}>
            ⇄ Mesas
          </button>
        </div>
      </div>

      <div className="order-layout">
        <div className="menu-panel">
          <h3>Cardápio <span className="menu-hint">(clique para adicionar)</span></h3>
          <input
            type="text"
            placeholder="Buscar itens..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <div className="menu-items">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`menu-item-card${item.eightysixed_at ? ' card-eightysixed' : ''}`}
                onClick={(e) => order && !item.eightysixed_at && openPopover(e, item)}
                style={{ cursor: item.eightysixed_at ? 'not-allowed' : 'pointer' }}
              >
                <div className="item-header">
                  <span className="item-name">
                    {item.name}
                    {item.eightysixed_at && <span className="item-badge-86">86'd</span>}
                  </span>
                  <span className="item-price">R$ {item.price.toFixed(2)}</span>
                </div>
                <span className="item-zone">{item.routing_zone}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="order-summary">
          <h3>Resumo do Pedido</h3>
          <div className="order-items">
            {items.length === 0 ? (
              <p className="empty-message">Nenhum item adicionado</p>
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
                    <span>Qtd: {item.quantity}</span>
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
                Total: R$ {items.reduce((sum, item) => sum + item.menu_item.price * item.quantity, 0).toFixed(2)}
              </strong>
            </div>
          )}
        </div>
      </div>

      {popoverItem && popoverAnchor && (
        <QuickOrderPopover
          item={popoverItem}
          anchorEl={popoverAnchor}
          onAdd={handleQuickAdd}
          onClose={() => { setPopoverItem(null); setPopoverAnchor(null) }}
        />
      )}

      {showTableOps && order && (
        <TableOpsModal
          order={order}
          tables={tables}
          onClose={() => setShowTableOps(false)}
          onSuccess={() => { setShowTableOps(false); window.location.reload() }}
        />
      )}
    </div>
  )
}
