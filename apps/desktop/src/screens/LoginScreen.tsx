import { useState, useEffect, useCallback } from 'react'
import { User } from '@vynex/shared'
import { useAuth } from '../context/AuthContext'
import { useServerUrl } from '../context/ServerUrlContext'
import '../styles/Login.css'

type Method = 'pin' | 'password' | 'list'

export default function LoginScreen() {
  const { login } = useAuth()
  const { serverUrl } = useServerUrl()
  const [method, setMethod] = useState<Method>('pin')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // PIN state
  const [pin, setPin] = useState('')

  // Password state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // List state
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
      } catch (e: any) {
        setError(e.message ?? 'Login failed')
      } finally {
        setLoading(false)
      }
    },
    [login, serverUrl]
  )

  // PIN handlers
  const appendDigit = (d: string) => {
    if (pin.length < 6) setPin(p => p + d)
  }
  const backspace = () => setPin(p => p.slice(0, -1))
  const submitPin = () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    doLogin({ login_method: 'pin', pin })
  }

  const handlePinKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') appendDigit(e.key)
      else if (e.key === 'Backspace') backspace()
      else if (e.key === 'Enter') submitPin()
    },
    [pin]
  )

  return (
    <div className="login-root">
      <div className="login-card">
        <h1 className="login-title">Vynex</h1>

        <div className="login-tabs">
          {(['pin', 'password', 'list'] as Method[]).map(m => (
            <button
              key={m}
              className={`login-tab ${method === m ? 'active' : ''}`}
              onClick={() => { setMethod(m); setError(null); setPin('') }}
            >
              {m === 'pin' ? 'PIN' : m === 'password' ? 'Password' : 'Select User'}
            </button>
          ))}
        </div>

        {error && <div className="login-error">{error}</div>}

        {method === 'pin' && (
          <div className="login-pin" onKeyDown={handlePinKeyPress} tabIndex={0}>
            <div className="pin-dots">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
              ))}
            </div>
            <div className="pin-grid">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
                <button
                  key={i}
                  className={`pin-key ${k === '' ? 'invisible' : ''}`}
                  disabled={k === '' || loading}
                  onClick={() => k === '⌫' ? backspace() : appendDigit(k)}
                >
                  {k}
                </button>
              ))}
            </div>
            <button className="login-btn" disabled={pin.length < 4 || loading} onClick={submitPin}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        )}

        {method === 'password' && (
          <form
            className="login-form"
            onSubmit={e => { e.preventDefault(); doLogin({ login_method: 'password', username, password }) }}
          >
            <label className="login-label">
              Username
              <input
                className="login-input"
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
              />
            </label>
            <label className="login-label">
              Password
              <input
                className="login-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
            </label>
            <button className="login-btn" type="submit" disabled={!username || !password || loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {method === 'list' && (
          <div className="login-list">
            {listLoading && <p className="login-list-hint">Loading…</p>}
            {!listLoading && listUsers.length === 0 && (
              <p className="login-list-hint">No users configured for list login.</p>
            )}
            {listUsers.map(u => (
              <button
                key={u.id}
                className="login-list-item"
                disabled={loading}
                onClick={() => doLogin({ login_method: 'list', user_id: u.id })}
              >
                <span className="login-list-name">{u.name}</span>
                <span className="login-list-role">{u.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
