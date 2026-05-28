import { useState } from 'react'
import { VYNEX_VERSION } from '@vynex/shared'
import { OrderScreen } from './screens/OrderScreen'
import KitchenScreen from './screens/KitchenScreen'
import BarScreen from './screens/BarScreen'
import CashierScreen from './screens/CashierScreen'
import './App.css'

type ScreenType = 'order' | 'kitchen' | 'bar' | 'cashier'

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
    }
  }

  return (
    <div className="app">
      <div className="screen-selector">
        <button
          className={`screen-btn ${currentScreen === 'order' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('order')}
        >
          Order
        </button>
        <button
          className={`screen-btn ${currentScreen === 'kitchen' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('kitchen')}
        >
          Kitchen
        </button>
        <button
          className={`screen-btn ${currentScreen === 'bar' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('bar')}
        >
          Bar
        </button>
        <button
          className={`screen-btn ${currentScreen === 'cashier' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('cashier')}
        >
          Cashier
        </button>
      </div>
      <div className="screen-content">
        {renderScreen()}
        <footer className="app-footer">
          Vynex v{VYNEX_VERSION}
        </footer>
      </div>
    </div>
  )
}
