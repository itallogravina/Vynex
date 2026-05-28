import { useState } from 'react'
import { useServerUrl } from '../context/ServerUrlContext'
import { useConnectionStatus } from '../hooks/useConnectionStatus'
import '../styles/SettingsScreen.css'

export default function SettingsScreen() {
  const { serverUrl, setServerUrl } = useServerUrl()
  const { status, serverInfo } = useConnectionStatus()
  const [draft, setDraft] = useState(serverUrl)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    if (!draft.trim()) return
    setServerUrl(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
  }

  return (
    <div className="settings-screen">
      <h1 className="settings-title">Settings</h1>

      <section className="settings-section">
        <h2 className="settings-section-title">Server</h2>

        <div className="settings-field">
          <label className="settings-label" htmlFor="server-url">
            Server URL
          </label>
          <div className="settings-url-row">
            <input
              id="server-url"
              className="settings-input"
              type="url"
              value={draft}
              onChange={e => { setDraft(e.target.value); setSaved(false) }}
              onKeyDown={handleKeyDown}
              placeholder="http://localhost:3000"
              spellCheck={false}
            />
            <button
              className={`settings-save-btn ${saved ? 'saved' : ''}`}
              onClick={handleSave}
              disabled={!draft.trim() || draft.trim() === serverUrl}
            >
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
          <p className="settings-hint">
            WebSocket: {serverUrl.replace(/^http/, 'ws')}/ws
          </p>
        </div>

        <div className="settings-status-card">
          <div className={`status-dot status-dot--${status}`} />
          <div className="status-info">
            {status === 'connected' && serverInfo && (
              <>
                <span className="status-label status-label--connected">Connected</span>
                <span className="status-meta">
                  Vynex v{serverInfo.version} &middot;{' '}
                  {serverInfo.db === 'replica' ? 'cloud sync' : 'local only'}
                </span>
              </>
            )}
            {status === 'disconnected' && (
              <>
                <span className="status-label status-label--disconnected">Unreachable</span>
                <span className="status-meta">Check that the server is running</span>
              </>
            )}
            {status === 'checking' && (
              <>
                <span className="status-label status-label--checking">Checking&hellip;</span>
                <span className="status-meta">{serverUrl}</span>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
