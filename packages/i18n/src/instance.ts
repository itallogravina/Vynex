import i18next, { type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import ptBR from './locales/pt-BR.json'
import enUS from './locales/en-US.json'

const i18n: I18nInstance = i18next.createInstance()

void i18n.use(initReactI18next).init({
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  resources: {
    'pt-BR': { translation: ptBR },
    'en-US': { translation: enUS },
  },
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
})

export { i18n }
