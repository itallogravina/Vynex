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
} from '../db/queries'
import {
  CreateOrderRequest,
  AddOrderItemRequest,
  UpdateItemStatusRequest,
  ItemStatus,
  RoutingZone,
} from '@vynex/shared'

export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  // Create a new order
  app.post<{ Body: CreateOrderRequest }>('/orders', async (request, reply) => {
    const { table_id, routing_mode } = request.body

    // Validate table exists
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

  // Add item to order
  app.post<{ Params: { id: string }; Body: AddOrderItemRequest }>(
    '/orders/:id/items',
    async (request, reply) => {
      const { id } = request.params
      const { menu_item_id, quantity, notes } = request.body

      // Validate order exists
      const order = getOrder(id)
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }

      // Validate menu item exists
      const menuItem = getMenuItem(menu_item_id)
      if (!menuItem) {
        return reply.status(404).send({ error: 'Menu item not found' })
      }

      const item = addOrderItem(id, menu_item_id, quantity, notes)
      return reply.status(201).send(item)
    }
  )

  // Update item status
  app.patch<{ Params: { id: string; itemId: string }; Body: UpdateItemStatusRequest }>(
    '/orders/:id/items/:itemId',
    async (request, reply) => {
      const { id, itemId } = request.params
      const { status } = request.body

      // Validate order exists
      const order = getOrder(id)
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }

      // Validate status is valid
      const validStatuses = Object.values(ItemStatus)
      if (!validStatuses.includes(status)) {
        return reply.status(400).send({ error: 'Invalid status' })
      }

      const item = updateOrderItemStatus(itemId, status)
      return reply.send(item)
    }
  )

  // Get queue for a routing zone (kitchen, bar, cashier)
  app.get<{ Params: { routingZone: string } }>('/queues/:routingZone', async (request, reply) => {
    const { routingZone } = request.params

    // Validate routing zone
    const validZones = Object.values(RoutingZone)
    if (!validZones.includes(routingZone as RoutingZone)) {
      return reply.status(400).send({ error: 'Invalid routing zone' })
    }

    const queue = getQueueByZone(routingZone as RoutingZone)
    return reply.send(queue)
  })
}
