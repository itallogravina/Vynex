import { useState } from 'react'
import { VYNEX_VERSION } from '@vynex/shared'
import { OrderScreen } from './screens/OrderScreen'
import KitchenScreen from './screens/KitchenScreen'
import BarScreen from './screens/BarScreen'
import CashierScreen from './screens/CashierScreen'
import TableManagementScreen from './screens/TableManagementScreen'
import MenuManagementScreen from './screens/MenuManagementScreen'
import './App.css'

type ScreenType = 'order' | 'kitchen' | 'bar' | 'cashier' | 'tables' | 'menu'

const NAV: { id: ScreenType; label: string }[] = [
  { id: 'order', label: 'Order' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bar', label: 'Bar' },
  { id: 'cashier', label: 'Cashier' },
  { id: 'tables', label: 'Tables' },
  { id: 'menu', label: 'Menu' },
]

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('order')

  const renderScreen = () => {
    switch (currentScreen) {
      case 'order':
        return <OrderScreen />
      case 'kitchen':
        return <KitchenScreen />
      case 'bar':
        return <BarScreen />
      case 'cashier':
        return <CashierScreen />
      case 'tables':
        return <TableManagementScreen />
      case 'menu':
        return <MenuManagementScreen />
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
      </div>
      <div className="screen-content">
        {renderScreen()}
        <footer className="app-footer">Vynex v{VYNEX_VERSION}</footer>
      </div>
    </div>
  )
}
