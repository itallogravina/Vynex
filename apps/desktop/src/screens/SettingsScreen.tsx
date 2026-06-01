import { useState } from 'react'
import { useServerUrl } from '../context/ServerUrlContext'
import { useConnectionStatus } from '../hooks/useConnectionStatus'
import { useTranslation, type SupportedLocale } from '../context/I18nContext'
import { getSoundEnabled, setSoundEnabled } from '../hooks/useSoundAlert'
import '../styles/SettingsScreen.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function SettingsScreen() {
  const { serverUrl, setServerUrl } = useServerUrl()
  const { status, serverInfo } = useConnectionStatus()
  const { locale, setLocale, t } = useTranslation()
  const [draft, setDraft] = useState(serverUrl)
  const [saved, setSaved] = useState(false)
  const [soundEnabled, setSoundEnabledState] = useState(getSoundEnabled())
  const [idleMinutes, setIdleMinutes] = useState<string>('')
  const [idleSaved, setIdleSaved] = useState(false)

  function handleSave() {
    if (!draft.trim()) return
    setServerUrl(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
  }

  function toggleSound() {
    const next = !soundEnabled
    setSoundEnabled(next)
    setSoundEnabledState(next)
  }

  async function saveIdleAlert() {
    const minutes = parseInt(idleMinutes)
    try {
      await fetch(`${API_URL}/venue/idle-alert`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idle_alert_minutes: idleMinutes === '' ? null : minutes }),
      })
      setIdleSaved(true)
      setTimeout(() => setIdleSaved(false), 2000)
    } catch {}
  }

  return (
    <div className="settings-screen">
      <h1 className="settings-title">{t('settings.title')}</h1>

      <section className="settings-section">
        <h2 className="settings-section-title">{t('settings.serverUrl')}</h2>

        <div className="settings-field">
          <label className="settings-label" htmlFor="server-url">
            {t('settings.serverUrl')}
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
              {saved ? t('common.saved') : t('common.save')}
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
                <span className="status-label status-label--connected">{t('queue.connected')}</span>
                <span className="status-meta">
                  Vynex v{serverInfo.version} &middot;{' '}
                  {serverInfo.db === 'replica' ? 'cloud sync' : 'local only'}
                </span>
              </>
            )}
            {status === 'disconnected' && (
              <>
                <span className="status-label status-label--disconnected">{t('queue.offline')}</span>
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

      <section className="settings-section">
        <h2 className="settings-section-title">{t('settings.language')}</h2>
        <div className="settings-language-picker">
          {(['pt-BR', 'en-US'] as SupportedLocale[]).map(l => (
            <button
              key={l}
              className={`lang-btn ${locale === l ? 'active' : ''}`}
              onClick={() => setLocale(l)}
            >
              {t(`settings.${l}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">{t('settings.soundAlerts')}</h2>
        <div className="settings-toggle-row">
          <span className="settings-toggle-label">{t('settings.soundAlertsDesc')}</span>
          <button
            className={`settings-toggle ${soundEnabled ? 'on' : 'off'}`}
            onClick={toggleSound}
          >
            {soundEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">{t('settings.idleAlert')}</h2>
        <div className="settings-field">
          <label className="settings-label">{t('tables.idleAlertMinutes')}</label>
          <div className="settings-url-row">
            <input
              className="settings-input"
              type="number"
              min={1}
              placeholder="Ex: 30 (deixe vazio para desativar)"
              value={idleMinutes}
              onChange={e => setIdleMinutes(e.target.value)}
            />
            <button
              className={`settings-save-btn ${idleSaved ? 'saved' : ''}`}
              onClick={saveIdleAlert}
            >
              {idleSaved ? t('common.saved') : t('common.save')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
