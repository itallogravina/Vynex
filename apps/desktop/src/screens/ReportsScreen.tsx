import { useState } from 'react'
import { useTranslation } from '../context/I18nContext'
import SalesTab from './reports/SalesTab'
import TopItemsTab from './reports/TopItemsTab'
import WaiterTab from './reports/WaiterTab'
import PeakHourTab from './reports/PeakHourTab'
import ComparisonTab from './reports/ComparisonTab'
import NeverOrderedTab from './reports/NeverOrderedTab'
import '../styles/ReportsScreen.css'

type ReportTab = 'sales' | 'top-items' | 'waiters' | 'peak-hour' | 'comparison' | 'never-ordered'

export default function ReportsScreen() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ReportTab>('sales')

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'sales',         label: t('reports.sales') },
    { id: 'top-items',     label: t('reports.topItems') },
    { id: 'waiters',       label: t('reports.waiters') },
    { id: 'peak-hour',     label: t('reports.peakHour') },
    { id: 'comparison',    label: t('reports.comparison') },
    { id: 'never-ordered', label: t('reports.neverOrdered') },
  ]

  return (
    <div className="reports-screen">
      <div className="reports-header">
        <div className="reports-tabs">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              className={`tab-btn ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="reports-body">
        {tab === 'sales'         && <SalesTab />}
        {tab === 'top-items'     && <TopItemsTab />}
        {tab === 'waiters'       && <WaiterTab />}
        {tab === 'peak-hour'     && <PeakHourTab />}
        {tab === 'comparison'    && <ComparisonTab />}
        {tab === 'never-ordered' && <NeverOrderedTab />}
      </div>
    </div>
  )
}
