import { useState } from 'react'
import { VYNEX_VERSION } from '@vynex/shared'
import { useTranslation } from '@vynex/i18n'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ServerUrlProvider } from './context/ServerUrlContext'
import { I18nProvider } from './context/I18nContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useConnectionStatus } from './hooks/useConnectionStatus'
import { LoginScreen } from './screens/LoginScreen'
import { OrderScreen } from './screens/OrderScreen'
import KitchenScreen from './screens/KitchenScreen'
import BarScreen from './screens/BarScreen'
import CashierScreen from './screens/CashierScreen'
import TableManagementScreen from './screens/TableManagementScreen'
import MenuManagementScreen from './screens/MenuManagementScreen'
import SettingsScreen from './screens/SettingsScreen'
import UsersScreen from './screens/UsersScreen'
import ReportsScreen from './screens/ReportsScreen'
import './App.css'

type ScreenType =
  | 'order' | 'kitchen' | 'bar' | 'cashier'
  | 'tables' | 'menu' | 'users' | 'reports' | 'settings'

const NAV_ITEMS: { id: ScreenType; key: string; roles: string[] }[] = [
  { id: 'order',    key: 'nav.order',    roles: ['owner','manager','cashier','waiter','bartender','kitchen'] },
  { id: 'kitchen',  key: 'nav.kitchen',  roles: ['owner','manager','kitchen'] },
  { id: 'bar',      key: 'nav.bar',      roles: ['owner','manager','bartender'] },
  { id: 'cashier',  key: 'nav.cashier',  roles: ['owner','manager','cashier'] },
  { id: 'tables',   key: 'nav.tables',   roles: ['owner','manager','waiter'] },
  { id: 'menu',     key: 'nav.menu',     roles: ['owner','manager'] },
  { id: 'users',    key: 'nav.users',    roles: ['owner','manager'] },
  { id: 'reports',  key: 'nav.reports',  roles: ['owner','manager','cashier'] },
  { id: 'settings', key: 'nav.settings', roles: ['owner','manager'] },
]

function AppShell() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('order')
  const { status } = useConnectionStatus()

  const nav = NAV_ITEMS.filter(n => user && n.roles.includes(user.role))

  const renderScreen = () => {
    switch (currentScreen) {
      case 'order':    return <OrderScreen />
      case 'kitchen':  return <KitchenScreen />
      case 'bar':      return <BarScreen />
      case 'cashier':  return <CashierScreen />
      case 'tables':   return <TableManagementScreen />
      case 'menu':     return <MenuManagementScreen />
      case 'users':    return <UsersScreen />
      case 'reports':  return <ReportsScreen />
      case 'settings': return <SettingsScreen />
    }
  }

  const connLabel =
    status === 'connected'    ? t('settings.connectionStatus.connected') :
    status === 'disconnected' ? t('settings.connectionStatus.disconnected') :
    '…'

  return (
    <div className="app">
      <div className="screen-selector">
        {nav.map(({ id, key }) => (
          <button
            key={id}
            className={`screen-btn ${currentScreen === id ? 'active' : ''}`}
            onClick={() => setCurrentScreen(id)}
          >
            {t(key as Parameters<typeof t>[0])}
          </button>
        ))}
        <div className="sidebar-footer">
          <span className={`conn-dot conn-dot--${status}`} title={status} />
          <span className="conn-label">{connLabel}</span>
          {user && (
            <div className="sidebar-user">
              <span className="sidebar-username">{user.name}</span>
              <button className="logout-btn" onClick={logout}>{t('auth.logout')}</button>
            </div>
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

function AppGate() {
  const { user } = useAuth()
  return user ? <AppShell /> : <LoginScreen />
}

export default function App() {
  return (
    <ErrorBoundary>
      <ServerUrlProvider>
        <I18nProvider>
          <AuthProvider>
            <AppGate />
          </AuthProvider>
        </I18nProvider>
      </ServerUrlProvider>
    </ErrorBoundary>
  )
}
