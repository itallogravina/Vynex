import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, StyleSheet, ActivityIndicator, View } from 'react-native'
import { ErrorBoundary } from './components/ErrorBoundary'
import OrderScreen from './screens/OrderScreen'
import ServerSetupScreen from './screens/ServerSetupScreen'
import LoginScreen from './screens/LoginScreen'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useServerUrl } from './hooks/useServerUrl'

export default function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  )
}

function AppContent(): React.JSX.Element {
  const [serverUrl, setServerUrl, urlLoading] = useServerUrl()
  const { user, loading: authLoading, logout } = useAuth()

  if (urlLoading || authLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <StatusBar style="auto" />
      </View>
    )
  }

  if (!serverUrl) {
    return (
      <>
        <ServerSetupScreen onSave={setServerUrl} />
        <StatusBar style="auto" />
      </>
    )
  }

  if (!user) {
    return (
      <>
        <LoginScreen serverUrl={serverUrl} onOpenSettings={() => setServerUrl('')} />
        <StatusBar style="auto" />
      </>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <OrderScreen
        serverUrl={serverUrl}
        onOpenSettings={() => setServerUrl('')}
        onLogout={logout}
      />
      <StatusBar style="auto" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
})
