import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, StyleSheet } from 'react-native'
import OrderScreen from './screens/OrderScreen'

export default function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <OrderScreen />
      <StatusBar style="auto" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
})
