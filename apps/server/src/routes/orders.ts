import { FastifyInstance } from 'fastify'
import {
  createOrder,
  addOrderItem,
  updateOrderItemStatus,
  getOrder,
  getOrderItems,
  getQueueByZone,
  getMenuItem,
  getTable,
  listTables,
  listMenuItems,
  closeOrder,
  listOpenOrders,
} from '../db/queries'
import {
  CreateOrderRequest,
  AddOrderItemRequest,
  UpdateItemStatusRequest,
  CloseOrderRequest,
  ItemStatus,
  RoutingZone,
} from '@vynex/shared'
import {
  broadcastItemAdded,
  broadcastItemStatusChanged,
  broadcastQueueSnapshot,
  broadcastOrderClosed,
  broadcastAllQueueSnapshots,
} from '../ws/broadcast'
import { requireSession } from '../middleware/session'

const session = { preHandler: [requireSession] }

export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  app.get('/tables', { preHandler: [requireSession] }, async () => {
    return listTables()
  })

  app.get('/menu-items', { preHandler: [requireSession] }, async () => {
    return listMenuItems()
  })

  app.get('/orders/open', { preHandler: [requireSession] }, async () => {
    return listOpenOrders()
  })

  app.post<{ Body: CreateOrderRequest }>('/orders', session, async (request, reply) => {
    const { table_id, routing_mode } = request.body

    const table = await getTable(table_id)
    if (!table) {
      return reply.status(404).send({ error: 'Table not found' })
    }

    const order = await createOrder(table_id, routing_mode ?? 'auto', request.user.id)
    return reply.status(201).send(order)
  })

  app.get<{ Params: { id: string } }>('/orders/:id', session, async (request, reply) => {
    const { id } = request.params
    const order = await getOrder(id)

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' })
    }

    const items = await getOrderItems(id)
    return reply.send({ ...order, items })
  })

  app.post<{ Params: { id: string }; Body: CloseOrderRequest }>(
    '/orders/:id/close',
    session,
    async (request, reply) => {
      const { id } = request.params
      const { payment_method } = request.body

      const order = await getOrder(id)
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }
      if (order.status === 'closed') {
        return reply.status(400).send({ error: 'Order is already closed' })
      }
      if (!payment_method || !['cash', 'card'].includes(payment_method)) {
        return reply.status(400).send({ error: 'payment_method must be cash or card' })
      }

      const closed = await closeOrder(id, payment_method)

      broadcastOrderClosed(id, order.table_id)
      broadcastAllQueueSnapshots()

      return reply.send(closed)
    }
  )

  app.post<{ Params: { id: string }; Body: AddOrderItemRequest }>(
    '/orders/:id/items',
    session,
    async (request, reply) => {
      const { id } = request.params
      const { menu_item_id, quantity, notes } = request.body

      const order = await getOrder(id)
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }

      const menuItem = await getMenuItem(menu_item_id)
      if (!menuItem) {
        return reply.status(404).send({ error: 'Menu item not found' })
      }

      const item = await addOrderItem(id, menu_item_id, quantity, notes, request.user.id)

      if (order.routing_mode === 'auto') {
        const table = await getTable(order.table_id)
        broadcastItemAdded(item.id, menuItem.name, menuItem.routing_zone, table?.name || 'Unknown', quantity)
        broadcastQueueSnapshot(menuItem.routing_zone)
      }

      return reply.status(201).send(item)
    }
  )

  app.patch<{ Params: { id: string; itemId: string }; Body: UpdateItemStatusRequest }>(
    '/orders/:id/items/:itemId',
    session,
    async (request, reply) => {
      const { id, itemId } = request.params
      const { status } = request.body

      const order = await getOrder(id)
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }

      const validStatuses = Object.values(ItemStatus)
      if (!validStatuses.includes(status)) {
        return reply.status(400).send({ error: 'Invalid status' })
      }

      const items = await getOrderItems(id)
      const currentItem = items.find(item => item.id === itemId)
      const oldStatus = currentItem?.status

      const item = await updateOrderItemStatus(itemId, status)

      if (oldStatus && currentItem) {
        broadcastItemStatusChanged(itemId, oldStatus, status, currentItem.menu_item.routing_zone)
        broadcastQueueSnapshot(currentItem.menu_item.routing_zone)
      }

      return reply.send(item)
    }
  )

  app.get<{ Params: { routingZone: string } }>('/queues/:routingZone', session, async (request, reply) => {
    const { routingZone } = request.params

    const validZones = Object.values(RoutingZone)
    if (!validZones.includes(routingZone as RoutingZone)) {
      return reply.status(400).send({ error: 'Invalid routing zone' })
    }

    const queue = await getQueueByZone(routingZone as RoutingZone)
    return reply.send(queue)
  })
}
