import { FastifyInstance } from 'fastify'
import { getCashierClosingSummary, createCashierClosing } from '../db/queries'
import { requireRole } from '../middleware/auth'

export async function registerCashierClosingRoutes(app: FastifyInstance): Promise<void> {
  // Today's closing summary
  app.get(
    '/cashier/closing-summary',
    { preHandler: requireRole('cashier', 'manager', 'owner') },
    async () => {
      return getCashierClosingSummary()
    }
  )

  // Perform daily close
  app.post<{ Body: { force?: boolean } }>(
    '/cashier/close',
    { preHandler: requireRole('cashier', 'manager', 'owner') },
    async (request, reply) => {
      const { force } = request.body ?? {}
      const summary = await getCashierClosingSummary()

      if (summary.orders_open > 0 && !force) {
        return reply.status(409).send({
          error: 'OPEN_ORDERS_EXIST',
          orders_open: summary.orders_open,
          message: 'There are open orders. Use force: true to close anyway.',
        })
      }

      const session = (request as any).session
      const closedBy = session?.userId ?? 'unknown'

      await createCashierClosing(closedBy, summary)
      return reply.send({ ok: true, summary })
    }
  )
}
