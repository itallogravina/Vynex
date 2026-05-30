import { useState, useEffect } from 'react'
import { useTranslation } from '@vynex/i18n'
import { useServerUrl } from '../context/ServerUrlContext'
import { useAuth } from '../context/AuthContext'
import { AuthResponse } from '@vynex/shared'

type Tab = 'pin' | 'password' | 'list'

export function LoginScreen() {
  const { t } = useTranslation()
  const { serverUrl } = useServerUrl()
  const { login } = useAuth()
  const [tab, setTab] = useState<Tab>('pin')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [pin, setPin] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [listUsers, setListUsers] = useState<{ id: string; name: string }[]>([])
  const [listLoading, setListLoading] = useState(false)

  useEffect(() => {
    if (tab !== 'list') return
    setListLoading(true)
    fetch(`${serverUrl}/users/list-login`)
      .then(r => r.json())
      .then(data => setListUsers(data))
      .catch(() => setListUsers([]))
      .finally(() => setListLoading(false))
  }, [tab, serverUrl])

  async function submitLogin(body: Record<string, string>) {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${serverUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) setError(t('auth.errors.AUTH_PIN_CONFLICT'))
        else if (res.status === 401) setError(t('auth.errors.AUTH_INVALID_CREDENTIALS'))
        else setError(data?.error ?? t('auth.loginFailed'))
        return
      }
      const auth = data as AuthResponse
      login(auth.token, auth.user)
    } catch {
      setError(t('auth.serverUnreachable'))
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

  function handlePinBackspace() { setPin(p => p.slice(0, -1)) }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">Vynex</h1>

        <div className="login-tabs">
          {(['pin', 'password', 'list'] as Tab[]).map(tab_ => (
            <button
              key={tab_}
              className={`login-tab ${tab === tab_ ? 'active' : ''}`}
              onClick={() => { setTab(tab_); setError(null); setPin('') }}
            >
              {tab_ === 'pin' ? t('auth.pin') : tab_ === 'password' ? t('auth.password') : t('auth.selectUser')}
            </button>
          ))}
        </div>

        {error && <div className="login-error">{error}</div>}

        {tab === 'pin' && (
          <div className="pin-panel">
            <div className="pin-display">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
              ))}
            </div>
            <div className="pin-grid">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
                <button
                  key={i}
                  className={`pin-key ${d === '' ? 'invisible' : ''}`}
                  disabled={d === '' || loading}
                  onClick={() => d === '⌫' ? handlePinBackspace() : handlePinDigit(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'password' && (
          <div className="password-panel">
            <input
              className="login-input"
              placeholder={t('auth.username')}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
            />
            <input
              className="login-input"
              type="password"
              placeholder={t('auth.password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && submitLogin({ login_method: 'password', username, password })}
            />
            <button
              className="login-btn"
              disabled={loading || !username || !password}
              onClick={() => submitLogin({ login_method: 'password', username, password })}
            >
              {loading ? t('auth.loggingIn') : t('auth.login')}
            </button>
          </div>
        )}

        {tab === 'list' && (
          <div className="list-panel">
            {listLoading ? (
              <p className="list-empty">{t('common.loading')}</p>
            ) : listUsers.length === 0 ? (
              <p className="list-empty">{t('auth.noUsers')}</p>
            ) : (
              listUsers.map(u => (
                <button
                  key={u.id}
                  className="list-user-btn"
                  disabled={loading}
                  onClick={() => submitLogin({ login_method: 'list', user_id: u.id })}
                >
                  {u.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
