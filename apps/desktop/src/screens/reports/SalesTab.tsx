import { useState, useCallback } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { SalesReport } from '@vynex/shared'
import { useTranslation } from '../../context/I18nContext'
import { useServerUrl } from '../../context/ServerUrlContext'
import { useAuthedFetch } from '../../context/AuthContext'

function defaultRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - 29)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export default function SalesTab() {
  const { t } = useTranslation()
  const { serverUrl } = useServerUrl()
  const apiFetch = useAuthedFetch()
  const range = defaultRange()
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')
  const [data, setData] = useState<SalesReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(
        `${serverUrl}/reports/sales?from=${from}&to=${to}&groupBy=${groupBy}`
      )
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [apiFetch, serverUrl, from, to, groupBy, t])

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div>
      <div className="date-controls" style={{ marginBottom: '1.25rem' }}>
        <label>{t('reports.from')}</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <label>{t('reports.to')}</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        <label>{t('reports.groupBy')}</label>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value as 'day' | 'week' | 'month')}>
          <option value="day">{t('reports.day')}</option>
          <option value="week">{t('reports.week')}</option>
          <option value="month">{t('reports.month')}</option>
        </select>
        <button className="fetch-btn" onClick={fetch_} disabled={loading}>
          {loading ? t('common.loading') : t('common.search')}
        </button>
      </div>

      {error && <div className="reports-empty">{error}</div>}

      {data && (
        <>
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-label">{t('reports.revenue')}</div>
              <div className="kpi-value">{fmt(data.total_revenue)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">{t('reports.orders')}</div>
              <div className="kpi-value">{data.total_orders}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Ticket médio</div>
              <div className="kpi-value">
                {data.total_orders > 0
                  ? fmt(data.total_revenue / data.total_orders)
                  : fmt(0)}
              </div>
            </div>
          </div>

          {data.by_day.length === 0 ? (
            <div className="reports-empty">{t('reports.noData')}</div>
          ) : (
            <div className="chart-box">
              <div className="chart-title">{t('reports.revenue')} + {t('reports.orders')}</div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data.by_day} margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                  <YAxis
                    yAxisId="rev"
                    tickFormatter={v => `R$${v}`}
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="ord"
                    orientation="right"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v, name) =>
                      name === 'revenue' ? [fmt(Number(v)), t('reports.revenue')] : [Number(v), t('reports.orders')]
                    }
                    contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }}
                    labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend formatter={v => v === 'revenue' ? t('reports.revenue') : t('reports.orders')} wrapperStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                  <Bar yAxisId="rev" dataKey="revenue" fill="#3498db" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="ord" type="monotone" dataKey="orders" stroke="#e67e22" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <div className="reports-empty">{t('reports.noData')}</div>
      )}
    </div>
  )
}
