import type { SupportedLocale } from './types'

export function formatDate(date: Date, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount)
}

export function formatNumber(n: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(n)
}
