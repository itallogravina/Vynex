import { FastifyInstance } from 'fastify'
import {
  createOrder,
  addOrderItem,
  updateOrderItemStatus,
  getOrder,
  getOpenOrderForTable,
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
import { apiError } from '../lib/errors'

const session = { preHandler: [requireSession] }

export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  app.get('/tables', { preHandler: [requireSession] }, async () => {
    return listTables()
  })

  app.get('/menu-items', { preHandler: [requireSession] }, async () => {
    return listMenuItems()
  })

  app.get<{ Querystring: { table_id?: string } }>('/orders/open', { preHandler: [requireSession] }, async (request) => {
    const { table_id } = request.query
    if (table_id) return getOpenOrderForTable(table_id)
    return listOpenOrders()
  })

  app.post<{ Body: CreateOrderRequest }>('/orders', session, async (request, reply) => {
    const { table_id, routing_mode } = request.body

    const table = await getTable(table_id)
    if (!table) {
      return apiError(reply, 404, 'TABLE_NOT_FOUND', 'Table not found')
    }

    const existingOpen = await getOpenOrderForTable(table_id)
    if (existingOpen) {
      return apiError(reply, 409, 'TABLE_HAS_OPEN_ORDER', 'Table already has an open order')
    }

    const order = await createOrder(table_id, routing_mode ?? 'auto', request.user.id)
    return reply.status(201).send(order)
  })

  app.get<{ Params: { id: string } }>('/orders/:id', session, async (request, reply) => {
    const { id } = request.params
    const order = await getOrder(id)

    if (!order) {
      return apiError(reply, 404, 'ORDER_NOT_FOUND', 'Order not found')
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
        return apiError(reply, 404, 'ORDER_NOT_FOUND', 'Order not found')
      }
      if (order.status === 'closed') {
        return apiError(reply, 409, 'ORDER_ALREADY_CLOSED', 'Order is already closed')
      }
      if (!payment_method || !['cash', 'card'].includes(payment_method)) {
        return apiError(reply, 400, 'GENERAL_VALIDATION', 'payment_method must be cash or card')
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
        return apiError(reply, 404, 'ORDER_NOT_FOUND', 'Order not found')
      }

      const menuItem = await getMenuItem(menu_item_id)
      if (!menuItem) {
        return apiError(reply, 404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found')
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
        return apiError(reply, 404, 'ORDER_NOT_FOUND', 'Order not found')
      }

      const validStatuses = Object.values(ItemStatus)
      if (!validStatuses.includes(status)) {
        return apiError(reply, 400, 'GENERAL_VALIDATION', 'Invalid status')
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
      return apiError(reply, 400, 'GENERAL_VALIDATION', 'Invalid routing zone')
    }

    const queue = await getQueueByZone(routingZone as RoutingZone)
    return reply.send(queue)
  })
}
