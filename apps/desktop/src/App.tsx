import { useState } from 'react'
import { VYNEX_VERSION } from '@vynex/shared'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ServerUrlProvider } from './context/ServerUrlContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useConnectionStatus } from './hooks/useConnectionStatus'
import LoginScreen from './screens/LoginScreen'
import { OrderScreen } from './screens/OrderScreen'
import KitchenScreen from './screens/KitchenScreen'
import BarScreen from './screens/BarScreen'
import CashierScreen from './screens/CashierScreen'
import TableManagementScreen from './screens/TableManagementScreen'
import MenuManagementScreen from './screens/MenuManagementScreen'
import UserManagementScreen from './screens/UserManagementScreen'
import SettingsScreen from './screens/SettingsScreen'
import './App.css'

type ScreenType = 'order' | 'kitchen' | 'bar' | 'cashier' | 'tables' | 'menu' | 'users' | 'settings'

const ALL_NAV: { id: ScreenType; label: string; roles: string[] }[] = [
  { id: 'order',    label: 'Order',    roles: ['owner', 'manager', 'waiter'] },
  { id: 'kitchen',  label: 'Kitchen',  roles: ['owner', 'manager', 'kitchen'] },
  { id: 'bar',      label: 'Bar',      roles: ['owner', 'manager', 'bartender'] },
  { id: 'cashier',  label: 'Cashier',  roles: ['owner', 'manager', 'cashier'] },
  { id: 'tables',   label: 'Tables',   roles: ['owner', 'manager', 'waiter'] },
  { id: 'menu',     label: 'Menu',     roles: ['owner', 'manager'] },
  { id: 'users',    label: 'Users',    roles: ['owner', 'manager'] },
  { id: 'settings', label: 'Settings', roles: ['owner', 'manager'] },
]

function AppShell() {
  const { user, logout } = useAuth()
  const role = user?.role ?? ''
  const visibleNav = ALL_NAV.filter(n => n.roles.includes(role))

  const [currentScreen, setCurrentScreen] = useState<ScreenType>(() => {
    return visibleNav[0]?.id ?? 'order'
  })

  const { status } = useConnectionStatus()

  const renderScreen = () => {
    switch (currentScreen) {
      case 'order':    return <OrderScreen />
      case 'kitchen':  return <KitchenScreen />
      case 'bar':      return <BarScreen />
      case 'cashier':  return <CashierScreen />
      case 'tables':   return <TableManagementScreen />
      case 'menu':     return <MenuManagementScreen />
      case 'users':    return <UserManagementScreen />
      case 'settings': return <SettingsScreen />
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
            {status === 'connected' ? 'Online' : status === 'disconnected' ? 'Offline' : '…'}
          </span>
          {user && (
            <button className="logout-btn" onClick={logout} title={`Signed in as ${user.name} (${user.role})`}>
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
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ServerUrlProvider>
    </ErrorBoundary>
  )
}
