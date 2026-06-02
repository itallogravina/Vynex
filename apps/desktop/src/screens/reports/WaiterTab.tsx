import { useState, useCallback, useEffect } from 'react'
import type { PerWaiterReport } from '@vynex/shared'
import { useTranslation } from '../../context/I18nContext'
import { useServerUrl } from '../../context/ServerUrlContext'
import { useAuthedFetch } from '../../context/AuthContext'

function defaultRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - 29)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export default function WaiterTab() {
  const { t } = useTranslation()
  const { serverUrl } = useServerUrl()
  const apiFetch = useAuthedFetch()
  const range = defaultRange()
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [data, setData] = useState<PerWaiterReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`${serverUrl}/reports/per-waiter?from=${from}&to=${to}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json()
      console.log('[WaiterTab] data:', json)
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
        data.waiters.length === 0 ? (
          <div className="reports-empty">{t('reports.noData')}</div>
        ) : (
          <div className="table-box">
            <div className="table-box-title">{t('reports.waiters')}</div>
            <table className="report-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('reports.waiterName')}</th>
                  <th className="num">{t('reports.ordersOpened')}</th>
                  <th className="num">{t('reports.itemsAdded')}</th>
                  <th className="num">{t('reports.revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {data.waiters.map((w, i) => (
                  <tr key={w.user_id ?? i}>
                    <td>{i + 1}</td>
                    <td>{w.name}</td>
                    <td className="num">{w.orders_opened}</td>
                    <td className="num">{w.items_added}</td>
                    <td className="num">{fmt(w.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {!data && !loading && !error && (
        <div className="reports-empty">{t('reports.noData')}</div>
      )}
    </div>
  )
}
