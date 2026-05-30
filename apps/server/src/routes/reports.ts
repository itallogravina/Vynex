import { FastifyInstance } from 'fastify'
import { requireSession } from '../middleware/session'
import { requireRole } from '../middleware/roles'
import { apiError } from '../lib/errors'
import {
  getSalesReport,
  getTopItemsReport,
  getPerWaiterReport,
  getShiftSummaryReport,
} from '../db/queries'

const reportGuard = [requireSession, requireRole('cashier', 'manager', 'owner')]

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { from: string; to: string; group_by?: string } }>(
    '/reports/sales',
    { preHandler: reportGuard },
    async (request, reply) => {
      const { from, to, group_by = 'day' } = request.query
      if (!from || !to) return apiError(reply, 400, 'GENERAL_VALIDATION', 'from and to are required')
      const groupBy = (['day', 'week', 'month'] as const).includes(group_by as 'day' | 'week' | 'month')
        ? (group_by as 'day' | 'week' | 'month')
        : 'day'
      return getSalesReport(from, to, groupBy)
    }
  )

  app.get<{ Querystring: { from: string; to: string; limit?: string } }>(
    '/reports/top-items',
    { preHandler: reportGuard },
    async (request, reply) => {
      const { from, to, limit = '10' } = request.query
      if (!from || !to) return apiError(reply, 400, 'GENERAL_VALIDATION', 'from and to are required')
      return getTopItemsReport(from, to, Number(limit))
    }
  )

  app.get<{ Querystring: { from: string; to: string } }>(
    '/reports/per-waiter',
    { preHandler: reportGuard },
    async (request, reply) => {
      const { from, to } = request.query
      if (!from || !to) return apiError(reply, 400, 'GENERAL_VALIDATION', 'from and to are required')
      return getPerWaiterReport(from, to)
    }
  )

  app.get<{ Querystring: { from: string; to: string } }>(
    '/reports/shift',
    { preHandler: reportGuard },
    async (request, reply) => {
      const { from, to } = request.query
      if (!from || !to) return apiError(reply, 400, 'GENERAL_VALIDATION', 'from and to are required')
      return getShiftSummaryReport(from, to)
    }
  )

  app.get<{ Querystring: { type: string; from: string; to: string } }>(
    '/reports/export',
    { preHandler: reportGuard },
    async (request, reply) => {
      const { type, from, to } = request.query
      if (!type || !from || !to) return apiError(reply, 400, 'GENERAL_VALIDATION', 'type, from and to are required')

      let csv = ''
      const filename = `vynex-report-${type}-${from}-${to}.csv`

      if (type === 'sales') {
        const data = await getSalesReport(from, to, 'day')
        csv = 'date,revenue,orders\n'
        csv += data.by_day.map(r => `${r.date},${r.revenue},${r.orders}`).join('\n')
      } else if (type === 'top-items') {
        const data = await getTopItemsReport(from, to)
        csv = 'menu_item_id,name,quantity_sold,revenue\n'
        csv += data.top_items.map(r => `${r.menu_item_id},"${r.name}",${r.quantity_sold},${r.revenue}`).join('\n')
      } else if (type === 'per-waiter') {
        const data = await getPerWaiterReport(from, to)
        csv = 'user_id,name,orders_opened,items_added,revenue\n'
        csv += data.waiters
          .map(r => `${r.user_id ?? ''},"${r.name}",${r.orders_opened},${r.items_added},${r.revenue}`)
          .join('\n')
      } else if (type === 'shift') {
        const data = await getShiftSummaryReport(from, to)
        csv = 'metric,value\n'
        csv += `orders_opened,${data.orders_opened}\n`
        csv += `orders_closed,${data.orders_closed}\n`
        csv += `orders_still_open,${data.orders_still_open}\n`
        csv += `total_revenue,${data.total_revenue}\n`
        csv += `cash,${data.by_payment_method.cash}\n`
        csv += `card,${data.by_payment_method.card}`
      } else {
        return apiError(reply, 400, 'GENERAL_VALIDATION', 'Invalid report type')
      }

      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)
      return reply.send(csv)
    }
  )
}
