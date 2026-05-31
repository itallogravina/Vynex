import { FastifyInstance } from 'fastify'
import {
  listCategoriesWithItems,
  listMenuItems,
  listAllMenuItems,
  createCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  toggleMenuItem,
  eightySixMenuItem,
  setPrepTime,
  deleteMenuItem,
  getDefaultVenueId,
} from '../db/queries'
import { CreateCategoryRequest, CreateMenuItemRequest, UpdateMenuItemRequest, RoutingZone } from '@vynex/shared'

export async function registerMenuRoutes(app: FastifyInstance): Promise<void> {
  // List all categories with their menu items
  app.get('/categories', async () => {
    return listCategoriesWithItems()
  })

  // List enabled menu items — used by order screens
  app.get('/menu-items', async () => {
    return listMenuItems()
  })

  // List all menu items (including disabled) — for admin use
  app.get('/menu-items/all', async () => {
    return listAllMenuItems()
  })

  // Create a category
  app.post<{ Body: CreateCategoryRequest }>('/categories', async (request, reply) => {
    const { name, routing_zone } = request.body

    if (!name?.trim()) {
      return reply.status(400).send({ error: 'name is required' })
    }
    const validZones = Object.values(RoutingZone)
    if (!validZones.includes(routing_zone)) {
      return reply.status(400).send({ error: 'routing_zone must be kitchen, bar, cashier, or table' })
    }

    const venueId = await getDefaultVenueId()
    if (!venueId) {
      return reply.status(500).send({ error: 'No venue configured' })
    }

    const category = await createCategory(venueId, name.trim(), routing_zone)
    return reply.status(201).send(category)
  })

  // Delete a category (cascades items via query)
  app.delete<{ Params: { id: string } }>('/categories/:id', async (request, reply) => {
    const { id } = request.params
    await deleteCategory(id)
    return reply.status(204).send()
  })

  // Create a menu item
  app.post<{ Body: CreateMenuItemRequest }>('/menu-items', async (request, reply) => {
    const { category_id, name, price, routing_zone } = request.body

    if (!name?.trim()) {
      return reply.status(400).send({ error: 'name is required' })
    }
    if (price == null || price < 0) {
      return reply.status(400).send({ error: 'price must be a non-negative number' })
    }
    const validZones = Object.values(RoutingZone)
    if (!validZones.includes(routing_zone)) {
      return reply.status(400).send({ error: 'Invalid routing_zone' })
    }

    const item = await createMenuItem(category_id ?? null, name.trim(), price, routing_zone)
    return reply.status(201).send(item)
  })

  // Update a menu item
  app.patch<{ Params: { id: string }; Body: UpdateMenuItemRequest }>(
    '/menu-items/:id',
    async (request, reply) => {
      const { id } = request.params
      const { name, price, routing_zone } = request.body

      if (!name?.trim()) {
        return reply.status(400).send({ error: 'name is required' })
      }
      if (price == null || price < 0) {
        return reply.status(400).send({ error: 'price must be a non-negative number' })
      }

      const item = await updateMenuItem(id, name.trim(), price, routing_zone)
      return reply.send(item)
    }
  )

  // Toggle a menu item enabled/disabled
  app.patch<{ Params: { id: string } }>('/menu-items/:id/toggle', async (request, reply) => {
    const { id } = request.params
    const item = await toggleMenuItem(id)
    return reply.send(item)
  })

  // Toggle 86'd status — clears automatically at midnight via server-side day check
  app.patch<{ Params: { id: string } }>('/menu-items/:id/eightysix', async (request, reply) => {
    const { id } = request.params
    const item = await eightySixMenuItem(id)
    return reply.send(item)
  })

  // Set or clear prep time (seconds) for a menu item
  app.patch<{ Params: { id: string }; Body: { seconds: number | null } }>(
    '/menu-items/:id/prep-time',
    async (request, reply) => {
      const { id } = request.params
      const { seconds } = request.body
      if (seconds !== null && (typeof seconds !== 'number' || seconds < 0)) {
        return reply.status(400).send({ error: 'seconds must be a non-negative number or null' })
      }
      const item = await setPrepTime(id, seconds ?? null)
      return reply.send(item)
    }
  )

  // Delete a menu item
  app.delete<{ Params: { id: string } }>('/menu-items/:id', async (request, reply) => {
    const { id } = request.params
    await deleteMenuItem(id)
    return reply.status(204).send()
  })
}
