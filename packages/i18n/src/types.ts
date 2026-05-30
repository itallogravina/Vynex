import type ptBR from './locales/pt-BR.json'

export type SupportedLocale = 'pt-BR' | 'en-US'

// Derives dot-notation key paths from the PT-BR JSON (source of truth).
// T4 expands pt-BR.json — this type grows automatically.
type Paths<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: Paths<
        T[K],
        `${Prefix}${Prefix extends '' ? '' : '.'}${K}`
      >
    }[keyof T & string]
  : Prefix

export type TranslationKey = Paths<typeof ptBR>
