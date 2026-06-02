import { useState, useCallback, useEffect } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import type { PeakHourReport } from '@vynex/shared'
import { useTranslation } from '../../context/I18nContext'
import { useServerUrl } from '../../context/ServerUrlContext'
import { useAuthedFetch } from '../../context/AuthContext'

function defaultRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - 29)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export default function PeakHourTab() {
  const { t } = useTranslation()
  const { serverUrl } = useServerUrl()
  const apiFetch = useAuthedFetch()
  const range = defaultRange()
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [data, setData] = useState<PeakHourReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`${serverUrl}/reports/peak-hour?from=${from}&to=${to}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json()
      console.log('[PeakHourTab] data:', json)
      setData(json)
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [apiFetch, serverUrl, from, to, t])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetch_() }, [])

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const hasAnyData = data && data.hours.some(h => h.orders > 0)

  return (
    <div>
      <div className="date-controls" style={{ marginBottom: '1.25rem' }}>
        <label>{t('reports.from')}</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <label>{t('reports.to')}</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        <button className="fetch-btn" onClick={fetch_} disabled={loading}>
          {loading ? t('common.loading') : t('common.search')}
        </button>
      </div>

      {error && <div className="reports-empty">{error}</div>}

      {data && (
        !hasAnyData ? (
          <div className="reports-empty">{t('reports.noData')}</div>
        ) : (
          <div className="chart-box" style={{ background: '#fff', borderRadius: 8, padding: '1rem' }}>
            <div className="chart-title" style={{ color: '#111827' }}>{t('reports.peakHour')}</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.hours.map(h => ({ ...h, label: `${String(h.hour).padStart(2, '0')}h` }))}
                margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fill: '#374151', fontSize: 11 }} />
                <YAxis yAxisId="ord" tick={{ fill: '#374151', fontSize: 11 }} />
                <YAxis
                  yAxisId="rev"
                  orientation="right"
                  tickFormatter={v => `R$${v}`}
                  tick={{ fill: '#374151', fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v, name) =>
                    name === 'revenue' ? [fmt(Number(v)), t('reports.revenue')] : [Number(v), t('reports.orders')]
                  }
                  contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                  labelStyle={{ color: '#374151' }}
                  itemStyle={{ color: '#374151' }}
                />
                <Legend
                  formatter={v => v === 'revenue' ? t('reports.revenue') : t('reports.orders')}
                  wrapperStyle={{ color: '#374151', fontSize: 12 }}
                />
                <Bar yAxisId="ord" dataKey="orders" fill="#e67e22" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="rev" dataKey="revenue" fill="#3498db" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      )}

      {!data && !loading && !error && (
        <div className="reports-empty">{t('reports.noData')}</div>
      )}
    </div>
  )
}
