import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { AuthResponse } from '@vynex/shared'
import { useAuth } from '../context/AuthContext'

const API_URL = 'http://localhost:3000'
type Tab = 'pin' | 'list'

export default function LoginScreen(): React.JSX.Element {
  const { login } = useAuth()
  const [tab, setTab] = useState<Tab>('pin')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listUsers, setListUsers] = useState<{ id: string; name: string }[]>([])
  const [listLoading, setListLoading] = useState(false)

  useEffect(() => {
    if (tab !== 'list') return
    setListLoading(true)
    fetch(`${API_URL}/users/list-login`)
      .then(r => r.json())
      .then(data => setListUsers(data))
      .catch(() => setListUsers([]))
      .finally(() => setListLoading(false))
  }, [tab])

  async function submitLogin(body: Record<string, string>) {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) setError('Multiple users match this PIN.')
        else if (res.status === 401) setError('Invalid credentials.')
        else setError(data?.error ?? 'Login failed.')
        return
      }
      const auth = data as AuthResponse
      login(auth.token, auth.user)
    } catch {
      setError('Server unreachable.')
    } finally {
      setLoading(false)
    }
  }

  function handlePinDigit(d: string) {
    if (pin.length >= 8) return
    const next = pin + d
    setPin(next)
    if (next.length >= 4) {
      submitLogin({ login_method: 'pin', pin: next }).then(() => setPin(''))
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Vynex</Text>

      {/* Tab selector */}
      <View style={styles.tabs}>
        {(['pin', 'list'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => { setTab(t); setError(null); setPin('') }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'pin' ? 'PIN' : 'List'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* PIN panel */}
      {tab === 'pin' && (
        <View style={styles.pinPanel}>
          <View style={styles.pinDisplay}>
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled]} />
            ))}
          </View>

          <View style={styles.pinGrid}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.pinKey, d === '' && styles.pinKeyInvisible]}
                disabled={d === '' || loading}
                onPress={() => d === '⌫' ? setPin(p => p.slice(0, -1)) : handlePinDigit(d)}
              >
                <Text style={styles.pinKeyText}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
        </View>
      )}

      {/* List panel */}
      {tab === 'list' && (
        <View style={styles.listPanel}>
          {listLoading ? (
            <ActivityIndicator />
          ) : listUsers.length === 0 ? (
            <Text style={styles.emptyText}>No users available.</Text>
          ) : (
            <FlatList
              data={listUsers}
              keyExtractor={u => u.id}
              renderItem={({ item: u }) => (
                <TouchableOpacity
                  style={styles.listUser}
                  disabled={loading}
                  onPress={() => submitLogin({ login_method: 'list', user_id: u.id })}
                >
                  <Text style={styles.listUserText}>{u.name}</Text>
                </TouchableOpacity>
              )}
            />
          )}
          {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#f5f5f5', alignItems: 'center', paddingTop: 60,
  },
  title: {
    fontSize: 36, fontWeight: 'bold', color: '#1e293b', marginBottom: 32,
  },
  tabs: {
    flexDirection: 'row', marginBottom: 24, borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: '#cbd5e1',
  },
  tab: {
    paddingVertical: 10, paddingHorizontal: 32, backgroundColor: '#fff',
  },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 15, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  error: {
    color: '#dc2626', marginBottom: 12, fontSize: 14, textAlign: 'center',
  },
  pinPanel: { alignItems: 'center', width: '100%' },
  pinDisplay: {
    flexDirection: 'row', gap: 16, marginBottom: 32,
  },
  pinDot: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#94a3b8', backgroundColor: 'transparent',
  },
  pinDotFilled: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  pinGrid: {
    flexDirection: 'row', flexWrap: 'wrap', width: 300, gap: 12,
  },
  pinKey: {
    width: 88, height: 80, borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  pinKeyInvisible: { backgroundColor: 'transparent', borderColor: 'transparent', elevation: 0 },
  pinKeyText: { fontSize: 28, fontWeight: '600', color: '#1e293b' },
  listPanel: { width: '90%', maxWidth: 400 },
  listUser: {
    backgroundColor: '#fff', padding: 18, borderRadius: 10, marginBottom: 10,
    borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center',
  },
  listUserText: { fontSize: 18, fontWeight: '600', color: '#1e293b' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 32 },
})
