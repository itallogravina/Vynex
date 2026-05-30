import { useState } from 'react'
import { useTranslation, i18n } from '@vynex/i18n'
import { useServerUrl } from '../context/ServerUrlContext'
import { useConnectionStatus } from '../hooks/useConnectionStatus'
import { useApi } from '../lib/api'
import '../styles/SettingsScreen.css'

type Locale = 'pt-BR' | 'en-US'

function currentLocale(): Locale {
  return i18n.language === 'en-US' ? 'en-US' : 'pt-BR'
}

export default function SettingsScreen() {
  const { t } = useTranslation()
  const { serverUrl, setServerUrl } = useServerUrl()
  const { status, serverInfo } = useConnectionStatus()
  const api = useApi()

  const [draft, setDraft] = useState(serverUrl)
  const [saved, setSaved] = useState(false)

  const [selectedLocale, setSelectedLocale] = useState<Locale>(currentLocale)
  const [langSaving, setLangSaving] = useState(false)
  const [langChanged, setLangChanged] = useState(false)
  const [langError, setLangError] = useState<string | null>(null)

  function handleSave() {
    if (!draft.trim()) return
    setServerUrl(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
  }

  async function handleSaveLocale() {
    setLangSaving(true)
    setLangError(null)
    try {
      await api.patch('/settings/locale', { locale: selectedLocale })
      void i18n.changeLanguage(selectedLocale)
      setLangChanged(true)
    } catch {
      setLangError(t('errors.GENERAL_UNKNOWN'))
    } finally {
      setLangSaving(false)
    }
  }

  return (
    <div className="settings-screen">
      <h1 className="settings-title">{t('settings.title')}</h1>

      <section className="settings-section">
        <h2 className="settings-section-title">{t('settings.serverConnection')}</h2>

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
                <span className="status-label status-label--connected">
                  {t('settings.connectionStatus.connected')}
                </span>
                <span className="status-meta">
                  Vynex v{serverInfo.version} &middot;{' '}
                  {serverInfo.db === 'replica' ? t('settings.cloudSync') : t('settings.localOnly')}
                </span>
              </>
            )}
            {status === 'disconnected' && (
              <>
                <span className="status-label status-label--disconnected">
                  {t('settings.connectionStatus.disconnected')}
                </span>
                <span className="status-meta">{t('settings.serverRunning')}</span>
              </>
            )}
            {status === 'checking' && (
              <>
                <span className="status-label status-label--checking">
                  {t('settings.connectionStatus.checking')}&hellip;
                </span>
                <span className="status-meta">{serverUrl}</span>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">{t('settings.language')}</h2>
        <div className="settings-field">
          <div className="settings-locale-options">
            {(['pt-BR', 'en-US'] as Locale[]).map(loc => (
              <button
                key={loc}
                className={`settings-locale-btn ${selectedLocale === loc ? 'active' : ''}`}
                onClick={() => { setSelectedLocale(loc); setLangChanged(false); setLangError(null) }}
                disabled={langSaving}
              >
                {t(`settings.languageOptions.${loc}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>

          {langError && <p className="settings-lang-error">{langError}</p>}

          {langChanged ? (
            <div className="settings-lang-notice">
              <span>{t('settings.languageChanged')}</span>
              <button
                className="settings-reload-btn"
                onClick={() => window.location.reload()}
              >
                {t('settings.reloadNow')}
              </button>
            </div>
          ) : (
            <button
              className="settings-save-btn"
              onClick={handleSaveLocale}
              disabled={langSaving || selectedLocale === currentLocale()}
            >
              {langSaving ? t('common.saving') : t('common.save')}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
