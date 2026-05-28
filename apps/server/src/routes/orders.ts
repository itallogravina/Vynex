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

export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  // List all tables
  app.get('/tables', async () => {
    return listTables()
  })

  // List all menu items (enabled only)
  app.get('/menu-items', async () => {
    return listMenuItems()
  })

  // Get all open orders (for cashier billing view)
  app.get('/orders/open', async () => {
    return listOpenOrders()
  })

  // Create a new order
  app.post<{ Body: CreateOrderRequest }>('/orders', async (request, reply) => {
    const { table_id, routing_mode } = request.body

    const table = getTable(table_id)
    if (!table) {
      return reply.status(404).send({ error: 'Table not found' })
    }

    const order = createOrder(table_id, routing_mode)
    return reply.status(201).send(order)
  })

  // Get order with all items
  app.get<{ Params: { id: string } }>('/orders/:id', async (request, reply) => {
    const { id } = request.params
    const order = getOrder(id)

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' })
    }

    const items = getOrderItems(id)
    return reply.send({ ...order, items })
  })

  // Close an order with payment
  app.post<{ Params: { id: string }; Body: CloseOrderRequest }>(
    '/orders/:id/close',
    async (request, reply) => {
      const { id } = request.params
      const { payment_method } = request.body

      const order = getOrder(id)
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }
      if (order.status === 'closed') {
        return reply.status(400).send({ error: 'Order is already closed' })
      }
      if (!payment_method || !['cash', 'card'].includes(payment_method)) {
        return reply.status(400).send({ error: 'payment_method must be cash or card' })
      }

      const closed = closeOrder(id, payment_method)

      // Notify all queue subscribers and broadcast closed event
      broadcastOrderClosed(id, order.table_id)
      broadcastAllQueueSnapshots()

      return reply.send(closed)
    }
  )

  // Add item to order
  app.post<{ Params: { id: string }; Body: AddOrderItemRequest }>(
    '/orders/:id/items',
    async (request, reply) => {
      const { id } = request.params
      const { menu_item_id, quantity, notes } = request.body

      const order = getOrder(id)
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }

      const menuItem = getMenuItem(menu_item_id)
      if (!menuItem) {
        return reply.status(404).send({ error: 'Menu item not found' })
      }

      const item = addOrderItem(id, menu_item_id, quantity, notes)

      if (order.routing_mode === 'auto') {
        const table = getTable(order.table_id)
        broadcastItemAdded(item.id, menuItem.name, menuItem.routing_zone, table?.name || 'Unknown', quantity)
        broadcastQueueSnapshot(menuItem.routing_zone)
      }

      return reply.status(201).send(item)
    }
  )

  // Update item status
  app.patch<{ Params: { id: string; itemId: string }; Body: UpdateItemStatusRequest }>(
    '/orders/:id/items/:itemId',
    async (request, reply) => {
      const { id, itemId } = request.params
      const { status } = request.body

      const order = getOrder(id)
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }

      const validStatuses = Object.values(ItemStatus)
      if (!validStatuses.includes(status)) {
        return reply.status(400).send({ error: 'Invalid status' })
      }

      const items = getOrderItems(id)
      const currentItem = items.find(item => item.id === itemId)
      const oldStatus = currentItem?.status

      const item = updateOrderItemStatus(itemId, status)

      if (oldStatus && currentItem) {
        broadcastItemStatusChanged(itemId, oldStatus, status, currentItem.menu_item.routing_zone)
        broadcastQueueSnapshot(currentItem.menu_item.routing_zone)
      }

      return reply.send(item)
    }
  )

  // Get queue for a routing zone
  app.get<{ Params: { routingZone: string } }>('/queues/:routingZone', async (request, reply) => {
    const { routingZone } = request.params

    const validZones = Object.values(RoutingZone)
    if (!validZones.includes(routingZone as RoutingZone)) {
      return reply.status(400).send({ error: 'Invalid routing zone' })
    }

    const queue = getQueueByZone(routingZone as RoutingZone)
    return reply.send(queue)
  })
}
