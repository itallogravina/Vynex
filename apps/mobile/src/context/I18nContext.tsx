import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import * as FileSystem from 'expo-file-system/legacy'
import { translations, resolveKey } from '@vynex/i18n'
import type { SupportedLocale } from '@vynex/i18n'

export type { SupportedLocale }

const LOCALE_FILE = FileSystem.documentDirectory + 'vynex_locale.json'

type I18nCtx = {
  locale: SupportedLocale
  setLocale: (l: SupportedLocale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nCtx>({
  locale: 'pt-BR',
  setLocale: () => {},
  t: (k) => k,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('pt-BR')

  useEffect(() => {
    FileSystem.getInfoAsync(LOCALE_FILE)
      .then(info => {
        if (!info.exists) return
        return FileSystem.readAsStringAsync(LOCALE_FILE).then(raw => {
          const saved = JSON.parse(raw)
          if (saved === 'pt-BR' || saved === 'en-US') setLocaleState(saved)
        })
      })
      .catch(() => {})
  }, [])

  const setLocale = useCallback((l: SupportedLocale) => {
    setLocaleState(l)
    FileSystem.writeAsStringAsync(LOCALE_FILE, JSON.stringify(l)).catch(() => {})
  }, [])

  const t = useCallback((key: string) => resolveKey(translations[locale], key), [locale])

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  return useContext(I18nContext)
}
