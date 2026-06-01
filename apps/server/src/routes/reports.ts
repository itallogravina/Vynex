import { FastifyInstance } from 'fastify'
import {
  getSalesReport,
  getTopItemsReport,
  getPerWaiterReport,
  getShiftSummaryReport,
  getPeakHourReport,
  getCancellationRateReport,
  getPeriodComparison,
  getNeverOrderedReport,
} from '../db/queries'
import { requireRole } from '../middleware/auth'

const GUARD = { preHandler: requireRole('manager', 'owner') }

export async function registerReportsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { from: string; to: string; groupBy?: string } }>(
    '/reports/sales',
    GUARD,
    async (request) => {
      const { from, to, groupBy = 'day' } = request.query
      return getSalesReport(from, to, groupBy as 'day' | 'week' | 'month')
    }
  )

  app.get<{ Querystring: { from: string; to: string; limit?: string } }>(
    '/reports/top-items',
    GUARD,
    async (request) => {
      const { from, to, limit = '10' } = request.query
      return getTopItemsReport(from, to, Number(limit))
    }
  )

  app.get<{ Querystring: { from: string; to: string } }>(
    '/reports/per-waiter',
    GUARD,
    async (request) => {
      const { from, to } = request.query
      return getPerWaiterReport(from, to)
    }
  )

  app.get<{ Querystring: { from: string; to: string } }>(
    '/reports/shift-summary',
    GUARD,
    async (request) => {
      const { from, to } = request.query
      return getShiftSummaryReport(from, to)
    }
  )

  app.get<{ Querystring: { from: string; to: string } }>(
    '/reports/peak-hour',
    GUARD,
    async (request) => {
      const { from, to } = request.query
      return getPeakHourReport(from, to)
    }
  )

  app.get<{ Querystring: { from: string; to: string } }>(
    '/reports/cancellation-rate',
    GUARD,
    async (request) => {
      const { from, to } = request.query
      return getCancellationRateReport(from, to)
    }
  )

  app.get<{ Querystring: { period?: string } }>(
    '/reports/comparison',
    GUARD,
    async (request) => {
      const { period = 'week' } = request.query
      return getPeriodComparison(period as 'week' | 'month')
    }
  )

  app.get<{ Querystring: { from: string; to: string } }>(
    '/reports/never-ordered',
    GUARD,
    async (request) => {
      const { from, to } = request.query
      return getNeverOrderedReport(from, to)
    }
  )
}
