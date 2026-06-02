import { useState, useEffect, useRef } from 'react'
import { RoutingZone, ItemStatus, OpenOrder, OrderItem, MenuItem } from '@vynex/shared'
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
  const [closingTableId, setClosingTableId] = useState<string | null>(null)
  const [billsError, setBillsError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tabFilter, setTabFilter] = useState('')
  const [pendingTabNums, setPendingTabNums] = useState<Record<string, string>>({})
  const [savingTab, setSavingTab] = useState<string | null>(null)
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

  const handleCloseTable = async (tableId: string, orderIds: string[], paymentMethod: 'cash' | 'card') => {
    setClosingTableId(tableId)
    try {
      for (const orderId of orderIds) {
        const res = await fetch(`${API_URL}/orders/${orderId}/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_method: paymentMethod }),
        })
        if (!res.ok) throw new Error('Failed to close order')
      }
      setRefreshKey(k => k + 1)
    } catch (err) {
      console.error('Error closing table orders:', err)
    } finally {
      setClosingTableId(null)
    }
  }

  const saveTabNumber = async (orderId: string, value: string) => {
    setSavingTab(orderId)
    try {
      await fetch(`${API_URL}/orders/${orderId}/tab-number`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab_number: value.trim() || null }),
      })
      setRefreshKey(k => k + 1)
    } catch (err) {
      console.error('Error saving tab number:', err)
    } finally {
      setSavingTab(null)
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
                <span className="tab-badge">{new Set(openOrders.map(o => o.table_id)).size}</span>
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
          ) : (() => {
            type BillItem = OrderItem & { menu_item: MenuItem }
            type SplitSection = { key: string; items: BillItem[]; subtotal: number }
            type TableGroup = {
              table_id: string; table_name: string; orderIds: string[]
              primaryOrderId: string; allItems: BillItem[]; total: number
              hasSplits: boolean; splits: SplitSection[]; openedAt: string
              tabNumber: string | undefined; minConsumption: number | undefined
            }

            const tableMap: Record<string, TableGroup> = {}
            for (const order of openOrders) {
              if (!tableMap[order.table_id]) {
                tableMap[order.table_id] = {
                  table_id: order.table_id, table_name: order.table_name,
                  orderIds: [], primaryOrderId: order.id, allItems: [], total: 0,
                  hasSplits: false, splits: [], openedAt: order.created_at,
                  tabNumber: order.tab_number, minConsumption: order.min_consumption,
                }
              }
              const tg = tableMap[order.table_id]!
              tg.orderIds.push(order.id)
              tg.total += order.total
              tg.allItems.push(...order.items)
              if (order.split_group_id) tg.hasSplits = true
              if (order.created_at < tg.openedAt) tg.openedAt = order.created_at
              if (!tg.tabNumber && order.tab_number) tg.tabNumber = order.tab_number
            }
            let tableGroups = Object.values(tableMap)
            for (const tg of tableGroups) {
              if (tg.hasSplits) {
                const splitMap: Record<string, SplitSection> = {}
                for (const order of openOrders.filter(o => o.table_id === tg.table_id)) {
                  const key = order.split_group_id ?? order.id
                  if (!splitMap[key]) splitMap[key] = { key, items: [], subtotal: 0 }
                  splitMap[key].items.push(...order.items)
                  splitMap[key].subtotal += order.total
                }
                tg.splits = Object.values(splitMap)
              }
            }

            const needle = tabFilter.trim().toLowerCase()
            if (needle) {
              tableGroups = tableGroups.filter(tg =>
                tg.tabNumber?.toLowerCase().includes(needle) ||
                tg.table_name.toLowerCase().includes(needle)
              )
            }

            return (
              <>
                <div style={{ padding: '0.75rem 1rem 0' }}>
                  <input
                    className="tab-filter-input"
                    type="text"
                    placeholder="Filtrar por comanda / mesa…"
                    value={tabFilter}
                    onChange={e => setTabFilter(e.target.value)}
                    style={{ width: '100%', maxWidth: 320, padding: '0.4rem 0.75rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: 'inherit', fontSize: '0.875rem' }}
                  />
                </div>
                <div className="bills-grid">
                  {tableGroups.length === 0 ? (
                    <div className="empty-queue">Nenhuma comanda encontrada.</div>
                  ) : tableGroups.map(tg => {
                    const pendingVal = pendingTabNums[tg.primaryOrderId] ?? tg.tabNumber ?? ''
                    const isDirty = pendingVal !== (tg.tabNumber ?? '')
                    const belowMin = tg.minConsumption != null && tg.total < tg.minConsumption

                    return (
                      <div key={tg.table_id} className="bill-card">
                        <div className="bill-header">
                          <h2 className="bill-table">{tg.table_name}</h2>
                          <span className="bill-time">
                            {new Date(tg.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Tab number field */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <span style={{ fontSize: '0.75rem', opacity: 0.6, whiteSpace: 'nowrap' }}>Comanda</span>
                          <input
                            type="text"
                            value={pendingVal}
                            placeholder="—"
                            onChange={e => setPendingTabNums(p => ({ ...p, [tg.primaryOrderId]: e.target.value }))}
                            onBlur={() => {
                              if (isDirty) saveTabNumber(tg.primaryOrderId, pendingVal)
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur()
                              }
                            }}
                            disabled={savingTab === tg.primaryOrderId}
                            style={{ flex: 1, minWidth: 0, padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: 'inherit', fontSize: '0.875rem' }}
                          />
                          {isDirty && (
                            <button
                              className="btn btn-primary"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => saveTabNumber(tg.primaryOrderId, pendingVal)}
                              disabled={savingTab === tg.primaryOrderId}
                            >
                              ✓
                            </button>
                          )}
                        </div>

                        {tg.hasSplits ? (
                          tg.splits.map((split, idx) => (
                            <div key={split.key} className="bill-split-section">
                              {idx > 0 && <div className="bill-split-divider" />}
                              <div className="bill-split-label">Conta {idx + 1}</div>
                              <div className="bill-items">
                                {split.items.map(item => (
                                  <div key={item.id} className="bill-item-row">
                                    <span className="bill-item-name">
                                      {item.quantity}× {item.menu_item.name}
                                      {item.combo_group_id && <span className="bill-badge-combo">COMBO</span>}
                                    </span>
                                    <span className="bill-item-price">
                                      R$ {(item.quantity * (item.final_price ?? item.menu_item.price)).toFixed(2)}
                                      {(item.discount_amount ?? 0) > 0 && (
                                        <span className="bill-discount-tag">-R$ {((item.discount_amount ?? 0) * item.quantity).toFixed(2)}</span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="bill-subtotal-row">
                                <span>Subtotal</span>
                                <span>R$ {split.subtotal.toFixed(2)}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="bill-items">
                            {tg.allItems.map(item => (
                              <div key={item.id} className="bill-item-row">
                                <span className="bill-item-name">
                                  {item.quantity}× {item.menu_item.name}
                                  {item.combo_group_id && <span className="bill-badge-combo">COMBO</span>}
                                </span>
                                <span className="bill-item-price">
                                  R$ {(item.quantity * (item.final_price ?? item.menu_item.price)).toFixed(2)}
                                  {(item.discount_amount ?? 0) > 0 && (
                                    <span className="bill-discount-tag">-R$ {((item.discount_amount ?? 0) * item.quantity).toFixed(2)}</span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="bill-total-row">
                          <span>{t('common.total')}</span>
                          <span className="bill-total-amount">R$ {tg.total.toFixed(2)}</span>
                        </div>

                        {belowMin && (
                          <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.5)', borderRadius: 6, padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#e74c3c', marginBottom: '0.5rem' }}>
                            Consumo mínimo: R$ {tg.minConsumption!.toFixed(2)} — faltam R$ {(tg.minConsumption! - tg.total).toFixed(2)}
                          </div>
                        )}

                        <div className="bill-actions">
                          <button className="btn btn-cash" disabled={closingTableId === tg.table_id} onClick={() => handleCloseTable(tg.table_id, tg.orderIds, 'cash')}>
                            {closingTableId === tg.table_id ? t('cashier.closing') : t('cashier.cash')}
                          </button>
                          <button className="btn btn-card" disabled={closingTableId === tg.table_id} onClick={() => handleCloseTable(tg.table_id, tg.orderIds, 'card')}>
                            {closingTableId === tg.table_id ? t('cashier.closing') : t('cashier.card')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}
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
