import { FastifyInstance } from 'fastify'
import {
  listTablesWithStatus,
  createTable,
  updateTable,
  deleteTable,
  forceDeleteTable,
  getDefaultVenueId,
} from '../db/queries'
import { CreateTableRequest, UpdateTableRequest } from '@vynex/shared'
import { requireRole } from '../middleware/auth'

export async function registerTableRoutes(app: FastifyInstance): Promise<void> {
  // List all tables with their occupancy status
  app.get('/tables/status', async (request, reply) => {
    return listTablesWithStatus()
  })

  // Create a table
  app.post<{ Body: CreateTableRequest }>('/tables', async (request, reply) => {
    const { name, seats } = request.body

    if (!name?.trim()) {
      return reply.status(400).send({ error: 'name is required' })
    }
    if (!seats || seats < 1) {
      return reply.status(400).send({ error: 'seats must be a positive number' })
    }

    const venueId = await getDefaultVenueId()
    if (!venueId) {
      return reply.status(500).send({ error: 'No venue configured' })
    }

    const table = await createTable(venueId, name.trim(), seats)
    return reply.status(201).send(table)
  })

  // Update a table
  app.patch<{ Params: { id: string }; Body: UpdateTableRequest }>(
    '/tables/:id',
    async (request, reply) => {
      const { id } = request.params
      const { name, seats } = request.body

      if (!name?.trim()) {
        return reply.status(400).send({ error: 'name is required' })
      }
      if (!seats || seats < 1) {
        return reply.status(400).send({ error: 'seats must be a positive number' })
      }

      const table = await updateTable(id, name.trim(), seats)
      return reply.send(table)
    }
  )

  // Delete a table — 409 with structured error if open orders exist
  app.delete<{ Params: { id: string } }>('/tables/:id', async (request, reply) => {
    const { id } = request.params
    const result = await deleteTable(id)

    if (!result.ok) {
      return reply.status(409).send({
        error: 'TABLE_HAS_OPEN_ORDERS',
        open_orders: result.open_orders,
      })
    }

    return reply.status(204).send()
  })

  // Force-delete a table — cancels all open orders, then deletes; manager/owner only
  app.delete<{ Params: { id: string } }>(
    '/tables/:id/force',
    { preHandler: requireRole('owner', 'manager') },
    async (request, reply) => {
      const { id } = request.params
      await forceDeleteTable(id)
      return reply.status(204).send()
    }
  )
}
