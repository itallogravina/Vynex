import { useState, useCallback } from 'react'
import type { PeriodComparison } from '@vynex/shared'
import { useTranslation } from '../../context/I18nContext'
import { useServerUrl } from '../../context/ServerUrlContext'
import { useAuthedFetch } from '../../context/AuthContext'

export default function ComparisonTab() {
  const { t } = useTranslation()
  const { serverUrl } = useServerUrl()
  const apiFetch = useAuthedFetch()
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [data, setData] = useState<PeriodComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async (p: 'week' | 'month') => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`${serverUrl}/reports/comparison?period=${p}`)
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [apiFetch, serverUrl, t])

  const switchPeriod = (p: 'week' | 'month') => {
    setPeriod(p)
    fetch_(p)
  }

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const delta = (pct: number | null) => {
    if (pct === null) return <span className="kpi-delta neutral">—</span>
    const cls = pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral'
    return <span className={`kpi-delta ${cls}`}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="period-toggle">
          <button className={period === 'week' ? 'active' : ''} onClick={() => switchPeriod('week')}>
            {t('reports.week')}
          </button>
          <button className={period === 'month' ? 'active' : ''} onClick={() => switchPeriod('month')}>
            {t('reports.month')}
          </button>
        </div>
        <button className="fetch-btn" onClick={() => fetch_(period)} disabled={loading}>
          {loading ? t('common.loading') : t('common.search')}
        </button>
      </div>

      {error && <div className="reports-empty">{error}</div>}

      {data && (
        <>
          <div className="comparison-grid">
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }}>
                {t('reports.currentPeriod')}
                <span style={{ marginLeft: 8, fontWeight: 400, fontSize: '0.7rem' }}>
                  {data.current.from} → {data.current.to}
                </span>
              </div>
              <div className="kpi-row">
                <div className="kpi-card">
                  <div className="kpi-label">{t('reports.revenue')}</div>
                  <div className="kpi-value">{fmt(data.current.revenue)}</div>
                  {delta(data.revenue_delta_pct)}
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">{t('reports.orders')}</div>
                  <div className="kpi-value">{data.current.orders}</div>
                  {delta(data.orders_delta_pct)}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }}>
                {t('reports.previousPeriod')}
                <span style={{ marginLeft: 8, fontWeight: 400, fontSize: '0.7rem' }}>
                  {data.previous.from} → {data.previous.to}
                </span>
              </div>
              <div className="kpi-row">
                <div className="kpi-card" style={{ opacity: 0.7 }}>
                  <div className="kpi-label">{t('reports.revenue')}</div>
                  <div className="kpi-value">{fmt(data.previous.revenue)}</div>
                </div>
                <div className="kpi-card" style={{ opacity: 0.7 }}>
                  <div className="kpi-label">{t('reports.orders')}</div>
                  <div className="kpi-value">{data.previous.orders}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: '0.5rem' }}>
            {period === 'week' ? t('reports.vsLastWeek') : t('reports.vsLastMonth')}
          </div>
        </>
      )}

      {!data && !loading && !error && (
        <div className="reports-empty">{t('reports.noData')}</div>
      )}
    </div>
  )
}
