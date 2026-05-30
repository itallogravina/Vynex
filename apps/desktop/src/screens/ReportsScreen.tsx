import { useState, useEffect, useCallback } from 'react'
import { SalesReport, TopItemsReport, PerWaiterReport, ShiftSummaryReport } from '@vynex/shared'
import { useTranslation } from '@vynex/i18n'
import { useApi } from '../lib/api'

type ReportTab = 'sales' | 'top-items' | 'per-waiter' | 'shift'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function ReportsScreen() {
  const { t } = useTranslation()
  const api = useApi()
  const [tab, setTab] = useState<ReportTab>('sales')
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sales, setSales] = useState<SalesReport | null>(null)
  const [topItems, setTopItems] = useState<TopItemsReport | null>(null)
  const [perWaiter, setPerWaiter] = useState<PerWaiterReport | null>(null)
  const [shift, setShift] = useState<ShiftSummaryReport | null>(null)

  const toDate = to ? to + 'T23:59:59' : todayStr() + 'T23:59:59'
  const fromDate = from ? from + 'T00:00:00' : monthStartStr() + 'T00:00:00'

  const fetchReport = useCallback(async () => {
    setLoading(true); setError(null)
    const q = `from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`
    try {
      if (tab === 'sales') {
        const data = await api.get<SalesReport>(`/reports/sales?${q}&group_by=day`)
        setSales(data)
      } else if (tab === 'top-items') {
        const data = await api.get<TopItemsReport>(`/reports/top-items?${q}&limit=10`)
        setTopItems(data)
      } else if (tab === 'per-waiter') {
        const data = await api.get<PerWaiterReport>(`/reports/per-waiter?${q}`)
        setPerWaiter(data)
      } else {
        const data = await api.get<ShiftSummaryReport>(`/reports/shift?${q}`)
        setShift(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.GENERAL_UNKNOWN'))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, fromDate, toDate, api.serverUrl, api.token])

  useEffect(() => { fetchReport() }, [fetchReport])

  async function handleExport() {
    const q = `type=${tab}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`
    try {
      const blob = await api.getBlob(`/reports/export?${q}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vynex-report-${tab}-${from}-${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(t('reports.exportFailed'))
    }
  }

  const fmt = (n: number) => `R$ ${n.toFixed(2)}`

  const TAB_LABELS: Record<ReportTab, string> = {
    'sales': t('reports.sales'),
    'top-items': t('reports.topItems'),
    'per-waiter': t('reports.perWaiter'),
    'shift': t('reports.shift'),
  }

  return (
    <div className="screen-reports">
      <h2>{t('reports.title')}</h2>

      <div className="report-controls">
        <label>{t('common.from')} <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>{t('common.to')} <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>{t('common.refresh')}</button>
        <button className="btn" onClick={handleExport} disabled={loading}>{t('reports.exportCsv')}</button>
      </div>

      <div className="report-tabs">
        {(Object.keys(TAB_LABELS) as ReportTab[]).map(t_ => (
          <button
            key={t_}
            className={`report-tab ${tab === t_ ? 'active' : ''}`}
            onClick={() => setTab(t_)}
          >
            {TAB_LABELS[t_]}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="report-loading">{t('common.loading')}</p>}

      {!loading && tab === 'sales' && sales && (
        <div className="report-section">
          <div className="report-summary">
            <div className="stat-card">
              <span className="stat-label">{t('reports.revenue')}</span>
              <span className="stat-value">{fmt(sales.total_revenue)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">{t('reports.ordersLabel')}</span>
              <span className="stat-value">{sales.total_orders}</span>
            </div>
          </div>
          <table className="report-table">
            <thead>
              <tr><th>{t('reports.date')}</th><th>{t('reports.revenue')}</th><th>{t('reports.ordersLabel')}</th></tr>
            </thead>
            <tbody>
              {sales.by_day.map(r => (
                <tr key={r.date}><td>{r.date}</td><td>{fmt(r.revenue)}</td><td>{r.orders}</td></tr>
              ))}
              {sales.by_day.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: '#999' }}>{t('reports.noData')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'top-items' && topItems && (
        <div className="report-section">
          <h3>{t('reports.topItems')}</h3>
          <table className="report-table">
            <thead>
              <tr><th>{t('common.name')}</th><th>{t('reports.qtySold')}</th><th>{t('reports.revenue')}</th></tr>
            </thead>
            <tbody>
              {topItems.top_items.map(r => (
                <tr key={r.menu_item_id}><td>{r.name}</td><td>{r.quantity_sold}</td><td>{fmt(r.revenue)}</td></tr>
              ))}
              {topItems.top_items.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: '#999' }}>{t('reports.noData')}</td></tr>
              )}
            </tbody>
          </table>
          <h3>{t('reports.topCategories')}</h3>
          <table className="report-table">
            <thead>
              <tr><th>{t('reports.category')}</th><th>{t('reports.revenue')}</th></tr>
            </thead>
            <tbody>
              {topItems.top_categories.map(r => (
                <tr key={r.category_id}><td>{r.name}</td><td>{fmt(r.revenue)}</td></tr>
              ))}
              {topItems.top_categories.length === 0 && (
                <tr><td colSpan={2} style={{ textAlign: 'center', color: '#999' }}>{t('reports.noData')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'per-waiter' && perWaiter && (
        <div className="report-section">
          <table className="report-table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('reports.ordersOpened')}</th>
                <th>{t('reports.itemsAdded')}</th>
                <th>{t('reports.revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {perWaiter.waiters.map((r, i) => (
                <tr key={r.user_id ?? i}>
                  <td>{r.name}</td><td>{r.orders_opened}</td><td>{r.items_added}</td><td>{fmt(r.revenue)}</td>
                </tr>
              ))}
              {perWaiter.waiters.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999' }}>{t('reports.noData')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'shift' && shift && (
        <div className="report-section">
          <div className="report-summary">
            <div className="stat-card"><span className="stat-label">{t('reports.opened')}</span><span className="stat-value">{shift.orders_opened}</span></div>
            <div className="stat-card"><span className="stat-label">{t('reports.closed')}</span><span className="stat-value">{shift.orders_closed}</span></div>
            <div className="stat-card"><span className="stat-label">{t('reports.stillOpen')}</span><span className="stat-value">{shift.orders_still_open}</span></div>
            <div className="stat-card"><span className="stat-label">{t('reports.revenue')}</span><span className="stat-value">{fmt(shift.total_revenue)}</span></div>
            <div className="stat-card"><span className="stat-label">{t('cashier.paymentMethods.cash')}</span><span className="stat-value">{fmt(shift.by_payment_method.cash)}</span></div>
            <div className="stat-card"><span className="stat-label">{t('cashier.paymentMethods.card')}</span><span className="stat-value">{fmt(shift.by_payment_method.card)}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
