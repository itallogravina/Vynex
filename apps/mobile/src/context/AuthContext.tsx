import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Role } from '@vynex/shared'

const STORAGE_KEY = 'vynex_auth'
const API_URL = 'http://localhost:3000'

type AuthUser = { id: string; name: string; role: Role }
type AuthState = { token: string; user: AuthUser } | null

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  login: (token: string, user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [auth, setAuth] = useState<AuthState>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (!stored) return
        const parsed = JSON.parse(stored) as AuthState
        if (!parsed?.token) return
        // Validate token against server
        return fetch(`${API_URL}/health`, { headers: { 'X-Session-Token': parsed.token } })
          .then(res => {
            if (res.status === 401) {
              AsyncStorage.removeItem(STORAGE_KEY)
            } else {
              setAuth(parsed)
            }
          })
          .catch(() => { setAuth(parsed) }) // offline — keep cached auth
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [])

  function login(token: string, user: AuthUser) {
    const state = { token, user }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {})
    setAuth(state)
  }

  function logout() {
    const token = auth?.token
    if (token) {
      fetch(`${API_URL}/logout`, { method: 'DELETE', headers: { 'X-Session-Token': token } }).catch(() => {})
    }
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {})
    setAuth(null)
  }

  if (!ready) return <></> // splash while reading storage

  return (
    <AuthContext.Provider value={{ user: auth?.user ?? null, token: auth?.token ?? null, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
