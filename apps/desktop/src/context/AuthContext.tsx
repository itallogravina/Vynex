import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Role, LoginRequest, AuthResponse } from '@vynex/shared'

type AuthUser = { id: string; name: string; role: Role }

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  login: (serverUrl: string, req: LoginRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const login = useCallback(async (serverUrl: string, req: LoginRequest) => {
    const res = await fetch(`${serverUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }))
      throw new Error(err.error ?? 'Login failed')
    }
    const data: AuthResponse = await res.json()
    setToken(data.token)
    setUser(data.user as AuthUser)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function useAuthedFetch() {
  const { token } = useAuth()
  return useCallback(
    (url: string, options: RequestInit = {}) => {
      return fetch(url, {
        ...options,
        headers: {
          ...(options.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
      })
    },
    [token]
  )
}
