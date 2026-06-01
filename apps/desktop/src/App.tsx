import { useState, useEffect } from 'react'
import { VYNEX_VERSION } from '@vynex/shared'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ServerUrlProvider } from './context/ServerUrlContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { I18nProvider, useTranslation } from './context/I18nContext'
import { useConnectionStatus } from './hooks/useConnectionStatus'
import { useOfflineQueue } from './hooks/useOfflineQueue'
import { useServerUrl } from './context/ServerUrlContext'
import LoginScreen from './screens/LoginScreen'
import { OrderScreen } from './screens/OrderScreen'
import KitchenScreen from './screens/KitchenScreen'
import BarScreen from './screens/BarScreen'
import CashierScreen from './screens/CashierScreen'
import TableManagementScreen from './screens/TableManagementScreen'
import MenuManagementScreen from './screens/MenuManagementScreen'
import UserManagementScreen from './screens/UserManagementScreen'
import SettingsScreen from './screens/SettingsScreen'
import FloorMapScreen from './screens/FloorMapScreen'
import ReportsScreen from './screens/ReportsScreen'
import './App.css'

type ScreenType = 'order' | 'kitchen' | 'bar' | 'cashier' | 'tables' | 'floor-map' | 'menu' | 'users' | 'reports' | 'settings'

function AppShell() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const { serverUrl } = useServerUrl()
  const role = user?.role ?? ''

  const ALL_NAV: { id: ScreenType; label: string; roles: string[] }[] = [
    { id: 'order',     label: t('nav.order'),    roles: ['owner', 'manager', 'waiter'] },
    { id: 'kitchen',   label: t('nav.kitchen'),  roles: ['owner', 'manager', 'kitchen'] },
    { id: 'bar',       label: t('nav.bar'),      roles: ['owner', 'manager', 'bartender'] },
    { id: 'cashier',   label: t('nav.cashier'),  roles: ['owner', 'manager', 'cashier'] },
    { id: 'tables',    label: t('nav.tables'),   roles: ['owner', 'manager', 'waiter'] },
    { id: 'floor-map', label: t('nav.floorMap'), roles: ['owner', 'manager', 'waiter'] },
    { id: 'menu',      label: t('nav.menu'),     roles: ['owner', 'manager'] },
    { id: 'users',     label: t('nav.users'),    roles: ['owner', 'manager'] },
    { id: 'reports',   label: t('nav.reports'),  roles: ['owner', 'manager'] },
    { id: 'settings',  label: t('nav.settings'), roles: ['owner', 'manager'] },
  ]

  const visibleNav = ALL_NAV.filter(n => n.roles.includes(role))
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(() => visibleNav[0]?.id ?? 'order')
  const { status } = useConnectionStatus()
  const { queueCount, flush } = useOfflineQueue(serverUrl, user?.id)

  useEffect(() => { if (status === 'connected') flush() }, [status, flush])

  const renderScreen = () => {
    switch (currentScreen) {
      case 'order':     return <OrderScreen />
      case 'kitchen':   return <KitchenScreen />
      case 'bar':       return <BarScreen />
      case 'cashier':   return <CashierScreen />
      case 'tables':    return <TableManagementScreen />
      case 'floor-map': return <FloorMapScreen />
      case 'menu':      return <MenuManagementScreen />
      case 'users':     return <UserManagementScreen />
      case 'reports':   return <ReportsScreen />
      case 'settings':  return <SettingsScreen />
    }
  }

  return (
    <div className="app">
      <div className="screen-selector">
        {visibleNav.map(({ id, label }) => (
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
            {status === 'connected' ? t('queue.connected') : status === 'disconnected' ? t('queue.offline') : '…'}
          </span>
          {queueCount > 0 && (
            <span className="queue-badge" title={`${queueCount} pedido(s) aguardando sincronização`}>
              {queueCount}
            </span>
          )}
          {user && (
            <button className="logout-btn" onClick={logout} title={`${user.name} (${user.role})`}>
              {user.name}
            </button>
          )}
        </div>
      </div>
      <div className="screen-content">
        {renderScreen()}
        <footer className="app-footer">Vynex v{VYNEX_VERSION}</footer>
      </div>
    </div>
  )
}

function AuthGate() {
  const { user } = useAuth()
  return user ? <AppShell /> : <LoginScreen />
}

export default function App() {
  return (
    <ErrorBoundary>
      <ServerUrlProvider>
        <I18nProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </I18nProvider>
      </ServerUrlProvider>
    </ErrorBoundary>
  )
}
