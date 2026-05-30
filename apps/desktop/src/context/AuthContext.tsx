import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Role } from '@vynex/shared'
import { useServerUrl } from './ServerUrlContext'

const STORAGE_KEY = 'vynex_auth'

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { serverUrl } = useServerUrl()

  const [auth, setAuth] = useState<AuthState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? (JSON.parse(stored) as AuthState) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (!auth?.token) return
    const token = auth.token
    fetch(`${serverUrl}/health`, { headers: { 'X-Session-Token': token } })
      .then(res => {
        if (res.status === 401) {
          localStorage.removeItem(STORAGE_KEY)
          setAuth(null)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function login(token: string, user: AuthUser) {
    const state = { token, user }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    setAuth(state)
  }

  function logout() {
    const token = auth?.token
    if (token) {
      fetch(`${serverUrl}/logout`, {
        method: 'DELETE',
        headers: { 'X-Session-Token': token },
      }).catch(() => {})
    }
    localStorage.removeItem(STORAGE_KEY)
    setAuth(null)
  }

  return (
    <AuthContext.Provider value={{ user: auth?.user ?? null, token: auth?.token ?? null, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
