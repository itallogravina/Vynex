import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, StyleSheet } from 'react-native'
import { ErrorBoundary } from './components/ErrorBoundary'
import { I18nProvider } from './context/I18nContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginScreen from './screens/LoginScreen'
import OrderScreen from './screens/OrderScreen'

function AppGate(): React.JSX.Element {
  const { user } = useAuth()
  return user ? <OrderScreen /> : <LoginScreen />
}

export default function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <AuthProvider>
          <SafeAreaView style={styles.container}>
            <AppGate />
            <StatusBar style="auto" />
          </SafeAreaView>
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
})
