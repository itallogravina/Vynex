import type { TranslationKey } from './types'

export const errorCodeMap: Record<string, TranslationKey> = {
  AUTH_INVALID_CREDENTIALS: 'auth.errors.AUTH_INVALID_CREDENTIALS',
  AUTH_PIN_CONFLICT:        'auth.errors.AUTH_PIN_CONFLICT',
  AUTH_INVALID_METHOD:      'auth.errors.AUTH_INVALID_METHOD',
  AUTH_UNAUTHORIZED:        'auth.errors.AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN:           'auth.errors.AUTH_FORBIDDEN',
  TABLE_NOT_FOUND:          'tables.errors.TABLE_NOT_FOUND',
  TABLE_NAME_TAKEN:         'tables.errors.TABLE_NAME_TAKEN',
  TABLE_HAS_OPEN_ORDER:     'tables.errors.TABLE_HAS_OPEN_ORDER',
  ORDER_NOT_FOUND:          'orders.errors.ORDER_NOT_FOUND',
  ORDER_ALREADY_CLOSED:     'orders.errors.ORDER_ALREADY_CLOSED',
  MENU_ITEM_NOT_FOUND:      'menu.errors.MENU_ITEM_NOT_FOUND',
  MENU_CATEGORY_NOT_FOUND:  'menu.errors.MENU_CATEGORY_NOT_FOUND',
  USER_NOT_FOUND:           'users.errors.USER_NOT_FOUND',
  USER_HAS_ORDERS:          'users.errors.USER_HAS_ORDERS',
  SETTINGS_LOCALE_INVALID:  'settings.errors.SETTINGS_LOCALE_INVALID',
  GENERAL_UNKNOWN:          'errors.GENERAL_UNKNOWN',
  GENERAL_VALIDATION:       'errors.GENERAL_VALIDATION',
}

export function translateErrorCode(
  t: (key: TranslationKey) => string,
  code: string | undefined,
): string {
  const key = (code !== undefined ? errorCodeMap[code] : undefined) ?? errorCodeMap['GENERAL_UNKNOWN']
  return t(key as TranslationKey)
}
