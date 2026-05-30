import { useState } from 'react'
import { VYNEX_VERSION } from '@vynex/shared'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ServerUrlProvider } from './context/ServerUrlContext'
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

const ALL_NAV: { id: ScreenType; label: string; roles: string[] }[] = [
  { id: 'order',    label: 'Order',    roles: ['owner','manager','cashier','waiter','bartender','kitchen'] },
  { id: 'kitchen',  label: 'Kitchen',  roles: ['owner','manager','kitchen'] },
  { id: 'bar',      label: 'Bar',      roles: ['owner','manager','bartender'] },
  { id: 'cashier',  label: 'Cashier',  roles: ['owner','manager','cashier'] },
  { id: 'tables',   label: 'Tables',   roles: ['owner','manager','waiter'] },
  { id: 'menu',     label: 'Menu',     roles: ['owner','manager'] },
  { id: 'users',    label: 'Users',    roles: ['owner','manager'] },
  { id: 'reports',  label: 'Reports',  roles: ['owner','manager','cashier'] },
  { id: 'settings', label: 'Settings', roles: ['owner','manager'] },
]

function AppShell() {
  const { user, logout } = useAuth()
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('order')
  const { status } = useConnectionStatus()

  const nav = ALL_NAV.filter(n => user && n.roles.includes(user.role))

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

  return (
    <div className="app">
      <div className="screen-selector">
        {nav.map(({ id, label }) => (
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
          {user && (
            <div className="sidebar-user">
              <span className="sidebar-username">{user.name}</span>
              <button className="logout-btn" onClick={logout}>Logout</button>
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
        <AuthProvider>
          <AppGate />
        </AuthProvider>
      </ServerUrlProvider>
    </ErrorBoundary>
  )
}
