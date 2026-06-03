import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { User } from '@vynex/shared'
import { useAuth } from '../context/AuthContext'

type Method = 'pin' | 'password' | 'list'

type Props = {
  serverUrl: string
  onOpenSettings: () => void
}

export default function LoginScreen({ serverUrl, onOpenSettings }: Props) {
  const { login } = useAuth()
  const [method, setMethod] = useState<Method>('pin')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [pin, setPin] = useState('')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [listUsers, setListUsers] = useState<User[]>([])
  const [listLoading, setListLoading] = useState(false)

  const fetchListUsers = useCallback(() => {
    setListLoading(true)
    fetch(`${serverUrl}/auth/list-users`)
      .then(r => r.json())
      .then((data: User[]) => setListUsers(data))
      .catch(() => setListUsers([]))
      .finally(() => setListLoading(false))
  }, [serverUrl])

  useEffect(() => {
    if (method === 'list') fetchListUsers()
  }, [method, fetchListUsers])

  const doLogin = useCallback(
    async (req: Parameters<typeof login>[1]) => {
      setError(null)
      setLoading(true)
      try {
        await login(serverUrl, req)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Falha no login')
      } finally {
        setLoading(false)
      }
    },
    [login, serverUrl]
  )

  const appendDigit = (d: string) => {
    if (pin.length < 6) setPin(p => p + d)
  }
  const backspace = () => setPin(p => p.slice(0, -1))
  const submitPin = () => {
    if (pin.length < 4) { setError('PIN deve ter pelo menos 4 dígitos'); return }
    doLogin({ login_method: 'pin', pin })
  }

  const switchMethod = (m: Method) => {
    setMethod(m)
    setError(null)
    setPin('')
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Vynex</Text>
          <TouchableOpacity style={styles.settingsBtn} onPress={onOpenSettings}>
            <Text style={styles.settingsBtnText}>⚙</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.tabs}>
            {(['pin', 'password', 'list'] as Method[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.tab, method === m && styles.tabActive]}
                onPress={() => switchMethod(m)}
              >
                <Text style={[styles.tabText, method === m && styles.tabTextActive]}>
                  {m === 'pin' ? 'PIN' : m === 'password' ? 'Senha' : 'Lista'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {method === 'pin' && (
            <View style={styles.pinContainer}>
              <View style={styles.pinDots}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
                ))}
              </View>
              <View style={styles.pinGrid}>
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.pinKey, k === '' && styles.pinKeyInvisible]}
                    onPress={() => k === '⌫' ? backspace() : k !== '' && appendDigit(k)}
                    disabled={k === '' || loading}
                  >
                    <Text style={styles.pinKeyText}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.submitBtn, (pin.length < 4 || loading) && styles.btnDisabled]}
                onPress={submitPin}
                disabled={pin.length < 4 || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Entrar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {method === 'password' && (
            <View style={styles.formContainer}>
              <Text style={styles.label}>Usuário</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                placeholderTextColor="#aaa"
                placeholder="nome de usuário"
              />
              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
                placeholderTextColor="#aaa"
                placeholder="••••••"
              />
              <TouchableOpacity
                style={[styles.submitBtn, (!username || !password || loading) && styles.btnDisabled]}
                onPress={() => doLogin({ login_method: 'password', username, password })}
                disabled={!username || !password || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Entrar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {method === 'list' && (
            <View style={styles.listContainer}>
              {listLoading && <ActivityIndicator color="#3b82f6" style={styles.listSpinner} />}
              {!listLoading && listUsers.length === 0 && (
                <Text style={styles.listEmpty}>Nenhum usuário configurado para login por lista.</Text>
              )}
              <FlatList
                data={listUsers}
                keyExtractor={u => u.id}
                scrollEnabled={false}
                renderItem={({ item: u }) => (
                  <TouchableOpacity
                    style={[styles.listItem, loading && styles.btnDisabled]}
                    onPress={() => doLogin({ login_method: 'list', user_id: u.id })}
                    disabled={loading}
                  >
                    <Text style={styles.listItemName}>{u.name}</Text>
                    <Text style={styles.listItemRole}>{u.role}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  settingsBtn: {
    padding: 8,
    backgroundColor: '#374151',
    borderRadius: 8,
  },
  settingsBtnText: {
    color: '#d1d5db',
    fontSize: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  tabTextActive: {
    color: '#3b82f6',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
  },
  pinContainer: {
    alignItems: 'center',
  },
  pinDots: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#3b82f6',
  },
  pinGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 240,
    gap: 10,
    marginBottom: 20,
  },
  pinKey: {
    width: 70,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinKeyInvisible: {
    backgroundColor: 'transparent',
  },
  pinKeyText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  formContainer: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  submitBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  submitBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  listContainer: {
    minHeight: 80,
  },
  listSpinner: {
    marginVertical: 20,
  },
  listEmpty: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 20,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },
  listItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  listItemRole: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
})
