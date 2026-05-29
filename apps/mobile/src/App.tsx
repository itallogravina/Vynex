import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, StyleSheet } from 'react-native'
import { ErrorBoundary } from './components/ErrorBoundary'
import OrderScreen from './screens/OrderScreen'

export default function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <OrderScreen />
        <StatusBar style="auto" />
      </SafeAreaView>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
})
