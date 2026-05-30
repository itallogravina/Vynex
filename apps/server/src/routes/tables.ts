import { FastifyInstance } from 'fastify'
import {
  listTablesWithStatus,
  createTable,
  updateTable,
  deleteTable,
  getDefaultVenueId,
} from '../db/queries'
import { apiError } from '../lib/errors'
import { CreateTableRequest, UpdateTableRequest } from '@vynex/shared'

export async function registerTableRoutes(app: FastifyInstance): Promise<void> {
  app.get('/tables/status', async () => {
    return listTablesWithStatus()
  })

  app.post<{ Body: CreateTableRequest }>('/tables', async (request, reply) => {
    const { name, seats } = request.body

    if (!name?.trim()) {
      return apiError(reply, 400, 'GENERAL_VALIDATION', 'name is required')
    }
    if (!seats || seats < 1) {
      return apiError(reply, 400, 'GENERAL_VALIDATION', 'seats must be a positive number')
    }

    const venueId = await getDefaultVenueId()
    if (!venueId) {
      return apiError(reply, 500, 'GENERAL_UNKNOWN', 'No venue configured')
    }

    const table = await createTable(venueId, name.trim(), seats)
    return reply.status(201).send(table)
  })

  app.patch<{ Params: { id: string }; Body: UpdateTableRequest }>(
    '/tables/:id',
    async (request, reply) => {
      const { id } = request.params
      const { name, seats } = request.body

      if (!name?.trim()) {
        return apiError(reply, 400, 'GENERAL_VALIDATION', 'name is required')
      }
      if (!seats || seats < 1) {
        return apiError(reply, 400, 'GENERAL_VALIDATION', 'seats must be a positive number')
      }

      const table = await updateTable(id, name.trim(), seats)
      return reply.send(table)
    }
  )

  app.delete<{ Params: { id: string } }>('/tables/:id', async (request, reply) => {
    const { id } = request.params
    const result = await deleteTable(id)

    if (!result.ok) {
      return apiError(reply, 409, 'TABLE_HAS_OPEN_ORDER', result.error ?? 'Table has an open order')
    }

    return reply.status(204).send()
  })
}
