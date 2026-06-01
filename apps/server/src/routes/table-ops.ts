import { FastifyInstance } from 'fastify'
import {
  getOrder,
  getOrderItems,
  transferOrder,
  mergeOrders,
  splitOrderEqual,
  splitOrderByItems,
} from '../db/queries'
import { TransferOrderRequest, MergeOrderRequest, SplitOrderRequest } from '@vynex/shared'
import { requireRole } from '../middleware/auth'
import { broadcastAllQueueSnapshots } from '../ws/broadcast'

export async function registerTableOpsRoutes(app: FastifyInstance): Promise<void> {
  // Transfer an open order to another table
  app.post<{ Params: { id: string }; Body: TransferOrderRequest }>(
    '/orders/:id/transfer',
    { preHandler: requireRole('cashier', 'manager', 'owner') },
    async (request, reply) => {
      const { id } = request.params
      const { to_table_id } = request.body

      const order = await getOrder(id)
      if (!order) return reply.status(404).send({ error: 'Order not found' })
      if (order.status !== 'open') return reply.status(400).send({ error: 'Order is not open' })
      if (!to_table_id) return reply.status(400).send({ error: 'to_table_id is required' })

      const updated = await transferOrder(id, to_table_id)
      broadcastAllQueueSnapshots()
      return reply.send(updated)
    }
  )

  // Merge source order into target order (source is closed as 'merged')
  app.post<{ Params: { id: string }; Body: MergeOrderRequest }>(
    '/orders/:id/merge',
    { preHandler: requireRole('cashier', 'manager', 'owner') },
    async (request, reply) => {
      const { id } = request.params
      const { into_order_id } = request.body

      if (!into_order_id) return reply.status(400).send({ error: 'into_order_id is required' })
      if (id === into_order_id) return reply.status(400).send({ error: 'Cannot merge an order into itself' })

      const [source, target] = await Promise.all([getOrder(id), getOrder(into_order_id)])
      if (!source) return reply.status(404).send({ error: 'Source order not found' })
      if (!target) return reply.status(404).send({ error: 'Target order not found' })
      if (source.status !== 'open') return reply.status(400).send({ error: 'Source order is not open' })
      if (target.status !== 'open') return reply.status(400).send({ error: 'Target order is not open' })

      const merged = await mergeOrders(id, into_order_id)
      broadcastAllQueueSnapshots()
      return reply.send(merged)
    }
  )

  // Split an order into parts (equal division or by item selection)
  app.post<{ Params: { id: string }; Body: SplitOrderRequest }>(
    '/orders/:id/split',
    { preHandler: requireRole('cashier', 'manager', 'owner') },
    async (request, reply) => {
      const { id } = request.params
      const body = request.body

      const order = await getOrder(id)
      if (!order) return reply.status(404).send({ error: 'Order not found' })
      if (order.status !== 'open') return reply.status(400).send({ error: 'Order is not open' })

      const session = (request as any).session
      const openedBy = session?.userId as string | undefined

      if (body.mode === 'equal') {
        if (!body.parts || body.parts < 2) {
          return reply.status(400).send({ error: 'parts must be >= 2 for equal split' })
        }
        const items = await getOrderItems(id)
        if (items.length < body.parts) {
          return reply.status(400).send({ error: 'Not enough items to split into that many parts' })
        }
        const orders = await splitOrderEqual(id, order.table_id, body.parts, openedBy)
        broadcastAllQueueSnapshots()
        return reply.status(201).send({ orders })
      }

      if (body.mode === 'items') {
        if (!body.item_ids || body.item_ids.length === 0) {
          return reply.status(400).send({ error: 'item_ids must be non-empty for items split' })
        }
        const result = await splitOrderByItems(id, order.table_id, body.item_ids, openedBy)
        broadcastAllQueueSnapshots()
        return reply.status(201).send(result)
      }

      return reply.status(400).send({ error: 'mode must be equal or items' })
    }
  )
}
