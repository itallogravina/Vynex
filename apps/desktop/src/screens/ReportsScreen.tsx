import { useState, useEffect, useCallback } from 'react'
import { SalesReport, TopItemsReport, PerWaiterReport, ShiftSummaryReport } from '@vynex/shared'
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
      setError(err instanceof Error ? err.message : 'Failed to load report')
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
      setError('Export failed')
    }
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`

  return (
    <div className="screen-reports">
      <h2>Reports</h2>

      <div className="report-controls">
        <label>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>Refresh</button>
        <button className="btn" onClick={handleExport} disabled={loading}>Export CSV</button>
      </div>

      <div className="report-tabs">
        {(['sales', 'top-items', 'per-waiter', 'shift'] as ReportTab[]).map(t => (
          <button
            key={t}
            className={`report-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'sales' ? 'Sales' : t === 'top-items' ? 'Top Items' : t === 'per-waiter' ? 'Per Waiter' : 'Shift'}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="report-loading">Loading…</p>}

      {!loading && tab === 'sales' && sales && (
        <div className="report-section">
          <div className="report-summary">
            <div className="stat-card"><span className="stat-label">Revenue</span><span className="stat-value">{fmt(sales.total_revenue)}</span></div>
            <div className="stat-card"><span className="stat-label">Orders</span><span className="stat-value">{sales.total_orders}</span></div>
          </div>
          <table className="report-table">
            <thead><tr><th>Date</th><th>Revenue</th><th>Orders</th></tr></thead>
            <tbody>
              {sales.by_day.map(r => (
                <tr key={r.date}><td>{r.date}</td><td>{fmt(r.revenue)}</td><td>{r.orders}</td></tr>
              ))}
              {sales.by_day.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: '#999' }}>No data</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'top-items' && topItems && (
        <div className="report-section">
          <h3>Top Items</h3>
          <table className="report-table">
            <thead><tr><th>Name</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
            <tbody>
              {topItems.top_items.map(r => (
                <tr key={r.menu_item_id}><td>{r.name}</td><td>{r.quantity_sold}</td><td>{fmt(r.revenue)}</td></tr>
              ))}
              {topItems.top_items.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: '#999' }}>No data</td></tr>}
            </tbody>
          </table>
          <h3>Top Categories</h3>
          <table className="report-table">
            <thead><tr><th>Category</th><th>Revenue</th></tr></thead>
            <tbody>
              {topItems.top_categories.map(r => (
                <tr key={r.category_id}><td>{r.name}</td><td>{fmt(r.revenue)}</td></tr>
              ))}
              {topItems.top_categories.length === 0 && <tr><td colSpan={2} style={{ textAlign: 'center', color: '#999' }}>No data</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'per-waiter' && perWaiter && (
        <div className="report-section">
          <table className="report-table">
            <thead><tr><th>Name</th><th>Orders Opened</th><th>Items Added</th><th>Revenue</th></tr></thead>
            <tbody>
              {perWaiter.waiters.map((r, i) => (
                <tr key={r.user_id ?? i}><td>{r.name}</td><td>{r.orders_opened}</td><td>{r.items_added}</td><td>{fmt(r.revenue)}</td></tr>
              ))}
              {perWaiter.waiters.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999' }}>No data</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'shift' && shift && (
        <div className="report-section">
          <div className="report-summary">
            <div className="stat-card"><span className="stat-label">Opened</span><span className="stat-value">{shift.orders_opened}</span></div>
            <div className="stat-card"><span className="stat-label">Closed</span><span className="stat-value">{shift.orders_closed}</span></div>
            <div className="stat-card"><span className="stat-label">Still Open</span><span className="stat-value">{shift.orders_still_open}</span></div>
            <div className="stat-card"><span className="stat-label">Revenue</span><span className="stat-value">{fmt(shift.total_revenue)}</span></div>
            <div className="stat-card"><span className="stat-label">Cash</span><span className="stat-value">{fmt(shift.by_payment_method.cash)}</span></div>
            <div className="stat-card"><span className="stat-label">Card</span><span className="stat-value">{fmt(shift.by_payment_method.card)}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
