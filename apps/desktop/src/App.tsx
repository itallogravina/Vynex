import { useState } from 'react'
import { VYNEX_VERSION } from '@vynex/shared'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ServerUrlProvider } from './context/ServerUrlContext'
import { useConnectionStatus } from './hooks/useConnectionStatus'
import { OrderScreen } from './screens/OrderScreen'
import KitchenScreen from './screens/KitchenScreen'
import BarScreen from './screens/BarScreen'
import CashierScreen from './screens/CashierScreen'
import TableManagementScreen from './screens/TableManagementScreen'
import MenuManagementScreen from './screens/MenuManagementScreen'
import SettingsScreen from './screens/SettingsScreen'
import './App.css'

type ScreenType = 'order' | 'kitchen' | 'bar' | 'cashier' | 'tables' | 'menu' | 'settings'

const NAV: { id: ScreenType; label: string }[] = [
  { id: 'order',    label: 'Order' },
  { id: 'kitchen',  label: 'Kitchen' },
  { id: 'bar',      label: 'Bar' },
  { id: 'cashier',  label: 'Cashier' },
  { id: 'tables',   label: 'Tables' },
  { id: 'menu',     label: 'Menu' },
  { id: 'settings', label: 'Settings' },
]

function AppShell() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('order')
  const { status } = useConnectionStatus()

  const renderScreen = () => {
    switch (currentScreen) {
      case 'order':    return <OrderScreen />
      case 'kitchen':  return <KitchenScreen />
      case 'bar':      return <BarScreen />
      case 'cashier':  return <CashierScreen />
      case 'tables':   return <TableManagementScreen />
      case 'menu':     return <MenuManagementScreen />
      case 'settings': return <SettingsScreen />
    }
  }

  return (
    <div className="app">
      <div className="screen-selector">
        {NAV.map(({ id, label }) => (
          <button
            key={id}
            className={`screen-btn ${currentScreen === id ? 'active' : ''}`}
            onClick={() => setCurrentScreen(id)}
          >
            {label}
          </button>
        ))}
        <div className="sidebar-footer">
          <span className={`conn-dot conn-dot--${status}`} title={status} />
          <span className="conn-label">
            {status === 'connected' ? 'Online' : status === 'disconnected' ? 'Offline' : '…'}
          </span>
        </div>
      </div>
      <div className="screen-content">
        {renderScreen()}
        <footer className="app-footer">Vynex v{VYNEX_VERSION}</footer>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ServerUrlProvider>
        <AppShell />
      </ServerUrlProvider>
    </ErrorBoundary>
  )
}
