import { FastifyInstance } from 'fastify'
import { requireSession } from '../middleware/session'
import { requireRole } from '../middleware/roles'
import { getVenueSetting, setVenueSetting } from '../db/queries'
import { apiError } from '../lib/errors'

const SUPPORTED_LOCALES = ['pt-BR', 'en-US']

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/settings', async () => {
    const locale = (await getVenueSetting('locale')) ?? 'pt-BR'
    return { locale }
  })

  app.patch<{ Body: { locale?: string } }>(
    '/settings/locale',
    { preHandler: [requireSession, requireRole('owner', 'manager')] },
    async (request, reply) => {
      const { locale } = request.body
      if (!locale || !SUPPORTED_LOCALES.includes(locale)) {
        return apiError(reply, 400, 'SETTINGS_LOCALE_INVALID', 'Invalid locale. Use pt-BR or en-US.')
      }
      await setVenueSetting('locale', locale)
      return { locale }
    }
  )
}
