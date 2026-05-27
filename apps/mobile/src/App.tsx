import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'
import { VYNEX_VERSION } from '@vynex/shared'

export default function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text>Vynex Mobile</Text>
      <Text style={styles.version}>v{VYNEX_VERSION}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  version: {
    marginTop: 16,
    fontSize: 12,
    color: '#999',
  },
})
