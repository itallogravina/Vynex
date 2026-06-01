import { useState, useCallback } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import type { TopItemsReport } from '@vynex/shared'
import { useTranslation } from '../../context/I18nContext'
import { useServerUrl } from '../../context/ServerUrlContext'
import { useAuthedFetch } from '../../context/AuthContext'

function defaultRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - 29)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export default function TopItemsTab() {
  const { t } = useTranslation()
  const { serverUrl } = useServerUrl()
  const apiFetch = useAuthedFetch()
  const range = defaultRange()
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [data, setData] = useState<TopItemsReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`${serverUrl}/reports/top-items?from=${from}&to=${to}`)
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [apiFetch, serverUrl, from, to, t])

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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
        <>
          {data.top_items.length === 0 ? (
            <div className="reports-empty">{t('reports.noData')}</div>
          ) : (
            <>
              <div className="chart-box">
                <div className="chart-title">{t('reports.topItems')} — {t('reports.revenue')}</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={data.top_items.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `R$${v}`} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => [fmt(Number(v)), t('reports.revenue')]}
                      contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }}
                      labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="revenue" fill="#9b59b6" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="table-box">
                <div className="table-box-title">{t('reports.topItems')}</div>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('common.name')}</th>
                      <th className="num">Qtd</th>
                      <th className="num">{t('reports.revenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_items.map((item, i) => (
                      <tr key={item.menu_item_id}>
                        <td>{i + 1}</td>
                        <td>{item.name}</td>
                        <td className="num">{item.quantity_sold}</td>
                        <td className="num">{fmt(item.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="table-box">
                <div className="table-box-title">{t('reports.category')}</div>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('common.name')}</th>
                      <th className="num">{t('reports.revenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_categories.map((cat, i) => (
                      <tr key={cat.category_id}>
                        <td>{i + 1}</td>
                        <td>{cat.name}</td>
                        <td className="num">{fmt(cat.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <div className="reports-empty">{t('reports.noData')}</div>
      )}
    </div>
  )
}
