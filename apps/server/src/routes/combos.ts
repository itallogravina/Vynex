import { FastifyInstance } from 'fastify'
import {
  listComboBundles,
  listEnabledComboBundles,
  getComboBundleById,
  createComboBundle,
  updateComboBundle,
  deleteComboBundle,
  addItemToComboBundle,
  removeItemFromComboBundle,
} from '../db/queries'
import { CreateComboBundleRequest, UpdateComboBundleRequest, AddComboItemRequest } from '@vynex/shared'

export async function registerCombosRoutes(app: FastifyInstance): Promise<void> {
  app.get('/combos', async () => {
    return listComboBundles()
  })

  app.get('/combos/enabled', async () => {
    return listEnabledComboBundles()
  })

  app.get<{ Params: { id: string } }>('/combos/:id', async (request, reply) => {
    const combo = await getComboBundleById(request.params.id)
    if (!combo) return reply.status(404).send({ error: 'Combo not found' })
    return reply.send(combo)
  })

  app.post<{ Body: CreateComboBundleRequest }>('/combos', async (request, reply) => {
    const { name, description, bundle_price, items } = request.body

    if (!name?.trim()) return reply.status(400).send({ error: 'name is required' })
    if (typeof bundle_price !== 'number' || bundle_price <= 0) {
      return reply.status(400).send({ error: 'bundle_price must be > 0' })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: 'items must be a non-empty array' })
    }
    for (const item of items) {
      if (!item.menu_item_id?.trim()) return reply.status(400).send({ error: 'each item requires menu_item_id' })
      if (typeof item.quantity !== 'number' || item.quantity < 1) {
        return reply.status(400).send({ error: 'each item quantity must be >= 1' })
      }
    }

    const combo = await createComboBundle(name.trim(), description ?? null, bundle_price, items)
    return reply.status(201).send(combo)
  })

  app.put<{ Params: { id: string }; Body: UpdateComboBundleRequest }>(
    '/combos/:id',
    async (request, reply) => {
      const { id } = request.params
      const existing = await getComboBundleById(id)
      if (!existing) return reply.status(404).send({ error: 'Combo not found' })

      const { name, description, bundle_price, enabled } = request.body
      if (bundle_price !== undefined && (typeof bundle_price !== 'number' || bundle_price <= 0)) {
        return reply.status(400).send({ error: 'bundle_price must be > 0' })
      }

      const updated = await updateComboBundle(id, {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(bundle_price !== undefined && { bundle_price }),
        ...(enabled !== undefined && { enabled }),
      })
      return reply.send(updated)
    }
  )

  app.patch<{ Params: { id: string } }>(
    '/combos/:id/toggle',
    async (request, reply) => {
      const { id } = request.params
      const existing = await getComboBundleById(id)
      if (!existing) return reply.status(404).send({ error: 'Combo not found' })
      const updated = await updateComboBundle(id, { enabled: !existing.enabled })
      return reply.send(updated)
    }
  )

  app.delete<{ Params: { id: string } }>('/combos/:id', async (request, reply) => {
    const { id } = request.params
    const existing = await getComboBundleById(id)
    if (!existing) return reply.status(404).send({ error: 'Combo not found' })
    await deleteComboBundle(id)
    return reply.status(204).send()
  })

  app.post<{ Params: { id: string }; Body: AddComboItemRequest }>(
    '/combos/:id/items',
    async (request, reply) => {
      const { id } = request.params
      const { menu_item_id, quantity } = request.body

      const existing = await getComboBundleById(id)
      if (!existing) return reply.status(404).send({ error: 'Combo not found' })
      if (!menu_item_id?.trim()) return reply.status(400).send({ error: 'menu_item_id is required' })
      if (typeof quantity !== 'number' || quantity < 1) {
        return reply.status(400).send({ error: 'quantity must be >= 1' })
      }

      const item = await addItemToComboBundle(id, menu_item_id.trim(), quantity)
      return reply.status(201).send(item)
    }
  )

  app.delete<{ Params: { id: string; itemId: string } }>(
    '/combos/:id/items/:itemId',
    async (request, reply) => {
      const { id, itemId } = request.params
      const existing = await getComboBundleById(id)
      if (!existing) return reply.status(404).send({ error: 'Combo not found' })
      await removeItemFromComboBundle(itemId)
      return reply.status(204).send()
    }
  )
}
