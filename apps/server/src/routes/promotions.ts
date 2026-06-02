import { FastifyInstance } from 'fastify'
import {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  listActivePromotions,
} from '../db/queries'
import { CreatePromotionRequest, UpdatePromotionRequest } from '@vynex/shared'

export async function registerPromotionsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/promotions', async () => {
    return listPromotions()
  })

  app.get('/promotions/active', async () => {
    return listActivePromotions()
  })

  app.post<{ Body: CreatePromotionRequest }>('/promotions', async (request, reply) => {
    const { name, type, value, applicable_to, applicable_id, active_from, active_to } = request.body

    if (!name?.trim()) return reply.status(400).send({ error: 'name is required' })
    if (!['percentage', 'fixed'].includes(type)) return reply.status(400).send({ error: 'type must be percentage or fixed' })
    if (typeof value !== 'number' || value <= 0) return reply.status(400).send({ error: 'value must be > 0' })
    if (type === 'percentage' && value > 100) return reply.status(400).send({ error: 'percentage value must be 0–100' })
    if (!['item', 'category'].includes(applicable_to)) return reply.status(400).send({ error: 'applicable_to must be item or category' })
    if (!applicable_id?.trim()) return reply.status(400).send({ error: 'applicable_id is required' })

    const promotion = await createPromotion(
      name.trim(), type, value, applicable_to, applicable_id.trim(),
      active_from ?? null, active_to ?? null
    )
    return reply.status(201).send(promotion)
  })

  app.put<{ Params: { id: string }; Body: UpdatePromotionRequest }>(
    '/promotions/:id',
    async (request, reply) => {
      const { id } = request.params
      const { name, type, value, applicable_to, applicable_id, active_from, active_to, enabled } = request.body

      if (type !== undefined && !['percentage', 'fixed'].includes(type)) {
        return reply.status(400).send({ error: 'type must be percentage or fixed' })
      }
      if (value !== undefined && (typeof value !== 'number' || value <= 0)) {
        return reply.status(400).send({ error: 'value must be > 0' })
      }
      if (type === 'percentage' && value !== undefined && value > 100) {
        return reply.status(400).send({ error: 'percentage value must be 0–100' })
      }

      const updated = await updatePromotion(id, {
        ...(name !== undefined && { name: name.trim() }),
        ...(type !== undefined && { type }),
        ...(value !== undefined && { value }),
        ...(applicable_to !== undefined && { applicable_to }),
        ...(applicable_id !== undefined && { applicable_id: applicable_id.trim() }),
        ...(active_from !== undefined && { active_from }),
        ...(active_to !== undefined && { active_to }),
        ...(enabled !== undefined && { enabled }),
      })
      return reply.send(updated)
    }
  )

  app.patch<{ Params: { id: string } }>(
    '/promotions/:id/toggle',
    async (request, reply) => {
      const { id } = request.params
      const promotions = await listPromotions()
      const promo = promotions.find(p => p.id === id)
      if (!promo) return reply.status(404).send({ error: 'Promotion not found' })
      const updated = await updatePromotion(id, { enabled: !promo.enabled })
      return reply.send(updated)
    }
  )

  app.delete<{ Params: { id: string } }>('/promotions/:id', async (request, reply) => {
    const { id } = request.params
    await deletePromotion(id)
    return reply.status(204).send()
  })
}
