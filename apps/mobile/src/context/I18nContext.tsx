import React, { useEffect, type ReactNode } from 'react'
import { i18n, I18nextProvider } from '@vynex/i18n'

const API_URL = 'http://localhost:3000'

export function I18nProvider({ children }: { children: ReactNode }): React.JSX.Element {
  useEffect(() => {
    fetch(`${API_URL}/settings`)
      .then(res => res.json() as Promise<{ locale?: string }>)
      .then(data => {
        if (data.locale && data.locale !== i18n.language) {
          void i18n.changeLanguage(data.locale)
        }
      })
      .catch(() => {/* offline — keep default pt-BR */})
  }, [])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
