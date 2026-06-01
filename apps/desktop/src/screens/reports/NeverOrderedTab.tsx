import { useState, useCallback } from 'react'
import type { NeverOrderedReport } from '@vynex/shared'
import { useTranslation } from '../../context/I18nContext'
import { useServerUrl } from '../../context/ServerUrlContext'
import { useAuthedFetch } from '../../context/AuthContext'

function defaultRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - 29)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export default function NeverOrderedTab() {
  const { t } = useTranslation()
  const { serverUrl } = useServerUrl()
  const apiFetch = useAuthedFetch()
  const range = defaultRange()
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [data, setData] = useState<NeverOrderedReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`${serverUrl}/reports/never-ordered?from=${from}&to=${to}`)
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
        data.items.length === 0 ? (
          <div className="reports-empty" style={{ color: '#2ecc71' }}>
            Todos os itens do cardápio foram pedidos no período
          </div>
        ) : (
          <div className="table-box">
            <div className="table-box-title">
              {t('reports.neverOrdered')} — {data.items.length} {data.items.length === 1 ? 'item' : 'itens'}
            </div>
            <table className="report-table">
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th>{t('reports.category')}</th>
                  <th className="num">{t('reports.price')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(item => (
                  <tr key={item.menu_item_id}>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td className="num">{fmt(item.price)}</td>
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
