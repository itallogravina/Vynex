import { useState } from 'react'
import type { Order, Table, OpenOrder } from '@vynex/shared'
import { useServerUrl } from '../context/ServerUrlContext'
import { useTranslation } from '../context/I18nContext'
import '../styles/TableOpsModal.css'

type Tab = 'transfer' | 'merge' | 'split'

type Props = {
  order: Order
  tables: Table[]
  onClose: () => void
  onSuccess: () => void
}

export default function TableOpsModal({ order, tables, onClose, onSuccess }: Props) {
  const { serverUrl } = useServerUrl()
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('transfer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Transfer
  const [toTableId, setToTableId] = useState('')

  // Merge
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([])
  const [intoOrderId, setIntoOrderId] = useState('')
  const [ordersLoaded, setOrdersLoaded] = useState(false)

  // Split
  const [splitMode, setSplitMode] = useState<'equal' | 'items'>('equal')
  const [splitParts, setSplitParts] = useState(2)
  const [orderItems, setOrderItems] = useState<OpenOrder['items']>([])
  const [orderItemsLoaded, setOrderItemsLoaded] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])

  const loadOpenOrders = async () => {
    if (ordersLoaded) return
    try {
      const res = await fetch(`${serverUrl}/orders/open`)
      if (res.ok) {
        const data: OpenOrder[] = await res.json()
        setOpenOrders(data.filter(o => o.id !== order.id))
      }
    } catch {}
    setOrdersLoaded(true)
  }

  const loadOrderItems = async () => {
    if (orderItemsLoaded) return
    try {
      const res = await fetch(`${serverUrl}/orders/open`)
      if (res.ok) {
        const all: OpenOrder[] = await res.json()
        const found = all.find(o => o.id === order.id)
        setOrderItems(found?.items ?? [])
      }
    } catch {}
    setOrderItemsLoaded(true)
  }

  const toggleItem = (id: string) =>
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  const doTransfer = async () => {
    if (!toTableId) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${serverUrl}/orders/${order.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_table_id: toTableId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Transfer failed')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transfer failed')
    } finally { setLoading(false) }
  }

  const doMerge = async () => {
    if (!intoOrderId) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${serverUrl}/orders/${order.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ into_order_id: intoOrderId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Merge failed')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed')
    } finally { setLoading(false) }
  }

  const doSplit = async () => {
    setLoading(true); setError(null)
    try {
      const body = splitMode === 'equal'
        ? { mode: 'equal', parts: splitParts }
        : { mode: 'items', item_ids: selectedItemIds }
      const res = await fetch(`${serverUrl}/orders/${order.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Split failed')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Split failed')
    } finally { setLoading(false) }
  }

  const otherTables = tables.filter(t => t.id !== order.table_id)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="table-ops-modal">
        <div className="modal-header">
          <h3>Operações de Mesa</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          {(['transfer', 'merge', 'split'] as Tab[]).map(id => (
            <button
              key={id}
              className={`modal-tab ${tab === id ? 'active' : ''}`}
              onClick={() => { setTab(id); setError(null); if (id === 'merge') loadOpenOrders() }}
            >
              {id === 'transfer' ? t('tables.transfer') : id === 'merge' ? t('tables.merge') : t('tables.split')}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {error && <div className="modal-error">{error}</div>}

          {tab === 'transfer' && (
            <div className="ops-section">
              <p>Mover o pedido #{order.id.slice(0, 8)} para outra mesa:</p>
              <select value={toTableId} onChange={e => setToTableId(e.target.value)}>
                <option value="">Selecionar mesa de destino</option>
                {otherTables.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button onClick={doTransfer} disabled={!toTableId || loading} className="btn-primary">
                {loading ? 'Transferindo...' : 'Transferir'}
              </button>
            </div>
          )}

          {tab === 'merge' && (
            <div className="ops-section">
              <p>Unir o pedido #{order.id.slice(0, 8)} com outro pedido aberto:</p>
              <select value={intoOrderId} onChange={e => setIntoOrderId(e.target.value)}>
                <option value="">Selecionar pedido de destino</option>
                {openOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.table_name} — #{o.id.slice(0, 6)} ({o.items.length} itens)
                  </option>
                ))}
              </select>
              {openOrders.length === 0 && ordersLoaded && (
                <p className="ops-empty">Nenhum outro pedido aberto.</p>
              )}
              <button onClick={doMerge} disabled={!intoOrderId || loading} className="btn-primary">
                {loading ? 'Unindo...' : 'Unir Pedidos'}
              </button>
            </div>
          )}

          {tab === 'split' && (
            <div className="ops-section">
              <div className="split-mode">
                <label>
                  <input type="radio" name="splitMode" value="equal" checked={splitMode === 'equal'} onChange={() => setSplitMode('equal')} />
                  Divisão igual
                </label>
                <label>
                  <input type="radio" name="splitMode" value="items" checked={splitMode === 'items'} onChange={() => { setSplitMode('items'); loadOrderItems() }} />
                  Selecionar itens
                </label>
              </div>
              {splitMode === 'equal' && (
                <div className="form-group">
                  <label>Número de partes:</label>
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={splitParts}
                    onChange={e => setSplitParts(Math.max(2, parseInt(e.target.value) || 2))}
                  />
                </div>
              )}
              {splitMode === 'items' && (
                <div className="split-items-list">
                  {!orderItemsLoaded && <p className="ops-note">Carregando itens...</p>}
                  {orderItemsLoaded && orderItems.length === 0 && (
                    <p className="ops-empty">Nenhum item no pedido.</p>
                  )}
                  {orderItems.map(item => (
                    <label key={item.id} className="split-item-row">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                      />
                      <span className="split-item-name">{item.menu_item.name}</span>
                      <span className="split-item-qty">×{item.quantity}</span>
                      <span className="split-item-price">
                        R$ {(item.menu_item.price * item.quantity).toFixed(2)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <button onClick={doSplit} disabled={loading || (splitMode === 'items' && selectedItemIds.length === 0)} className="btn-primary">
                {loading ? 'Dividindo...' : 'Dividir Conta'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
