import { FastifyInstance } from 'fastify'
import {
  listCategoriesWithItems,
  createCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  toggleMenuItem,
  deleteMenuItem,
  eightysixMenuItem,
  getDefaultVenueId,
  listAllMenuItems,
} from '../db/queries'
import { apiError } from '../lib/errors'
import { requireRole } from '../middleware/roles'
import { CreateCategoryRequest, CreateMenuItemRequest, UpdateMenuItemRequest, RoutingZone } from '@vynex/shared'

export async function registerMenuRoutes(app: FastifyInstance): Promise<void> {
  app.get('/categories', async () => {
    return listCategoriesWithItems()
  })

  app.get('/menu-items/all', async () => {
    return listAllMenuItems()
  })

  app.post<{ Body: CreateCategoryRequest }>('/categories', async (request, reply) => {
    const { name, routing_zone } = request.body

    if (!name?.trim()) {
      return apiError(reply, 400, 'GENERAL_VALIDATION', 'name is required')
    }
    const validZones = Object.values(RoutingZone)
    if (!validZones.includes(routing_zone)) {
      return apiError(reply, 400, 'GENERAL_VALIDATION', 'routing_zone must be kitchen, bar, cashier, or table')
    }

    const venueId = await getDefaultVenueId()
    if (!venueId) {
      return apiError(reply, 500, 'GENERAL_UNKNOWN', 'No venue configured')
    }

    const category = await createCategory(venueId, name.trim(), routing_zone)
    return reply.status(201).send(category)
  })

  app.delete<{ Params: { id: string } }>('/categories/:id', async (request, reply) => {
    const { id } = request.params
    await deleteCategory(id)
    return reply.status(204).send()
  })

  app.post<{ Body: CreateMenuItemRequest }>('/menu-items', async (request, reply) => {
    const { category_id, name, price, routing_zone } = request.body

    if (!name?.trim()) {
      return apiError(reply, 400, 'GENERAL_VALIDATION', 'name is required')
    }
    if (price == null || price < 0) {
      return apiError(reply, 400, 'GENERAL_VALIDATION', 'price must be a non-negative number')
    }
    const validZones = Object.values(RoutingZone)
    if (!validZones.includes(routing_zone)) {
      return apiError(reply, 400, 'GENERAL_VALIDATION', 'Invalid routing_zone')
    }

    const item = await createMenuItem(category_id ?? null, name.trim(), price, routing_zone)
    return reply.status(201).send(item)
  })

  app.patch<{ Params: { id: string }; Body: UpdateMenuItemRequest }>(
    '/menu-items/:id',
    async (request, reply) => {
      const { id } = request.params
      const { name, price, routing_zone } = request.body

      if (!name?.trim()) {
        return apiError(reply, 400, 'GENERAL_VALIDATION', 'name is required')
      }
      if (price == null || price < 0) {
        return apiError(reply, 400, 'GENERAL_VALIDATION', 'price must be a non-negative number')
      }

      const item = await updateMenuItem(id, name.trim(), price, routing_zone)
      return reply.send(item)
    }
  )

  app.patch<{ Params: { id: string } }>('/menu-items/:id/toggle', async (request, reply) => {
    const { id } = request.params
    const item = await toggleMenuItem(id)
    return reply.send(item)
  })

  app.delete<{ Params: { id: string } }>('/menu-items/:id', async (request, reply) => {
    const { id } = request.params
    await deleteMenuItem(id)
    return reply.status(204).send()
  })

  app.patch<{ Params: { id: string }; Body: { active: boolean } }>(
    '/menu-items/:id/eightysix',
    { preHandler: requireRole('owner', 'manager') },
    async (request, reply) => {
      const { id } = request.params
      const { active } = request.body
      if (typeof active !== 'boolean') {
        return apiError(reply, 400, 'GENERAL_VALIDATION', 'active must be a boolean')
      }
      const item = await eightysixMenuItem(id, active)
      return reply.send(item)
    }
  )
}
