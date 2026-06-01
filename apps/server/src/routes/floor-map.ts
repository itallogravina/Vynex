import { FastifyInstance } from 'fastify'
import { listTablesForFloorMap, updateTablePosition, listIdleTables, getVenueSettings, updateVenueIdleAlert } from '../db/queries'
import { UpdateTablePositionRequest } from '@vynex/shared'
import { requireRole } from '../middleware/auth'

export async function registerFloorMapRoutes(app: FastifyInstance): Promise<void> {
  // Floor map: all tables with position and occupancy status
  app.get('/tables/floor-map', async () => {
    return listTablesForFloorMap()
  })

  // Update table position (drag-and-drop editor)
  app.patch<{ Params: { id: string }; Body: UpdateTablePositionRequest }>(
    '/tables/:id/position',
    { preHandler: requireRole('manager', 'owner') },
    async (request, reply) => {
      const { id } = request.params
      const { pos_x, pos_y, floor } = request.body

      if (pos_x == null || pos_y == null) {
        return reply.status(400).send({ error: 'pos_x and pos_y are required' })
      }

      const table = await updateTablePosition(id, pos_x, pos_y, floor ?? 0)
      return reply.send(table)
    }
  )

  // Idle tables: tables open longer than venue threshold with no recent items
  app.get('/tables/idle', async (request, reply) => {
    const settings = await getVenueSettings()
    if (!settings.idle_alert_minutes) {
      return reply.send([])
    }
    return listIdleTables(settings.idle_alert_minutes)
  })

  // Update idle alert threshold
  app.patch<{ Body: { idle_alert_minutes: number | null } }>(
    '/venue/idle-alert',
    { preHandler: requireRole('manager', 'owner') },
    async (request, reply) => {
      const { idle_alert_minutes } = request.body
      await updateVenueIdleAlert(idle_alert_minutes ?? null)
      return reply.send({ ok: true })
    }
  )
}
