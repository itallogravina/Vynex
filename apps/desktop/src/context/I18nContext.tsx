import { useEffect, type ReactNode } from 'react'
import { i18n, I18nextProvider } from '@vynex/i18n'
import { useServerUrl } from './ServerUrlContext'

export function I18nProvider({ children }: { children: ReactNode }) {
  const { serverUrl } = useServerUrl()

  useEffect(() => {
    fetch(`${serverUrl}/settings`)
      .then(res => res.json() as Promise<{ locale?: string }>)
      .then(data => {
        if (data.locale && data.locale !== i18n.language) {
          void i18n.changeLanguage(data.locale)
        }
      })
      .catch(() => {/* offline — keep default pt-BR */})
  }, [serverUrl])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
